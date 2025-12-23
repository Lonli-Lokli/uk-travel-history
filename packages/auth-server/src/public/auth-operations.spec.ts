/**
 * Tests for auth-server public API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AuthError,
  AuthErrorCode,
  SubscriptionStatus,
  verifyToken,
  getUser,
  deleteUser,
  setCustomClaims,
  getCustomClaims,
  createCustomToken,
  isAuthConfigured,
  getSubscription,
  getSubscriptionBySessionId,
  createSubscription,
  updateSubscription,
} from '../index.js';
import { MockAuthServerAdapter } from '../internal/providers/mock-adapter';
import { setAuthProvider } from '../internal/provider-resolver';

describe('Auth Server - Domain Types', () => {
  describe('AuthError', () => {
    it('should create an AuthError with correct properties', () => {
      const error = new AuthError(
        AuthErrorCode.UNAUTHENTICATED,
        'Test error message',
      );

      expect(error.name).toBe('AuthError');
      expect(error.code).toBe(AuthErrorCode.UNAUTHENTICATED);
      expect(error.message).toBe('Test error message');
      expect(error.is(AuthErrorCode.UNAUTHENTICATED)).toBe(true);
      expect(error.is(AuthErrorCode.FORBIDDEN)).toBe(false);
    });

    it('should serialize to JSON correctly', () => {
      const error = new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        'Provider failed',
      );

      const json = error.toJSON();

      expect(json.name).toBe('AuthError');
      expect(json.code).toBe(AuthErrorCode.PROVIDER_ERROR);
      expect(json.message).toBe('Provider failed');
    });

    it('should preserve original error', () => {
      const originalError = new Error('Original error');
      const error = new AuthError(
        AuthErrorCode.NETWORK_ERROR,
        'Network failed',
        originalError,
      );

      expect(error.originalError).toBe(originalError);
    });
  });

  describe('AuthErrorCode enum', () => {
    it('should have all expected error codes', () => {
      expect(AuthErrorCode.UNAUTHENTICATED).toBe('UNAUTHENTICATED');
      expect(AuthErrorCode.FORBIDDEN).toBe('FORBIDDEN');
      expect(AuthErrorCode.CONFIG_ERROR).toBe('CONFIG_ERROR');
      expect(AuthErrorCode.PROVIDER_ERROR).toBe('PROVIDER_ERROR');
      expect(AuthErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(AuthErrorCode.INVALID_TOKEN).toBe('INVALID_TOKEN');
      expect(AuthErrorCode.USER_NOT_FOUND).toBe('USER_NOT_FOUND');
      expect(AuthErrorCode.UNKNOWN).toBe('UNKNOWN');
    });
  });

  describe('SubscriptionStatus enum', () => {
    it('should have all expected subscription statuses', () => {
      expect(SubscriptionStatus.ACTIVE).toBe('active');
      expect(SubscriptionStatus.PAST_DUE).toBe('past_due');
      expect(SubscriptionStatus.CANCELED).toBe('canceled');
      expect(SubscriptionStatus.TRIALING).toBe('trialing');
      expect(SubscriptionStatus.INCOMPLETE).toBe('incomplete');
      expect(SubscriptionStatus.INCOMPLETE_EXPIRED).toBe('incomplete_expired');
      expect(SubscriptionStatus.UNPAID).toBe('unpaid');
    });
  });
});

describe('Auth Server - Authentication Operations', () => {
  let mockProvider: MockAuthServerAdapter;

  beforeEach(() => {
    mockProvider = new MockAuthServerAdapter();
    mockProvider.initialize({});
    mockProvider.clearMockData();

    // Add a test user for operations that need an existing user
    mockProvider.addMockUser({
      uid: 'test-uid',
      email: 'test@example.com',
      emailVerified: true,
    });

    // Add a valid token for the test user
    mockProvider.addMockToken('valid-token', 'test-uid');

    setAuthProvider(mockProvider);
  });

  describe('isAuthConfigured', () => {
    it('should return true when provider is configured', () => {
      expect(isAuthConfigured()).toBe(true);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const result = await verifyToken('valid-token');

      expect(result).toBeDefined();
      expect(result.uid).toBe('test-uid');
      expect(result.email).toBe('test@example.com');
      expect(result.emailVerified).toBe(true);
    });

    it('should throw AuthError for invalid token', async () => {
      await expect(verifyToken('invalid')).rejects.toThrow(AuthError);
    });
  });

  describe('getUser', () => {
    it('should retrieve user by ID', async () => {
      const user = await getUser('test-uid');

      expect(user.uid).toBe('test-uid');
      expect(user.email).toBe('test@example.com');
      expect(user.emailVerified).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      await expect(getUser('nonexistent')).rejects.toThrow(AuthError);
    });
  });

  describe('deleteUser', () => {
    it('should delete an existing user', async () => {
      await deleteUser('test-uid');
      // After deletion, getUser should throw
      await expect(getUser('test-uid')).rejects.toThrow(AuthError);
    });

    it('should throw error when trying to delete non-existent user', async () => {
      await expect(deleteUser('nonexistent')).rejects.toThrow(AuthError);
    });
  });

  describe('setCustomClaims', () => {
    it('should set custom claims for an existing user', async () => {
      const claims = { role: 'admin', premium: true };
      await setCustomClaims('test-uid', claims);

      const retrievedClaims = await getCustomClaims('test-uid');
      expect(retrievedClaims).toEqual(claims);
    });
  });

  describe('getCustomClaims', () => {
    it('should retrieve custom claims', async () => {
      const claims = { role: 'user' };
      await setCustomClaims('test-uid', claims);

      const retrievedClaims = await getCustomClaims('test-uid');
      expect(retrievedClaims).toEqual(claims);
    });

    it('should throw error for non-existent user', async () => {
      await expect(getCustomClaims('nonexistent')).rejects.toThrow(AuthError);
    });
  });

  describe('createCustomToken', () => {
    it('should create a custom token', async () => {
      const token = await createCustomToken('test-uid');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should create a custom token with custom claims', async () => {
      const token = await createCustomToken('test-uid', { premium: true });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });
});

describe('Auth Server - Subscription Operations', () => {
  let mockProvider: MockAuthServerAdapter;

  beforeEach(() => {
    mockProvider = new MockAuthServerAdapter();
    mockProvider.initialize({});
    mockProvider.clearMockData();
    setAuthProvider(mockProvider);
  });

  describe('createSubscription', () => {
    it('should create a new subscription with all fields', async () => {
      const subscriptionData = {
        userId: 'user123',
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripeSessionId: 'cs_123',
        stripePriceId: 'price_123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        cancelAtPeriodEnd: false,
      };

      const subscription = await createSubscription(subscriptionData);

      expect(subscription.userId).toBe('user123');
      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.stripeCustomerId).toBe('cus_123');
      expect(subscription.stripeSubscriptionId).toBe('sub_123');
      expect(subscription.stripeSessionId).toBe('cs_123');
      expect(subscription.stripePriceId).toBe('price_123');
      expect(subscription.cancelAtPeriodEnd).toBe(false);
      expect(subscription.createdAt).toBeInstanceOf(Date);
      expect(subscription.updatedAt).toBeInstanceOf(Date);
    });

    it('should create subscription without optional fields', async () => {
      const subscriptionData = {
        userId: 'user456',
        status: SubscriptionStatus.TRIALING,
        stripeCustomerId: 'cus_456',
        stripeSubscriptionId: 'sub_456',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        cancelAtPeriodEnd: false,
      };

      const subscription = await createSubscription(subscriptionData);

      expect(subscription.userId).toBe('user456');
      expect(subscription.status).toBe(SubscriptionStatus.TRIALING);
      expect(subscription.stripeSessionId).toBeUndefined();
      expect(subscription.stripePriceId).toBeUndefined();
    });
  });

  describe('getSubscription', () => {
    it('should return subscription for existing user', async () => {
      const subscriptionData = {
        userId: 'user123',
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        cancelAtPeriodEnd: false,
      };

      await createSubscription(subscriptionData);
      const subscription = await getSubscription('user123');

      expect(subscription).not.toBeNull();
      expect(subscription?.userId).toBe('user123');
      expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('should return null for non-existent subscription', async () => {
      const subscription = await getSubscription('nonexistent');
      expect(subscription).toBeNull();
    });
  });

  describe('getSubscriptionBySessionId', () => {
    it('should return subscription for existing session', async () => {
      const subscriptionData = {
        userId: 'user123',
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripeSessionId: 'cs_test_123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        cancelAtPeriodEnd: false,
      };

      await createSubscription(subscriptionData);
      const subscription = await getSubscriptionBySessionId('cs_test_123');

      expect(subscription).not.toBeNull();
      expect(subscription?.userId).toBe('user123');
      expect(subscription?.stripeSessionId).toBe('cs_test_123');
    });

    it('should return null for non-existent session', async () => {
      const subscription = await getSubscriptionBySessionId('cs_nonexistent');
      expect(subscription).toBeNull();
    });

    it('should detect session reuse (already used check)', async () => {
      const subscriptionData = {
        userId: 'user123',
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripeSessionId: 'cs_test_session',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        cancelAtPeriodEnd: false,
      };

      await createSubscription(subscriptionData);

      // Check if session is already used
      const existingSubscription = await getSubscriptionBySessionId('cs_test_session');
      expect(existingSubscription).not.toBeNull();

      // This would be the "already used" check in the application
      const alreadyUsed = existingSubscription !== null;
      expect(alreadyUsed).toBe(true);
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription status to past_due', async () => {
      const subscriptionData = {
        userId: 'user123',
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        cancelAtPeriodEnd: false,
      };

      await createSubscription(subscriptionData);

      const updated = await updateSubscription('user123', {
        status: SubscriptionStatus.PAST_DUE,
        lastPaymentError: new Date(),
      });

      expect(updated.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(updated.lastPaymentError).toBeInstanceOf(Date);
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it('should update cancelAtPeriodEnd flag', async () => {
      const subscriptionData = {
        userId: 'user123',
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        cancelAtPeriodEnd: false,
      };

      await createSubscription(subscriptionData);

      const updated = await updateSubscription('user123', {
        status: SubscriptionStatus.CANCELED,
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      });

      expect(updated.status).toBe(SubscriptionStatus.CANCELED);
      expect(updated.cancelAtPeriodEnd).toBe(true);
      expect(updated.canceledAt).toBeInstanceOf(Date);
    });

    it('should update subscription period end date', async () => {
      const subscriptionData = {
        userId: 'user123',
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        cancelAtPeriodEnd: false,
      };

      await createSubscription(subscriptionData);

      const newPeriodEnd = new Date('2024-03-01');
      const updated = await updateSubscription('user123', {
        currentPeriodEnd: newPeriodEnd,
      });

      expect(updated.currentPeriodEnd).toEqual(newPeriodEnd);
    });

    it('should throw error for non-existent subscription', async () => {
      await expect(
        updateSubscription('nonexistent', {
          status: SubscriptionStatus.CANCELED,
        }),
      ).rejects.toThrow(AuthError);
    });
  });

  describe('Subscription workflow scenarios', () => {
    it('should handle complete new subscription flow', async () => {
      // 1. Check session not already used
      const existingBeforeCreate = await getSubscriptionBySessionId('cs_new_session');
      expect(existingBeforeCreate).toBeNull();

      // 2. Create subscription after successful payment
      const subscription = await createSubscription({
        userId: 'new_user',
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_new',
        stripeSubscriptionId: 'sub_new',
        stripeSessionId: 'cs_new_session',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        cancelAtPeriodEnd: false,
      });

      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);

      // 3. Verify session is now used
      const existingAfterCreate = await getSubscriptionBySessionId('cs_new_session');
      expect(existingAfterCreate).not.toBeNull();

      // 4. Retrieve by user ID
      const retrieved = await getSubscription('new_user');
      expect(retrieved?.stripeSessionId).toBe('cs_new_session');
    });

    it('should handle subscription cancellation flow', async () => {
      // Create active subscription
      await createSubscription({
        userId: 'cancel_user',
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_cancel',
        stripeSubscriptionId: 'sub_cancel',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        cancelAtPeriodEnd: false,
      });

      // Update to canceled
      const updated = await updateSubscription('cancel_user', {
        status: SubscriptionStatus.CANCELED,
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      });

      expect(updated.status).toBe(SubscriptionStatus.CANCELED);
      expect(updated.canceledAt).toBeInstanceOf(Date);
    });

    it('should handle payment failure flow', async () => {
      // Create active subscription
      await createSubscription({
        userId: 'payment_fail_user',
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_fail',
        stripeSubscriptionId: 'sub_fail',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        cancelAtPeriodEnd: false,
      });

      // Update to past_due after payment failure
      const updated = await updateSubscription('payment_fail_user', {
        status: SubscriptionStatus.PAST_DUE,
        lastPaymentError: new Date(),
      });

      expect(updated.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(updated.lastPaymentError).toBeInstanceOf(Date);
    });
  });
});
