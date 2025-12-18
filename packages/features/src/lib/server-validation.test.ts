import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from '@vercel/edge-config';
import {
  validateFeatureAccess,
  isPremiumFeature,
  getAccessibleFeatures,
  type UserTier,
} from './server-validation';
import { FEATURES } from './features';
import type { EdgeConfigFlags } from './edgeConfigFlags';

// Mock @vercel/edge-config
vi.mock('@vercel/edge-config', () => ({
  get: vi.fn(),
}));

describe('Server-Side Feature Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Enable all features by default
    const allFeatures: EdgeConfigFlags = {
      [FEATURES.BASIC_CALCULATION]: { enabled: true },
      [FEATURES.PDF_IMPORT]: { enabled: true },
      [FEATURES.CSV_IMPORT]: { enabled: true },
      [FEATURES.MANUAL_ENTRY]: { enabled: true },
      [FEATURES.EXCEL_EXPORT]: { enabled: true },
      [FEATURES.PDF_EXPORT]: { enabled: true },
      [FEATURES.EMPLOYER_LETTERS]: { enabled: true },
      [FEATURES.CLOUD_SYNC]: { enabled: true },
      [FEATURES.ADVANCED_ANALYTICS]: { enabled: true },
    };
    vi.mocked(get).mockResolvedValue(allFeatures);
  });

  describe('validateFeatureAccess', () => {
    describe('Free tier users', () => {
      const freeUser: UserTier = {
        userId: 'user123',
        tier: 'free',
      };

      it('should allow access to free features', async () => {
        const result = await validateFeatureAccess(
          FEATURES.BASIC_CALCULATION,
          freeUser
        );
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should deny access to premium features', async () => {
        const result = await validateFeatureAccess(
          FEATURES.EXCEL_EXPORT,
          freeUser
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('tier_restriction');
      });

      it('should allow all free tier features', async () => {
        const freeFeatures = [
          FEATURES.BASIC_CALCULATION,
          FEATURES.PDF_IMPORT,
          FEATURES.CSV_IMPORT,
          FEATURES.MANUAL_ENTRY,
        ];

        for (const feature of freeFeatures) {
          const result = await validateFeatureAccess(feature, freeUser);
          expect(result.allowed).toBe(true);
        }
      });

      it('should deny all premium-only features', async () => {
        const premiumFeatures = [
          FEATURES.EXCEL_EXPORT,
          FEATURES.PDF_EXPORT,
          FEATURES.EMPLOYER_LETTERS,
          FEATURES.CLOUD_SYNC,
          FEATURES.ADVANCED_ANALYTICS,
        ];

        for (const feature of premiumFeatures) {
          const result = await validateFeatureAccess(feature, freeUser);
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('tier_restriction');
        }
      });
    });

    describe('Premium tier users', () => {
      const premiumUser: UserTier = {
        userId: 'user456',
        tier: 'premium',
        subscriptionActive: true,
      };

      it('should allow access to all features', async () => {
        const allFeatures = Object.values(FEATURES);

        for (const feature of allFeatures) {
          const result = await validateFeatureAccess(feature, premiumUser);
          expect(result.allowed).toBe(true);
        }
      });

      it('should deny access if subscription is not active', async () => {
        const inactiveUser: UserTier = {
          userId: 'user789',
          tier: 'premium',
          subscriptionActive: false,
        };

        const result = await validateFeatureAccess(
          FEATURES.EXCEL_EXPORT,
          inactiveUser
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('no_subscription');
      });

      it('should allow access to free features even without active subscription', async () => {
        const inactiveUser: UserTier = {
          userId: 'user789',
          tier: 'premium',
          subscriptionActive: false,
        };

        const result = await validateFeatureAccess(
          FEATURES.BASIC_CALCULATION,
          inactiveUser
        );
        // Free features don't require subscription
        expect(result.allowed).toBe(true);
      });
    });

    describe('Feature flag disabled', () => {
      it('should deny access when feature is disabled in Edge Config', async () => {
        vi.mocked(get).mockResolvedValue({
          [FEATURES.EXCEL_EXPORT]: { enabled: false },
        });

        const premiumUser: UserTier = {
          userId: 'user456',
          tier: 'premium',
          subscriptionActive: true,
        };

        const result = await validateFeatureAccess(
          FEATURES.EXCEL_EXPORT,
          premiumUser
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('feature_disabled');
      });

      it('should deny access to all users when feature is disabled', async () => {
        vi.mocked(get).mockResolvedValue({
          [FEATURES.BASIC_CALCULATION]: { enabled: false },
        });

        const freeUser: UserTier = { userId: 'user123', tier: 'free' };
        const premiumUser: UserTier = {
          userId: 'user456',
          tier: 'premium',
          subscriptionActive: true,
        };

        const freeResult = await validateFeatureAccess(
          FEATURES.BASIC_CALCULATION,
          freeUser
        );
        const premiumResult = await validateFeatureAccess(
          FEATURES.BASIC_CALCULATION,
          premiumUser
        );

        expect(freeResult.allowed).toBe(false);
        expect(freeResult.reason).toBe('feature_disabled');
        expect(premiumResult.allowed).toBe(false);
        expect(premiumResult.reason).toBe('feature_disabled');
      });
    });

    describe('Beta users and rollout', () => {
      it('should allow beta users even with 0% rollout', async () => {
        vi.mocked(get).mockResolvedValue({
          [FEATURES.EXCEL_EXPORT]: {
            enabled: true,
            rolloutPercentage: 0,
            betaUsers: ['beta_user'],
          },
        });

        const betaUser: UserTier = {
          userId: 'beta_user',
          tier: 'premium',
          subscriptionActive: true,
        };

        const result = await validateFeatureAccess(
          FEATURES.EXCEL_EXPORT,
          betaUser
        );
        expect(result.allowed).toBe(true);
      });

      it('should respect rollout percentage for non-beta users', async () => {
        vi.mocked(get).mockResolvedValue({
          [FEATURES.EXCEL_EXPORT]: {
            enabled: true,
            rolloutPercentage: 0,
          },
        });

        const normalUser: UserTier = {
          userId: 'user999',
          tier: 'premium',
          subscriptionActive: true,
        };

        const result = await validateFeatureAccess(
          FEATURES.EXCEL_EXPORT,
          normalUser
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('feature_disabled');
      });
    });
  });

  describe('isPremiumFeature', () => {
    it('should return false for free tier features', () => {
      expect(isPremiumFeature(FEATURES.BASIC_CALCULATION)).toBe(false);
      expect(isPremiumFeature(FEATURES.PDF_IMPORT)).toBe(false);
      expect(isPremiumFeature(FEATURES.CSV_IMPORT)).toBe(false);
      expect(isPremiumFeature(FEATURES.MANUAL_ENTRY)).toBe(false);
    });

    it('should return true for premium-only features', () => {
      expect(isPremiumFeature(FEATURES.EXCEL_EXPORT)).toBe(true);
      expect(isPremiumFeature(FEATURES.PDF_EXPORT)).toBe(true);
      expect(isPremiumFeature(FEATURES.EMPLOYER_LETTERS)).toBe(true);
      expect(isPremiumFeature(FEATURES.CLOUD_SYNC)).toBe(true);
      expect(isPremiumFeature(FEATURES.ADVANCED_ANALYTICS)).toBe(true);
    });
  });

  describe('getAccessibleFeatures', () => {
    it('should return only free features for free users', async () => {
      const freeUser: UserTier = {
        userId: 'user123',
        tier: 'free',
      };

      const features = await getAccessibleFeatures(freeUser);

      expect(features).toContain(FEATURES.BASIC_CALCULATION);
      expect(features).toContain(FEATURES.PDF_IMPORT);
      expect(features).toContain(FEATURES.CSV_IMPORT);
      expect(features).toContain(FEATURES.MANUAL_ENTRY);
      expect(features).not.toContain(FEATURES.EXCEL_EXPORT);
      expect(features.length).toBe(4);
    });

    it('should return all features for premium users with active subscription', async () => {
      const premiumUser: UserTier = {
        userId: 'user456',
        tier: 'premium',
        subscriptionActive: true,
      };

      const features = await getAccessibleFeatures(premiumUser);

      expect(features.length).toBe(Object.values(FEATURES).length);
      Object.values(FEATURES).forEach((feature) => {
        expect(features).toContain(feature);
      });
    });

    it('should exclude disabled features', async () => {
      vi.mocked(get).mockResolvedValue({
        [FEATURES.BASIC_CALCULATION]: { enabled: true },
        [FEATURES.PDF_IMPORT]: { enabled: false }, // Disabled
        [FEATURES.CSV_IMPORT]: { enabled: true },
        [FEATURES.MANUAL_ENTRY]: { enabled: true },
      });

      const freeUser: UserTier = {
        userId: 'user123',
        tier: 'free',
      };

      const features = await getAccessibleFeatures(freeUser);

      expect(features).toContain(FEATURES.BASIC_CALCULATION);
      expect(features).not.toContain(FEATURES.PDF_IMPORT);
      expect(features).toContain(FEATURES.CSV_IMPORT);
      expect(features).toContain(FEATURES.MANUAL_ENTRY);
    });

    it('should return empty array if all features are disabled', async () => {
      vi.mocked(get).mockResolvedValue({
        [FEATURES.BASIC_CALCULATION]: { enabled: false },
        [FEATURES.PDF_IMPORT]: { enabled: false },
        [FEATURES.CSV_IMPORT]: { enabled: false },
        [FEATURES.MANUAL_ENTRY]: { enabled: false },
      });

      const freeUser: UserTier = {
        userId: 'user123',
        tier: 'free',
      };

      const features = await getAccessibleFeatures(freeUser);
      expect(features).toEqual([]);
    });

    it('should respect beta users', async () => {
      vi.mocked(get).mockResolvedValue({
        [FEATURES.EXCEL_EXPORT]: {
          enabled: true,
          rolloutPercentage: 0,
          betaUsers: ['beta_user'],
        },
      });

      const betaUser: UserTier = {
        userId: 'beta_user',
        tier: 'premium',
        subscriptionActive: true,
      };

      const features = await getAccessibleFeatures(betaUser);
      expect(features).toContain(FEATURES.EXCEL_EXPORT);
    });
  });

  describe('Security Tests', () => {
    it('should never allow premium features for free users regardless of flags', async () => {
      // Even if we try to manipulate flags
      const freeUser: UserTier = {
        userId: 'hacker',
        tier: 'free',
      };

      const premiumFeatures = [
        FEATURES.EXCEL_EXPORT,
        FEATURES.PDF_EXPORT,
        FEATURES.EMPLOYER_LETTERS,
      ];

      for (const feature of premiumFeatures) {
        const result = await validateFeatureAccess(feature, freeUser);
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('tier_restriction');
      }
    });

    it('should require active subscription for premium tier users', async () => {
      const expiredUser: UserTier = {
        userId: 'expired',
        tier: 'premium',
        subscriptionActive: false,
      };

      const result = await validateFeatureAccess(
        FEATURES.EXCEL_EXPORT,
        expiredUser
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('no_subscription');
    });
  });
});
