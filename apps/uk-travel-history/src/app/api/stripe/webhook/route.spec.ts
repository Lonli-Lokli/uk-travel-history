/**
 * Tests for Stripe webhook handler
 * Tests subscription lifecycle events and idempotency
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import * as db from '@uth/db';
import * as paymentsServer from '@uth/payments-server';
import * as authServer from '@uth/auth-server';
import { configureRouteLogger } from '@/lib/routeLogger';

// Mock dependencies
vi.mock('@uth/db');
vi.mock('@uth/payments-server');
vi.mock('@uth/auth-server');

// Create mock logger for testing
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Configure route logger with mock
    configureRouteLogger({
      logger: mockLogger,
    });

    process.env.STRIPE_WEBHOOK_SECRET = 'test_webhook_secret';
    process.env.STRIPE_MONTHLY_PRICE_ID = 'price_monthly';
    process.env.STRIPE_YEARLY_PRICE_ID = 'price_yearly';
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime';
  });

  describe('Webhook Signature Verification', () => {
    it('should return 400 if signature header is missing', async () => {
      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing signature');
    });

    it('should return 500 if webhook secret is not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_sig',
        },
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Webhook secret not configured');
    });

    it('should return 400 if signature verification fails', async () => {
      vi.mocked(paymentsServer.constructWebhookEvent).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': 'invalid_sig',
        },
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Webhook Error');
    });
  });

  describe('Idempotency', () => {
    it('should skip processing if event already processed', async () => {
      const eventId = 'evt_test_123';

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: eventId,
        type: 'checkout.session.completed',
        data: { object: {} },
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': 'valid_sig',
        },
        body: JSON.stringify({ test: 'data' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.skipped).toBe(true);
      expect(db.recordWebhookEvent).not.toHaveBeenCalled();
    });

    it('should record webhook event for new events', async () => {
      const eventId = 'evt_test_123';
      const eventType = 'customer.subscription.created';

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: eventId,
        type: eventType,
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'active',
            items: {
              data: [{ price: { id: 'price_monthly' } }],
            },
            metadata: { email: 'test@example.com' },
          },
        },
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.getUserByAuthId).mockResolvedValue(null);
      vi.mocked(db.createUser).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': 'valid_sig',
        },
        body: JSON.stringify({ test: 'data' }),
      });

      await POST(request);

      expect(db.recordWebhookEvent).toHaveBeenCalledWith({
        stripeEventId: eventId,
        type: eventType,
        payload: expect.any(Object),
      });
    });
  });

  describe('Subscription Events', () => {
    it('should create user with monthly subscription on subscription.created', async () => {
      const subscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price_monthly' } }],
        },
        current_period_end: 1704067200, // 2024-01-01
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.created',
        data: { object: subscription },
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.getUserByAuthId).mockResolvedValue(null);
      vi.mocked(db.createUser).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(db.createUser).toHaveBeenCalledWith({
        authUserId: 'user_123',
        email: 'test@example.com',
        passkeyEnrolled: false,
        subscriptionTier: 'monthly',
        subscriptionStatus: 'active',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripePriceId: 'price_monthly',
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });
    });

    it('should update existing user on subscription.updated', async () => {
      const subscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price_yearly' } }],
        },
        current_period_end: 1735689600, // 2025-01-01
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.updated',
        data: { object: subscription },
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.getUserByAuthId).mockResolvedValue({
        id: 'db_user_123',
        authUserId: 'user_123',
      } as any);
      vi.mocked(db.updateUserByAuthId).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(db.updateUserByAuthId).toHaveBeenCalledWith('user_123', {
        subscriptionTier: 'yearly',
        subscriptionStatus: 'active',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripePriceId: 'price_yearly',
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });
    });

    it('should downgrade user to free tier on subscription.deleted', async () => {
      const subscription = {
        id: 'sub_123',
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.deleted',
        data: { object: subscription },
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.updateUserByAuthId).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(db.updateUserByAuthId).toHaveBeenCalledWith('user_123', {
        subscriptionTier: 'free',
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
      });
    });
  });

  describe('Invoice Events', () => {
    it('should reactivate past_due user on payment_succeeded', async () => {
      const invoice = {
        id: 'in_123',
        subscription: 'sub_123',
        customer_email: 'test@example.com',
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'invoice.payment_succeeded',
        data: { object: invoice },
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.getUserByAuthId).mockResolvedValue({
        id: 'db_user_123',
        authUserId: 'user_123',
        subscriptionStatus: 'past_due',
      } as any);
      vi.mocked(db.updateUserByAuthId).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(db.updateUserByAuthId).toHaveBeenCalledWith('user_123', {
        subscriptionStatus: 'active',
      });
    });

    it('should mark user as past_due on payment_failed', async () => {
      const invoice = {
        id: 'in_123',
        subscription: 'sub_123',
        customer_email: 'test@example.com',
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'invoice.payment_failed',
        data: { object: invoice },
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.updateUserByAuthId).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(db.updateUserByAuthId).toHaveBeenCalledWith('user_123', {
        subscriptionStatus: 'past_due',
      });
    });

    it('should skip invoice events without subscription', async () => {
      const invoice = {
        id: 'in_123',
        subscription: null, // No subscription (one-time payment)
        customer_email: 'test@example.com',
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'invoice.payment_succeeded',
        data: { object: invoice },
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(db.updateUserByAuthId).not.toHaveBeenCalled();
    });
  });

  describe('Price Tier Mapping', () => {
    it('should map monthly price ID correctly', async () => {
      const subscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price_monthly' } }],
        },
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.created',
        data: { object: subscription },
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.getUserByAuthId).mockResolvedValue(null);
      vi.mocked(db.createUser).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      await POST(request);

      expect(db.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionTier: 'monthly',
        }),
      );
    });

    it('should map yearly price ID correctly', async () => {
      const subscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price_yearly' } }],
        },
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.created',
        data: { object: subscription },
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.getUserByAuthId).mockResolvedValue(null);
      vi.mocked(db.createUser).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      await POST(request);

      expect(db.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionTier: 'yearly',
        }),
      );
    });

    it('should map lifetime price ID correctly', async () => {
      const subscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price_lifetime' } }],
        },
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.created',
        data: { object: subscription },
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.getUserByAuthId).mockResolvedValue(null);
      vi.mocked(db.createUser).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      await POST(request);

      expect(db.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionTier: 'lifetime',
        }),
      );
    });
  });
});
