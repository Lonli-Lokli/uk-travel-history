/**
 * Tests for payments-server public API
 */

import { describe, it, expect } from 'vitest';
import {
  PaymentsError,
  PaymentsErrorCode,
  PaymentPlan,
  PaymentStatus,
  WebhookEventType,
} from '../index.js';

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
