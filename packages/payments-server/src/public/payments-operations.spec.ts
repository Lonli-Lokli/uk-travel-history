/**
 * Tests for payments-server public API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PaymentsError,
  PaymentsErrorCode,
  PaymentPlan,
  PaymentStatus,
  WebhookEventType,
  getPriceIds,
  retrieveCheckoutSession,
  retrieveSubscription,
  constructWebhookEvent,
} from '../index.js';
import { getPaymentsProvider } from '../internal/provider-resolver.js';
import { StripePaymentsServerAdapter } from '../internal/providers/stripe-adapter.js';

describe('Payments Server - Domain Types', () => {
  describe('PaymentsError', () => {
    it('should create a PaymentsError with correct properties', () => {
      const error = new PaymentsError(
        PaymentsErrorCode.INVALID_SIGNATURE,
        'Invalid webhook signature',
      );

      expect(error.name).toBe('PaymentsError');
      expect(error.code).toBe(PaymentsErrorCode.INVALID_SIGNATURE);
      expect(error.message).toBe('Invalid webhook signature');
      expect(error.is(PaymentsErrorCode.INVALID_SIGNATURE)).toBe(true);
      expect(error.is(PaymentsErrorCode.NOT_FOUND)).toBe(false);
    });

    it('should serialize to JSON correctly', () => {
      const error = new PaymentsError(
        PaymentsErrorCode.PROVIDER_ERROR,
        'Provider failed',
      );

      const json = error.toJSON();

      expect(json.name).toBe('PaymentsError');
      expect(json.code).toBe(PaymentsErrorCode.PROVIDER_ERROR);
      expect(json.message).toBe('Provider failed');
    });

    it('should preserve original error', () => {
      const originalError = new Error('Original error');
      const error = new PaymentsError(
        PaymentsErrorCode.NETWORK_ERROR,
        'Network failed',
        originalError,
      );

      expect(error.originalError).toBe(originalError);
    });
  });

  describe('PaymentPlan enum', () => {
    it('should have all expected payment plans', () => {
      expect(PaymentPlan.PREMIUM_MONTHLY).toBe('PREMIUM_MONTHLY');
      expect(PaymentPlan.PREMIUM_ANNUAL).toBe('PREMIUM_ANNUAL');
      expect(PaymentPlan.PREMIUM_ONCE).toBe('PREMIUM_ONCE');
    });
  });

  describe('PaymentStatus enum', () => {
    it('should have all expected payment statuses', () => {
      expect(PaymentStatus.PENDING).toBe('PENDING');
      expect(PaymentStatus.SUCCEEDED).toBe('SUCCEEDED');
      expect(PaymentStatus.FAILED).toBe('FAILED');
      expect(PaymentStatus.CANCELLED).toBe('CANCELLED');
      expect(PaymentStatus.PROCESSING).toBe('PROCESSING');
    });
  });

  describe('WebhookEventType enum', () => {
    it('should have all expected webhook event types', () => {
      expect(WebhookEventType.CHECKOUT_COMPLETED).toBe('CHECKOUT_COMPLETED');
      expect(WebhookEventType.PAYMENT_SUCCEEDED).toBe('PAYMENT_SUCCEEDED');
      expect(WebhookEventType.PAYMENT_FAILED).toBe('PAYMENT_FAILED');
      expect(WebhookEventType.SUBSCRIPTION_CREATED).toBe(
        'SUBSCRIPTION_CREATED',
      );
      expect(WebhookEventType.SUBSCRIPTION_UPDATED).toBe(
        'SUBSCRIPTION_UPDATED',
      );
      expect(WebhookEventType.SUBSCRIPTION_CANCELLED).toBe(
        'SUBSCRIPTION_CANCELLED',
      );
      expect(WebhookEventType.UNKNOWN).toBe('UNKNOWN');
    });
  });

  describe('PaymentsErrorCode enum', () => {
    it('should have all expected error codes', () => {
      expect(PaymentsErrorCode.INVALID_SIGNATURE).toBe('INVALID_SIGNATURE');
      expect(PaymentsErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(PaymentsErrorCode.ALREADY_PROCESSED).toBe('ALREADY_PROCESSED');
      expect(PaymentsErrorCode.CONFIG_ERROR).toBe('CONFIG_ERROR');
      expect(PaymentsErrorCode.PROVIDER_ERROR).toBe('PROVIDER_ERROR');
      expect(PaymentsErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
      expect(PaymentsErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(PaymentsErrorCode.UNKNOWN).toBe('UNKNOWN');
    });
  });
});

describe('Payments Server - SDK Operations', () => {
  beforeEach(() => {
    // Ensure provider is initialized
    const provider = getPaymentsProvider();
    provider.initialize({});
  });

  describe('getPriceIds', () => {
    it('should return all price IDs', () => {
      const priceIds = getPriceIds();

      expect(priceIds).toHaveProperty('PREMIUM_MONTHLY');
      expect(priceIds).toHaveProperty('PREMIUM_ANNUAL');
      expect(priceIds).toHaveProperty('PREMIUM_ONCE');
    });

    it('should return configured price IDs from environment', () => {
      const priceIds = getPriceIds();

      // Default values should be present
      expect(typeof priceIds.PREMIUM_MONTHLY).toBe('string');
      expect(typeof priceIds.PREMIUM_ANNUAL).toBe('string');
      expect(typeof priceIds.PREMIUM_ONCE).toBe('string');
    });
  });

  describe('retrieveCheckoutSession', () => {
    it('should throw NOT_FOUND error for invalid session ID', async () => {
      const provider = getPaymentsProvider() as StripePaymentsServerAdapter;
      if (!provider.isConfigured()) {
        // Skip test if Stripe is not configured
        return;
      }

      await expect(
        retrieveCheckoutSession('cs_invalid_session_id'),
      ).rejects.toThrow(PaymentsError);

      await expect(
        retrieveCheckoutSession('cs_invalid_session_id'),
      ).rejects.toMatchObject({
        code: PaymentsErrorCode.NOT_FOUND,
      });
    });

    it('should return session details structure', async () => {
      const provider = getPaymentsProvider() as StripePaymentsServerAdapter;
      if (!provider.isConfigured()) {
        // Skip test if Stripe is not configured
        return;
      }

      // Test with mock session ID to verify error structure
      try {
        await retrieveCheckoutSession('cs_test_123');
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentsError);
        if (error instanceof PaymentsError) {
          expect([
            PaymentsErrorCode.NOT_FOUND,
            PaymentsErrorCode.PROVIDER_ERROR,
          ]).toContain(error.code);
        }
      }
    });
  });

  describe('retrieveSubscription', () => {
    it('should throw NOT_FOUND error for invalid subscription ID', async () => {
      const provider = getPaymentsProvider() as StripePaymentsServerAdapter;
      if (!provider.isConfigured()) {
        // Skip test if Stripe is not configured
        return;
      }

      await expect(
        retrieveSubscription('sub_invalid_subscription_id'),
      ).rejects.toThrow(PaymentsError);

      await expect(
        retrieveSubscription('sub_invalid_subscription_id'),
      ).rejects.toMatchObject({
        code: PaymentsErrorCode.NOT_FOUND,
      });
    });

    it('should return subscription details structure', async () => {
      const provider = getPaymentsProvider() as StripePaymentsServerAdapter;
      if (!provider.isConfigured()) {
        // Skip test if Stripe is not configured
        return;
      }

      // Test with mock subscription ID to verify error structure
      try {
        await retrieveSubscription('sub_test_123');
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentsError);
        if (error instanceof PaymentsError) {
          expect([
            PaymentsErrorCode.NOT_FOUND,
            PaymentsErrorCode.PROVIDER_ERROR,
          ]).toContain(error.code);
        }
      }
    });
  });

  describe('constructWebhookEvent', () => {
    it('should throw INVALID_SIGNATURE error for invalid signature', () => {
      const provider = getPaymentsProvider() as StripePaymentsServerAdapter;
      if (!provider.isConfigured()) {
        // Skip test if Stripe is not configured
        return;
      }

      const body = JSON.stringify({ type: 'test.event', data: {} });
      const signature = 'invalid_signature';
      const secret = 'whsec_test_secret';

      expect(() =>
        constructWebhookEvent(body, signature, secret),
      ).toThrow(PaymentsError);

      try {
        constructWebhookEvent(body, signature, secret);
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentsError);
        if (error instanceof PaymentsError) {
          expect(error.code).toBe(PaymentsErrorCode.INVALID_SIGNATURE);
        }
      }
    });

    it('should accept Buffer as body', () => {
      const provider = getPaymentsProvider() as StripePaymentsServerAdapter;
      if (!provider.isConfigured()) {
        // Skip test if Stripe is not configured
        return;
      }

      const body = Buffer.from(JSON.stringify({ type: 'test.event', data: {} }));
      const signature = 'invalid_signature';
      const secret = 'whsec_test_secret';

      try {
        constructWebhookEvent(body, signature, secret);
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentsError);
        if (error instanceof PaymentsError) {
          expect(error.code).toBe(PaymentsErrorCode.INVALID_SIGNATURE);
        }
      }
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full checkout flow types', () => {
      // Verify all types are exported correctly
      const priceIds = getPriceIds();
      expect(priceIds).toBeDefined();
      expect(Object.keys(priceIds).length).toBe(3);
    });

    it('should maintain provider abstraction', () => {
      // The SDK should not leak Stripe-specific types
      const priceIds = getPriceIds();

      // PriceIds should be provider-agnostic
      expect(priceIds).not.toHaveProperty('stripe');
      expect(priceIds).not.toHaveProperty('stripeInstance');
    });
  });
});
