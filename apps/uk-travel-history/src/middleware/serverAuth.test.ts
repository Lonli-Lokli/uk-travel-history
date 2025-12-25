import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { get } from '@vercel/edge-config';
import {
  verifyAuth,
  requirePaidFeature,
  isFeaturePremium,
  AuthError,
  createAuthErrorResponse,
} from './serverAuth';
import {
  verifyToken,
  getSubscription,
  SubscriptionStatus,
} from '@uth/auth-server';
import { isFeatureEnabled } from '@uth/features';

// Mock dependencies
vi.mock('@vercel/edge-config', () => ({
  get: vi.fn(),
}));

vi.mock('@uth/auth-server', () => ({
  verifyToken: vi.fn(),
  getSubscription: vi.fn(),
  SubscriptionStatus: {
    ACTIVE: 'ACTIVE',
    CANCELED: 'CANCELED',
    PAST_DUE: 'PAST_DUE',
  },
}));

vi.mock('@uth/features', () => ({
  isFeatureEnabled: vi.fn(),
  FEATURE_KEYS: {
    MONETIZATION: 'monetization',
    AUTH: 'auth',
    PAYMENTS: 'payments',
    EXCEL_EXPORT: 'excel_export',
    EXCEL_IMPORT: 'excel_import',
    PDF_IMPORT: 'pdf_import',
    CLIPBOARD_IMPORT: 'clipboard_import',
    RISK_CHART: 'risk_chart',
  },
}));

