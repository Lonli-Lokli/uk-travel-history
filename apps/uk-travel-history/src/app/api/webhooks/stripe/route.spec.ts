/**
 * Tests for webhook handler using SDK domain types
 * Tests subscription lifecycle events and idempotency
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import * as db from '@uth/db';
import * as paymentsServer from '@uth/payments-server';
import * as authServer from '@uth/auth-server';
import { configureRouteLogger } from '@uth/flow';
import type {
  SubscriptionDetails,
  InvoiceEventData,
  CheckoutSessionEventData,
  ProviderSubscriptionStatus,
} from '@uth/payments-server';

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
      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
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

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
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

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
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

      const sessionData: CheckoutSessionEventData = {
        id: 'cs_123',
        mode: 'subscription',
        paymentStatus: 'paid',
        customerId: 'cus_123',
        metadata: {},
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: eventId,
        type: 'checkout.session.completed',
        created: Math.floor(Date.now() / 1000),
        data: sessionData,
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
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

      const subscription: SubscriptionDetails = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active' as ProviderSubscriptionStatus,
        currentPeriodStart: Math.floor(Date.now() / 1000),
        currentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        cancelAtPeriodEnd: false,
        pauseCollection: null,
        priceId: 'price_monthly',
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: eventId,
        type: eventType,
        created: Math.floor(Date.now() / 1000),
        data: subscription,
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.getUserByAuthId).mockResolvedValue(null);
      vi.mocked(db.createUser).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
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
      const periodEnd = 1704067200; // 2024-01-01
      const subscription: SubscriptionDetails = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active' as ProviderSubscriptionStatus,
        currentPeriodStart: periodEnd - 30 * 24 * 60 * 60,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        pauseCollection: null,
        priceId: 'price_monthly',
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.created',
        created: Math.floor(Date.now() / 1000),
        data: subscription,
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.getUserByAuthId).mockResolvedValue(null);
      vi.mocked(db.createUser).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
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
        currentPeriodEnd: new Date(periodEnd * 1000),
        cancelAtPeriodEnd: false,
        pauseResumesAt: null,
      });
    });

    it('should update existing user on subscription.updated', async () => {
      const periodEnd = 1735689600; // 2025-01-01
      const subscription: SubscriptionDetails = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active' as ProviderSubscriptionStatus,
        currentPeriodStart: periodEnd - 365 * 24 * 60 * 60,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        pauseCollection: null,
        priceId: 'price_yearly',
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.updated',
        created: Math.floor(Date.now() / 1000),
        data: subscription,
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

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
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
        currentPeriodEnd: new Date(periodEnd * 1000),
        cancelAtPeriodEnd: false,
        pauseResumesAt: null,
      });
    });

    it('should downgrade user to free tier on subscription.deleted', async () => {
      const subscription: SubscriptionDetails = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'canceled' as ProviderSubscriptionStatus,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        pauseCollection: null,
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.deleted',
        created: Math.floor(Date.now() / 1000),
        data: subscription,
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.updateUserByAuthId).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(db.updateUserByAuthId).toHaveBeenCalledWith('user_123', {
        subscriptionTier: 'free',
        subscriptionStatus: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        pauseResumesAt: null,
      });
    });
  });

  describe('Invoice Events', () => {
    it('should reactivate past_due user on payment_succeeded', async () => {
      const invoice: InvoiceEventData = {
        id: 'in_123',
        subscriptionId: 'sub_123',
        customerId: 'cus_123',
        customerEmail: 'test@example.com',
        billingReason: 'subscription_cycle',
        attemptCount: 1,
        amountDue: 999,
        amountPaid: 999,
        currency: 'usd',
      };

      const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      const subscription: SubscriptionDetails = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active' as ProviderSubscriptionStatus,
        currentPeriodStart: periodEnd - 30 * 24 * 60 * 60,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        pauseCollection: null,
        priceId: 'price_monthly',
        metadata: {
          userId: 'user_123',
          email: 'test@example.com',
        },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'invoice.payment_succeeded',
        created: Math.floor(Date.now() / 1000),
        data: invoice,
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
      vi.mocked(paymentsServer.retrieveSubscription).mockResolvedValue(subscription);
      vi.mocked(db.updateUserByAuthId).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(paymentsServer.retrieveSubscription).toHaveBeenCalledWith('sub_123');
      expect(db.updateUserByAuthId).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({
          subscriptionStatus: 'active',
        }),
      );
    });

    it('should mark user as past_due on payment_failed', async () => {
      const invoice: InvoiceEventData = {
        id: 'in_123',
        subscriptionId: 'sub_123',
        customerId: 'cus_123',
        customerEmail: 'test@example.com',
        billingReason: 'subscription_cycle',
        attemptCount: 2,
        amountDue: 999,
        amountPaid: 0,
        currency: 'usd',
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'invoice.payment_failed',
        created: Math.floor(Date.now() / 1000),
        data: invoice,
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.updateUserByAuthId).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
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
      const invoice: InvoiceEventData = {
        id: 'in_123',
        subscriptionId: null,
        customerId: 'cus_123',
        customerEmail: 'test@example.com',
        billingReason: 'manual',
        attemptCount: 1,
        amountDue: 999,
        amountPaid: 999,
        currency: 'usd',
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'invoice.payment_succeeded',
        created: Math.floor(Date.now() / 1000),
        data: invoice,
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(db.updateUserByAuthId).not.toHaveBeenCalled();
    });
  });

  describe('Subscription Lifecycle', () => {
    it('should handle paused subscription with resume date', async () => {
      const resumeTimestamp = 1738368000; // 2025-02-01
      const periodEnd = 1735689600; // 2025-01-01
      const subscription: SubscriptionDetails = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active' as ProviderSubscriptionStatus,
        currentPeriodStart: periodEnd - 30 * 24 * 60 * 60,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        pauseCollection: {
          behavior: 'void',
          resumesAt: resumeTimestamp,
        },
        priceId: 'price_monthly',
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.updated',
        created: Math.floor(Date.now() / 1000),
        data: subscription,
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

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(db.updateUserByAuthId).toHaveBeenCalledWith('user_123', {
        subscriptionTier: 'monthly',
        subscriptionStatus: 'paused',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripePriceId: 'price_monthly',
        currentPeriodEnd: new Date(periodEnd * 1000),
        cancelAtPeriodEnd: false,
        pauseResumesAt: new Date(resumeTimestamp * 1000),
      });
    });

    it('should handle scheduled cancellation with grace period', async () => {
      const periodEnd = 1767225600; // 2026-01-01
      const subscription: SubscriptionDetails = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active' as ProviderSubscriptionStatus,
        currentPeriodStart: periodEnd - 365 * 24 * 60 * 60,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: true,
        pauseCollection: null,
        priceId: 'price_yearly',
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.updated',
        created: Math.floor(Date.now() / 1000),
        data: subscription,
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

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
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
        currentPeriodEnd: new Date(periodEnd * 1000),
        cancelAtPeriodEnd: true,
        pauseResumesAt: null,
      });
    });

    it('should clear cancellation flags on subscription.deleted', async () => {
      const subscription: SubscriptionDetails = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'canceled' as ProviderSubscriptionStatus,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        pauseCollection: null,
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.deleted',
        created: Math.floor(Date.now() / 1000),
        data: subscription,
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.updateUserByAuthId).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid_sig' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(db.updateUserByAuthId).toHaveBeenCalledWith('user_123', {
        subscriptionTier: 'free',
        subscriptionStatus: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        pauseResumesAt: null,
      });
    });
  });

  describe('Price Tier Mapping', () => {
    it('should map monthly price ID correctly', async () => {
      const now = Math.floor(Date.now() / 1000);
      const subscription: SubscriptionDetails = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active' as ProviderSubscriptionStatus,
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 24 * 60 * 60,
        cancelAtPeriodEnd: false,
        pauseCollection: null,
        priceId: 'price_monthly',
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.created',
        created: now,
        data: subscription,
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.getUserByAuthId).mockResolvedValue(null);
      vi.mocked(db.createUser).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
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
      const now = Math.floor(Date.now() / 1000);
      const subscription: SubscriptionDetails = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active' as ProviderSubscriptionStatus,
        currentPeriodStart: now,
        currentPeriodEnd: now + 365 * 24 * 60 * 60,
        cancelAtPeriodEnd: false,
        pauseCollection: null,
        priceId: 'price_yearly',
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.created',
        created: now,
        data: subscription,
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.getUserByAuthId).mockResolvedValue(null);
      vi.mocked(db.createUser).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
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
      const now = Math.floor(Date.now() / 1000);
      const subscription: SubscriptionDetails = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active' as ProviderSubscriptionStatus,
        currentPeriodStart: now,
        currentPeriodEnd: now + 100 * 365 * 24 * 60 * 60,
        cancelAtPeriodEnd: false,
        pauseCollection: null,
        priceId: 'price_lifetime',
        metadata: { email: 'test@example.com' },
      };

      vi.mocked(paymentsServer.constructWebhookEvent).mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.created',
        created: now,
        data: subscription,
      });

      vi.mocked(db.hasWebhookEventBeenProcessed).mockResolvedValue(false);
      vi.mocked(db.recordWebhookEvent).mockResolvedValue({} as any);
      vi.mocked(authServer.getUsersByEmail).mockResolvedValue({
        users: [{ uid: 'user_123', email: 'test@example.com' }],
      } as any);
      vi.mocked(db.getUserByAuthId).mockResolvedValue(null);
      vi.mocked(db.createUser).mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost/api/webhooks/stripe', {
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
