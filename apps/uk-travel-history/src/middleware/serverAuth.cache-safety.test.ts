import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  requirePaidFeature,
  isFeaturePremium,
  verifyAuth,
  AuthError,
} from './serverAuth';

/**
 * Cache Safety Tests for Server-Side Authorization
 *
 * These tests verify that:
 * 1. Authorization checks are never cached
 * 2. User-specific decisions are made per-request
 * 3. Edge Config failures result in safe defaults (fail-closed)
 * 4. No cross-user data leakage can occur
 */

// Mock dependencies
vi.mock('@vercel/edge-config', () => ({
  get: vi.fn(),
}));

vi.mock('@uth/auth-server', () => ({
  verifyToken: vi.fn(),
  getSubscription: vi.fn(),
  SubscriptionStatus: {
    ACTIVE: 'active',
    CANCELLED: 'cancelled',
    PAST_DUE: 'past_due',
  },
}));

vi.mock('@uth/features', () => ({
  isFeatureEnabled: vi.fn(),
  FEATURE_KEYS: {
    AUTH: 'auth',
  },
}));

vi.mock('@uth/utils', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { get as edgeConfigGet } from '@vercel/edge-config';
import {
  verifyToken,
  getSubscription,
  SubscriptionStatus,
} from '@uth/auth-server';
import { isFeatureEnabled } from '@uth/features';

describe('Server Auth - Cache Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isFeaturePremium', () => {
    it('should default to blocking (premium) when Edge Config unavailable', async () => {
      // Simulate Edge Config failure
      vi.mocked(edgeConfigGet).mockRejectedValue(new Error('Network error'));

      const isPremium = await isFeaturePremium('excel_export');

      // SECURITY: Fail-closed behavior - assume premium when config unavailable
      expect(isPremium).toBe(true);
    });

    it('should default to blocking when Edge Config returns empty list', async () => {
      // Edge Config returns empty array
      vi.mocked(edgeConfigGet).mockResolvedValue([]);

      const isPremium = await isFeaturePremium('excel_export');

      // SECURITY: Empty config = assume all features are premium
      expect(isPremium).toBe(true);
    });

    it('should correctly identify premium features', async () => {
      vi.mocked(edgeConfigGet).mockResolvedValue(['excel_export', 'pdf_import']);

      const isPremiumExport = await isFeaturePremium('excel_export');
      const isPremiumImport = await isFeaturePremium('pdf_import');
      const isPremiumBasic = await isFeaturePremium('basic_calculation');

      expect(isPremiumExport).toBe(true);
      expect(isPremiumImport).toBe(true);
      expect(isPremiumBasic).toBe(false);
    });

    it('should never cache results across different feature checks', async () => {
      // First call
      vi.mocked(edgeConfigGet).mockResolvedValue(['excel_export']);
      const result1 = await isFeaturePremium('excel_export');

      // Second call - Edge Config returns different data
      vi.mocked(edgeConfigGet).mockResolvedValue(['pdf_import']);
      const result2 = await isFeaturePremium('excel_export');

      // Results should reflect latest Edge Config state
      expect(result1).toBe(true);
      expect(result2).toBe(false);

      // Verify Edge Config was called twice (no caching)
      expect(edgeConfigGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyAuth', () => {
    it('should verify auth token for each request independently', async () => {
      // Mock auth feature as enabled
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);

      // First request - valid user
      vi.mocked(verifyToken).mockResolvedValue({
        uid: 'user1',
        email: 'user1@example.com',
        emailVerified: true,
      });
      vi.mocked(getSubscription).mockResolvedValue({
        status: SubscriptionStatus.ACTIVE,
        subscriptionId: 'sub_1',
        customerId: 'cus_1',
      });

      const request1 = new NextRequest('http://localhost/api/test', {
        headers: { Authorization: 'Bearer token1' },
      });

      const auth1 = await verifyAuth(request1);
      expect(auth1?.userId).toBe('user1');

      // Second request - different user
      vi.mocked(verifyToken).mockResolvedValue({
        uid: 'user2',
        email: 'user2@example.com',
        emailVerified: true,
      });
      vi.mocked(getSubscription).mockResolvedValue({
        status: SubscriptionStatus.ACTIVE,
        subscriptionId: 'sub_2',
        customerId: 'cus_2',
      });

      const request2 = new NextRequest('http://localhost/api/test', {
        headers: { Authorization: 'Bearer token2' },
      });

      const auth2 = await verifyAuth(request2);
      expect(auth2?.userId).toBe('user2');

      // CRITICAL: Each request must be verified independently
      expect(verifyToken).toHaveBeenCalledTimes(2);
      expect(getSubscription).toHaveBeenCalledTimes(2);
    });

    it('should reject requests with inactive subscriptions', async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      vi.mocked(verifyToken).mockResolvedValue({
        uid: 'user1',
        email: 'user1@example.com',
        emailVerified: true,
      });

      // Subscription is not active
      vi.mocked(getSubscription).mockResolvedValue({
        status: SubscriptionStatus.CANCELLED,
        subscriptionId: 'sub_1',
        customerId: 'cus_1',
      });

      const request = new NextRequest('http://localhost/api/test', {
        headers: { Authorization: 'Bearer token' },
      });

      await expect(verifyAuth(request)).rejects.toThrow(AuthError);
    });

    it('should handle missing Authorization header', async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/test');

      await expect(verifyAuth(request)).rejects.toThrow(AuthError);
    });

    it('should bypass auth when auth feature is disabled', async () => {
      // Auth feature flag is disabled
      vi.mocked(isFeatureEnabled).mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/test');

      const result = await verifyAuth(request);

      // Should return null (no auth required)
      expect(result).toBeNull();

      // Should not call Firebase
      expect(verifyToken).not.toHaveBeenCalled();
    });
  });

  describe('requirePaidFeature', () => {
    it('should block premium features without active subscription', async () => {
      // Feature is enabled and premium
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      vi.mocked(edgeConfigGet).mockResolvedValue(['excel_export']);

      // User has valid auth but no active subscription
      vi.mocked(verifyToken).mockResolvedValue({
        uid: 'user1',
        email: 'user1@example.com',
        emailVerified: true,
      });
      vi.mocked(getSubscription).mockResolvedValue({
        status: SubscriptionStatus.CANCELLED,
        subscriptionId: 'sub_1',
        customerId: 'cus_1',
      });

      const request = new NextRequest('http://localhost/api/export', {
        headers: { Authorization: 'Bearer token' },
      });

      // Should throw AuthError
      await expect(
        requirePaidFeature(request, 'excel_export'),
      ).rejects.toThrow(AuthError);
    });

    it('should allow free features without subscription', async () => {
      // Feature is enabled but not premium
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      vi.mocked(edgeConfigGet).mockResolvedValue(['excel_export']); // Other features are premium

      // Auth feature is disabled OR user has no subscription
      vi.mocked(isFeatureEnabled).mockImplementation((key: any) => {
        if (key === 'auth') return Promise.resolve(false);
        return Promise.resolve(true);
      });

      const request = new NextRequest('http://localhost/api/basic', {
        headers: { Authorization: 'Bearer token' },
      });

      // Should allow access to basic_calculation (free feature)
      const result = await requirePaidFeature(request, 'basic_calculation');

      expect(result).toBeDefined();
    });

    it('should allow premium features with active subscription', async () => {
      // Feature is enabled and premium
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      vi.mocked(edgeConfigGet).mockResolvedValue(['excel_export']);

      // User has active subscription
      vi.mocked(verifyToken).mockResolvedValue({
        uid: 'user1',
        email: 'user1@example.com',
        emailVerified: true,
      });
      vi.mocked(getSubscription).mockResolvedValue({
        status: SubscriptionStatus.ACTIVE,
        subscriptionId: 'sub_1',
        customerId: 'cus_1',
      });

      const request = new NextRequest('http://localhost/api/export', {
        headers: { Authorization: 'Bearer token' },
      });

      const result = await requirePaidFeature(request, 'excel_export');

      expect(result).toBeDefined();
      expect(result?.userId).toBe('user1');
    });

    it('should block access when feature is disabled via Edge Config', async () => {
      // Feature is disabled
      vi.mocked(isFeatureEnabled).mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/export', {
        headers: { Authorization: 'Bearer token' },
      });

      await expect(
        requirePaidFeature(request, 'excel_export'),
      ).rejects.toThrow('This feature is currently disabled');
    });

    it('should not cache authorization results between requests', async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      vi.mocked(edgeConfigGet).mockResolvedValue(['excel_export']);

      // Request 1: User with active subscription
      vi.mocked(verifyToken).mockResolvedValue({
        uid: 'user1',
        email: 'user1@example.com',
        emailVerified: true,
      });
      vi.mocked(getSubscription).mockResolvedValue({
        status: SubscriptionStatus.ACTIVE,
        subscriptionId: 'sub_1',
        customerId: 'cus_1',
      });

      const request1 = new NextRequest('http://localhost/api/export', {
        headers: { Authorization: 'Bearer token1' },
      });

      const result1 = await requirePaidFeature(request1, 'excel_export');
      expect(result1?.userId).toBe('user1');

      // Request 2: Different user, subscription cancelled
      vi.mocked(verifyToken).mockResolvedValue({
        uid: 'user2',
        email: 'user2@example.com',
        emailVerified: true,
      });
      vi.mocked(getSubscription).mockResolvedValue({
        status: SubscriptionStatus.CANCELLED,
        subscriptionId: 'sub_2',
        customerId: 'cus_2',
      });

      const request2 = new NextRequest('http://localhost/api/export', {
        headers: { Authorization: 'Bearer token2' },
      });

      // Should fail for user2 (no caching from user1)
      await expect(
        requirePaidFeature(request2, 'excel_export'),
      ).rejects.toThrow(AuthError);

      // Verify each request was independently verified
      expect(verifyToken).toHaveBeenCalledTimes(2);
      expect(getSubscription).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Config Integration', () => {
    it('should handle Edge Config latency gracefully', async () => {
      // Simulate slow Edge Config response
      vi.mocked(edgeConfigGet).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(['excel_export']), 100),
          ),
      );

      const isPremium = await isFeaturePremium('excel_export');

      expect(isPremium).toBe(true);
    });

    it('should handle Edge Config returning null', async () => {
      vi.mocked(edgeConfigGet).mockResolvedValue(null);

      const isPremium = await isFeaturePremium('excel_export');

      // Fail-closed: null config = assume premium
      expect(isPremium).toBe(true);
    });

    it('should handle Edge Config returning undefined', async () => {
      vi.mocked(edgeConfigGet).mockResolvedValue(undefined);

      const isPremium = await isFeaturePremium('excel_export');

      // Fail-closed: undefined config = assume premium
      expect(isPremium).toBe(true);
    });
  });
});