vi.mock('@uth/utils', () => ({
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

describe('Server Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (authToken?: string): NextRequest => {
    const headers = new Headers();
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
    return new NextRequest('https://example.com/api/test', { headers });
  };

  describe('verifyAuth', () => {
    it('should throw AuthError when Authorization header is missing', async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      const request = createMockRequest();

      await expect(verifyAuth(request)).rejects.toThrow(AuthError);
      await expect(verifyAuth(request)).rejects.toThrow(
        'Missing or invalid Authorization header',
      );
    });

    it('should throw AuthError when Authorization header is invalid', async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      const headers = new Headers();
      headers.set('Authorization', 'InvalidFormat');
      const request = new NextRequest('https://example.com/api/test', {
        headers,
      });

      await expect(verifyAuth(request)).rejects.toThrow(AuthError);
    });

    it('should verify token and check subscription status', async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      vi.mocked(verifyToken).mockResolvedValue({
        uid: 'user123',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getSubscription).mockResolvedValue({
        id: 'sub_123',
        userId: 'user123',
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripePriceId: 'price_123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      });

      const request = createMockRequest('valid-token');
      const result = await verifyAuth(request);

      expect(result).toEqual({
        userId: 'user123',
        email: 'test@example.com',
        emailVerified: true,
      });
      expect(verifyToken).toHaveBeenCalledWith('valid-token');
    });

    it('should throw AuthError when subscription does not exist', async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      vi.mocked(verifyToken).mockResolvedValue({
        uid: 'user123',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getSubscription).mockResolvedValue(null);

      const request = createMockRequest('valid-token');

      await expect(verifyAuth(request)).rejects.toThrow(AuthError);
      await expect(verifyAuth(request)).rejects.toThrow(
        'No active subscription found',
      );
    });

    it('should throw AuthError when subscription is not active', async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      vi.mocked(verifyToken).mockResolvedValue({
        uid: 'user123',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getSubscription).mockResolvedValue({
        id: 'sub_123',
        userId: 'user123',
        status: SubscriptionStatus.CANCELED,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripePriceId: 'price_123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      });

      const request = createMockRequest('valid-token');

      await expect(verifyAuth(request)).rejects.toThrow(AuthError);
      await expect(verifyAuth(request)).rejects.toThrow(
        'Subscription not active',
      );
    });
  });

  describe('isFeaturePremium', () => {
    it('should return true when feature is in premium_features list', async () => {
      vi.mocked(get).mockResolvedValue(['excel_export', 'pdf_export']);

      const result = await isFeaturePremium('excel_export');
      expect(result).toBe(true);
    });

    it('should return false when feature is not in premium_features list', async () => {
      vi.mocked(get).mockResolvedValue(['excel_export', 'pdf_export']);

      const result = await isFeaturePremium('basic_calculation');
      expect(result).toBe(false);
    });

    it('should fail-closed when Edge Config is unavailable', async () => {
      vi.mocked(get).mockResolvedValue(null);

      const result = await isFeaturePremium('any_feature');
      expect(result).toBe(true); // Blocks access when config unavailable
    });

    it('should fail-closed when Edge Config returns empty array', async () => {
      vi.mocked(get).mockResolvedValue([]);

      const result = await isFeaturePremium('any_feature');
      expect(result).toBe(true); // Blocks access when config is empty
    });

    it('should fail-closed on error', async () => {
      vi.mocked(get).mockRejectedValue(new Error('Network error'));

      const result = await isFeaturePremium('any_feature');
      expect(result).toBe(true); // Blocks access on error
    });
  });

  describe('requirePaidFeature', () => {
    const setupMocks = (
      subscriptionStatus: 'ACTIVE' | 'CANCELED' = 'ACTIVE',
      featureEnabled = true,
      isPremiumFeature = true,
    ) => {
      vi.mocked(verifyToken).mockResolvedValue({
        uid: 'user123',
        email: 'test@example.com',
        emailVerified: true,
      });

      vi.mocked(getSubscription).mockResolvedValue({
        id: 'sub_123',
        userId: 'user123',
        status: subscriptionStatus === 'ACTIVE' ? SubscriptionStatus.ACTIVE : SubscriptionStatus.CANCELED,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripePriceId: 'price_123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      });

      vi.mocked(isFeatureEnabled).mockResolvedValue(featureEnabled);

      // Setup premium features list
      if (isPremiumFeature) {
        vi.mocked(get).mockResolvedValue(['excel_export']);
      } else {
        vi.mocked(get).mockResolvedValue([]);
      }
    };

    it('should throw AuthError when feature is disabled', async () => {
      setupMocks('ACTIVE', false, true);

      const request = createMockRequest('valid-token');

      await expect(requirePaidFeature(request, 'excel_export')).rejects.toThrow(
        AuthError,
      );
      await expect(requirePaidFeature(request, 'excel_export')).rejects.toThrow(
        'This feature is currently disabled',
      );
    });

    it('should allow access when feature is enabled and user has active subscription', async () => {
      setupMocks('ACTIVE', true, true);

      const request = createMockRequest('valid-token');
      const result = await requirePaidFeature(request, 'excel_export');

      expect(result).toEqual({
        userId: 'user123',
        email: 'test@example.com',
        emailVerified: true,
      });
      expect(isFeatureEnabled).toHaveBeenCalledWith('excel_export');
    });

    it('should allow access to free features even without checking subscription', async () => {
      setupMocks('ACTIVE', true, false);

      const request = createMockRequest('valid-token');
      const result = await requirePaidFeature(request, 'basic_calculation');

      expect(result).toEqual({
        userId: 'user123',
        email: 'test@example.com',
        emailVerified: true,
      });
    });

    it('should throw AuthError when subscription is not active', async () => {
      setupMocks('CANCELED', true, true);

      const request = createMockRequest('valid-token');

      await expect(requirePaidFeature(request, 'excel_export')).rejects.toThrow(
        AuthError,
      );
      await expect(requirePaidFeature(request, 'excel_export')).rejects.toThrow(
        'Subscription not active',
      );
    });

    it('should check feature enablement before authentication', async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(false);

      const request = createMockRequest('valid-token');

      await expect(requirePaidFeature(request, 'excel_export')).rejects.toThrow(
        'This feature is currently disabled',
      );

      // Verify authentication was NOT called since feature is disabled
      expect(verifyToken).not.toHaveBeenCalled();
    });

    it('should handle missing auth token for disabled feature', async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(false);

      const request = createMockRequest(); // No auth token

      await expect(requirePaidFeature(request, 'excel_export')).rejects.toThrow(
        'This feature is currently disabled',
      );

      // Should fail on feature check, not auth
      expect(verifyToken).not.toHaveBeenCalled();
    });
  });

  describe('AuthError', () => {
    it('should create error with correct properties', () => {
      const error = new AuthError('Test error', 403);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('AuthError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('createAuthErrorResponse', () => {
    it('should create response from AuthError', () => {
      const error = new AuthError('Unauthorized', 401);
      const response = createAuthErrorResponse(error);

      expect(response.status).toBe(401);
    });

    it('should handle non-AuthError gracefully', () => {
      const error = new Error('Unexpected error');
      const response = createAuthErrorResponse(error);

      expect(response.status).toBe(500);
    });
  });

  describe('Integration: Feature Flag + Premium Check', () => {
    it('should enforce both feature enablement AND premium status', async () => {
      vi.mocked(verifyToken).mockResolvedValue({
        uid: 'user123',
        email: 'test@example.com',
        emailVerified: true,
      });

      vi.mocked(getSubscription).mockResolvedValue({
        id: 'sub_123',
        userId: 'user123',
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripePriceId: 'price_123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      });

      // Feature is premium but disabled
      vi.mocked(get).mockResolvedValue(['excel_export']);
      vi.mocked(isFeatureEnabled).mockResolvedValue(false);

      const request = createMockRequest('valid-token');

      await expect(requirePaidFeature(request, 'excel_export')).rejects.toThrow(
        'This feature is currently disabled',
      );

      // Now enable the feature - should succeed
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      const result = await requirePaidFeature(request, 'excel_export');

      expect(result.userId).toBe('user123');
    });
  });
});
