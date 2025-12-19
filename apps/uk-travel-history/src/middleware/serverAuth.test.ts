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
import { getAdminAuth, getAdminFirestore } from '@uth/firebase-server';
import { isFeatureEnabled } from '@uth/features';

// Mock dependencies
vi.mock('@vercel/edge-config', () => ({
  get: vi.fn(),
}));

vi.mock('@uth/firebase-server', () => ({
  getAdminAuth: vi.fn(),
  getAdminFirestore: vi.fn(),
}));

vi.mock('@uth/features', () => ({
  isFeatureEnabled: vi.fn(),
}));

vi.mock('@uth/utils', () => ({
  logger: {
    log: vi.fn(),
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
      const request = createMockRequest();

      await expect(verifyAuth(request)).rejects.toThrow(AuthError);
      await expect(verifyAuth(request)).rejects.toThrow(
        'Missing or invalid Authorization header'
      );
    });

    it('should throw AuthError when Authorization header is invalid', async () => {
      const headers = new Headers();
      headers.set('Authorization', 'InvalidFormat');
      const request = new NextRequest('https://example.com/api/test', {
        headers,
      });

      await expect(verifyAuth(request)).rejects.toThrow(AuthError);
    });

    it('should verify token and check subscription status', async () => {
      const mockAuth = {
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'user123',
          email: 'test@example.com',
          email_verified: true,
        }),
      };

      const mockDoc = {
        exists: true,
        data: () => ({ status: 'active' }),
      };

      const mockFirestore = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockDoc),
          }),
        }),
      };

      vi.mocked(getAdminAuth).mockReturnValue(mockAuth as any);
      vi.mocked(getAdminFirestore).mockReturnValue(mockFirestore as any);

      const request = createMockRequest('valid-token');
      const result = await verifyAuth(request);

      expect(result).toEqual({
        userId: 'user123',
        email: 'test@example.com',
        emailVerified: true,
      });
      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid-token', true);
    });

    it('should throw AuthError when subscription does not exist', async () => {
      const mockAuth = {
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'user123',
          email: 'test@example.com',
        }),
      };

      const mockDoc = {
        exists: false,
      };

      const mockFirestore = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockDoc),
          }),
        }),
      };

      vi.mocked(getAdminAuth).mockReturnValue(mockAuth as any);
      vi.mocked(getAdminFirestore).mockReturnValue(mockFirestore as any);

      const request = createMockRequest('valid-token');

      await expect(verifyAuth(request)).rejects.toThrow(AuthError);
      await expect(verifyAuth(request)).rejects.toThrow(
        'No active subscription found'
      );
    });

    it('should throw AuthError when subscription is not active', async () => {
      const mockAuth = {
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'user123',
          email: 'test@example.com',
        }),
      };

      const mockDoc = {
        exists: true,
        data: () => ({ status: 'canceled' }),
      };

      const mockFirestore = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockDoc),
          }),
        }),
      };

      vi.mocked(getAdminAuth).mockReturnValue(mockAuth as any);
      vi.mocked(getAdminFirestore).mockReturnValue(mockFirestore as any);

      const request = createMockRequest('valid-token');

      await expect(verifyAuth(request)).rejects.toThrow(AuthError);
      await expect(verifyAuth(request)).rejects.toThrow(
        'Subscription not active'
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
      subscriptionStatus: string = 'active',
      featureEnabled: boolean = true,
      isPremiumFeature: boolean = true
    ) => {
      const mockAuth = {
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'user123',
          email: 'test@example.com',
          email_verified: true,
        }),
      };

      const mockDoc = {
        exists: true,
        data: () => ({ status: subscriptionStatus }),
      };

      const mockFirestore = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockDoc),
          }),
        }),
      };

      vi.mocked(getAdminAuth).mockReturnValue(mockAuth as any);
      vi.mocked(getAdminFirestore).mockReturnValue(mockFirestore as any);
      vi.mocked(isFeatureEnabled).mockResolvedValue(featureEnabled);

      // Setup premium features list
      if (isPremiumFeature) {
        vi.mocked(get).mockResolvedValue(['excel_export']);
      } else {
        vi.mocked(get).mockResolvedValue([]);
      }
    };

    it('should throw AuthError when feature is disabled', async () => {
      setupMocks('active', false, true);

      const request = createMockRequest('valid-token');

      await expect(
        requirePaidFeature(request, 'excel_export')
      ).rejects.toThrow(AuthError);
      await expect(
        requirePaidFeature(request, 'excel_export')
      ).rejects.toThrow('This feature is currently disabled');
    });

    it('should allow access when feature is enabled and user has active subscription', async () => {
      setupMocks('active', true, true);

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
      setupMocks('active', true, false);

      const request = createMockRequest('valid-token');
      const result = await requirePaidFeature(request, 'basic_calculation');

      expect(result).toEqual({
        userId: 'user123',
        email: 'test@example.com',
        emailVerified: true,
      });
    });

    it('should throw AuthError when subscription is not active', async () => {
      setupMocks('canceled', true, true);

      const request = createMockRequest('valid-token');

      await expect(
        requirePaidFeature(request, 'excel_export')
      ).rejects.toThrow(AuthError);
      await expect(
        requirePaidFeature(request, 'excel_export')
      ).rejects.toThrow('Subscription not active');
    });

    it('should check feature enablement before authentication', async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(false);

      const request = createMockRequest('valid-token');

      await expect(
        requirePaidFeature(request, 'excel_export')
      ).rejects.toThrow('This feature is currently disabled');

      // Verify authentication was NOT called since feature is disabled
      expect(getAdminAuth).not.toHaveBeenCalled();
    });

    it('should handle missing auth token for disabled feature', async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(false);

      const request = createMockRequest(); // No auth token

      await expect(
        requirePaidFeature(request, 'excel_export')
      ).rejects.toThrow('This feature is currently disabled');

      // Should fail on feature check, not auth
      expect(getAdminAuth).not.toHaveBeenCalled();
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
      const mockAuth = {
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'user123',
          email: 'test@example.com',
          email_verified: true,
        }),
      };

      const mockDoc = {
        exists: true,
        data: () => ({ status: 'active' }),
      };

      const mockFirestore = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockDoc),
          }),
        }),
      };

      vi.mocked(getAdminAuth).mockReturnValue(mockAuth as any);
      vi.mocked(getAdminFirestore).mockReturnValue(mockFirestore as any);

      // Feature is premium but disabled
      vi.mocked(get).mockResolvedValue(['excel_export']);
      vi.mocked(isFeatureEnabled).mockResolvedValue(false);

      const request = createMockRequest('valid-token');

      await expect(
        requirePaidFeature(request, 'excel_export')
      ).rejects.toThrow('This feature is currently disabled');

      // Now enable the feature - should succeed
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      const result = await requirePaidFeature(request, 'excel_export');

      expect(result.userId).toBe('user123');
    });
  });
});