describe('Server Auth - No Shared State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not share subscription state between concurrent requests', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(edgeConfigGet).mockResolvedValue(['excel_export']);

    // Simulate concurrent requests for different users
    const promises = [];

    // User 1: Active subscription
    vi.mocked(verifyToken).mockResolvedValueOnce({
      uid: 'user1',
      email: 'user1@example.com',
      emailVerified: true,
    });
    vi.mocked(getSubscription).mockResolvedValueOnce({
      status: SubscriptionStatus.ACTIVE,
      subscriptionId: 'sub_1',
      customerId: 'cus_1',
    });

    const request1 = new NextRequest('http://localhost/api/export', {
      headers: { Authorization: 'Bearer token1' },
    });
    promises.push(requirePaidFeature(request1, 'excel_export'));

    // User 2: Cancelled subscription
    vi.mocked(verifyToken).mockResolvedValueOnce({
      uid: 'user2',
      email: 'user2@example.com',
      emailVerified: true,
    });
    vi.mocked(getSubscription).mockResolvedValueOnce({
      status: SubscriptionStatus.CANCELLED,
      subscriptionId: 'sub_2',
      customerId: 'cus_2',
    });

    const request2 = new NextRequest('http://localhost/api/export', {
      headers: { Authorization: 'Bearer token2' },
    });
    promises.push(
      requirePaidFeature(request2, 'excel_export').catch((e) => e),
    );

    const [result1, result2] = await Promise.all(promises);

    // User 1 should succeed
    expect(result1).toBeDefined();
    expect((result1 as any).userId).toBe('user1');

    // User 2 should fail
    expect(result2).toBeInstanceOf(AuthError);
  });
});
