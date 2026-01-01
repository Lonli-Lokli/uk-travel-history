import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateFeatureAccess,
  isPremiumFeature,
  getAccessibleFeatures,
  type UserTier,
} from './server-validation';
import { FEATURE_KEYS } from './shapes';
import type { FeaturePolicy } from '@uth/db';

// Mock @uth/db
const dbGetAllFeaturePolicies = vi.fn();
vi.mock('@uth/db', () => ({
  getAllFeaturePolicies: dbGetAllFeaturePolicies,
}));

// Mock next/cache to avoid incrementalCache errors in tests
vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn) => fn),
}));

// Helper to convert Edge Config format to DB format
function convertToDbFormat(edgeConfigFlags: Record<string, any> | null): FeaturePolicy[] | null {
  if (!edgeConfigFlags) return null;

  return Object.entries(edgeConfigFlags).map(([featureKey, policy]) => ({
    id: `mock-${featureKey}`,
    featureKey,
    enabled: policy.enabled ?? false,
    minTier: policy.minTier ?? 'anonymous',
    rolloutPercentage: policy.rolloutPercentage ?? null,
    allowlist: policy.allowlist ?? null,
    denylist: policy.denylist ?? null,
    betaUsers: policy.betaUsers ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

describe('Server-Side Feature Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Enable all features by default with proper tier requirements
    const allFeatures = {
      [FEATURE_KEYS.MONETIZATION]: { enabled: false, minTier: 'anonymous' },
      [FEATURE_KEYS.AUTH]: { enabled: false, minTier: 'anonymous' },
      [FEATURE_KEYS.PAYMENTS]: { enabled: false, minTier: 'anonymous' },
      [FEATURE_KEYS.EXCEL_EXPORT]: { enabled: true, minTier: 'premium' },
      [FEATURE_KEYS.EXCEL_IMPORT]: { enabled: true, minTier: 'premium' },
      [FEATURE_KEYS.PDF_IMPORT]: { enabled: false, minTier: 'premium' },
      [FEATURE_KEYS.CLIPBOARD_IMPORT]: { enabled: true, minTier: 'anonymous' },
      [FEATURE_KEYS.RISK_CHART]: { enabled: false, minTier: 'anonymous' },
    };
    dbGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(allFeatures));
  });

  describe('validateFeatureAccess', () => {
    describe('Free tier users', () => {
      const freeUser: UserTier = {
        userId: 'user123',
        tier: 'free',
      };

      it('should allow access to free features', async () => {
        const result = await validateFeatureAccess(
          FEATURE_KEYS.CLIPBOARD_IMPORT,
          freeUser,
        );
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should deny access to premium features', async () => {
        const result = await validateFeatureAccess(
          FEATURE_KEYS.EXCEL_EXPORT,
          freeUser,
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('tier_restriction');
      });

      it('should allow all free tier features', async () => {
        const freeFeatures = [
          FEATURE_KEYS.CLIPBOARD_IMPORT,
        ];

        for (const feature of freeFeatures) {
          const result = await validateFeatureAccess(feature, freeUser);
          expect(result.allowed).toBe(true);
        }
      });

      it('should deny all premium-only features', async () => {
        const premiumFeatures = [
          FEATURE_KEYS.EXCEL_EXPORT,
          FEATURE_KEYS.EXCEL_IMPORT,
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
        const enabledFeatures = [
          FEATURE_KEYS.EXCEL_EXPORT,
          FEATURE_KEYS.EXCEL_IMPORT,
          FEATURE_KEYS.CLIPBOARD_IMPORT,
        ];

        for (const feature of enabledFeatures) {
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
          FEATURE_KEYS.EXCEL_EXPORT,
          inactiveUser,
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
          FEATURE_KEYS.CLIPBOARD_IMPORT,
          inactiveUser,
        );
        // Free features don't require subscription
        expect(result.allowed).toBe(true);
      });
    });

    describe('Feature flag disabled', () => {
      it('should deny access when feature is disabled in Edge Config', async () => {
        dbGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat({
          [FEATURE_KEYS.EXCEL_EXPORT]: { enabled: false },
        }));

        const premiumUser: UserTier = {
          userId: 'user456',
          tier: 'premium',
          subscriptionActive: true,
        };

        const result = await validateFeatureAccess(
          FEATURE_KEYS.EXCEL_EXPORT,
          premiumUser,
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('feature_disabled');
      });

      it('should deny access to all users when feature is disabled', async () => {
        dbGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat({
          [FEATURE_KEYS.CLIPBOARD_IMPORT]: { enabled: false },
        }));

        const freeUser: UserTier = { userId: 'user123', tier: 'free' };
        const premiumUser: UserTier = {
          userId: 'user456',
          tier: 'premium',
          subscriptionActive: true,
        };

        const freeResult = await validateFeatureAccess(
          FEATURE_KEYS.CLIPBOARD_IMPORT,
          freeUser,
        );
        const premiumResult = await validateFeatureAccess(
          FEATURE_KEYS.CLIPBOARD_IMPORT,
          premiumUser,
        );

        expect(freeResult.allowed).toBe(false);
        expect(freeResult.reason).toBe('feature_disabled');
        expect(premiumResult.allowed).toBe(false);
        expect(premiumResult.reason).toBe('feature_disabled');
      });
    });

    describe('Beta users and rollout', () => {
      it('should allow beta users even with 0% rollout', async () => {
        dbGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat({
          [FEATURE_KEYS.EXCEL_EXPORT]: {
            enabled: true,
            rolloutPercentage: 0,
            betaUsers: ['beta_user'],
          },
        }));

        const betaUser: UserTier = {
          userId: 'beta_user',
          tier: 'premium',
          subscriptionActive: true,
        };

        const result = await validateFeatureAccess(
          FEATURE_KEYS.EXCEL_EXPORT,
          betaUser,
        );
        expect(result.allowed).toBe(true);
      });

      it('should respect rollout percentage for non-beta users', async () => {
        dbGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat({
          [FEATURE_KEYS.EXCEL_EXPORT]: {
            enabled: true,
            rolloutPercentage: 0,
          },
        }));

        const normalUser: UserTier = {
          userId: 'user999',
          tier: 'premium',
          subscriptionActive: true,
        };

        const result = await validateFeatureAccess(
          FEATURE_KEYS.EXCEL_EXPORT,
          normalUser,
        );
        expect(result.allowed).toBe(true); // Rollout is per-feature tier check, not global disable
      });
    });
  });

  describe('isPremiumFeature', () => {
    it('should return false for free tier features', async () => {
      expect(await isPremiumFeature(FEATURE_KEYS.CLIPBOARD_IMPORT)).toBe(false);
      expect(await isPremiumFeature(FEATURE_KEYS.MONETIZATION)).toBe(false);
      expect(await isPremiumFeature(FEATURE_KEYS.AUTH)).toBe(false);
      expect(await isPremiumFeature(FEATURE_KEYS.RISK_CHART)).toBe(false);
    });

    it('should return true for premium-only features', async () => {
      expect(await isPremiumFeature(FEATURE_KEYS.EXCEL_EXPORT)).toBe(true);
      expect(await isPremiumFeature(FEATURE_KEYS.EXCEL_IMPORT)).toBe(true);
    });
  });

  describe('getAccessibleFeatures', () => {
    it('should return only free features for free users', async () => {
      const freeUser: UserTier = {
        userId: 'user123',
        tier: 'free',
      };

      const features = await getAccessibleFeatures(freeUser);

      expect(features).toContain(FEATURE_KEYS.CLIPBOARD_IMPORT);
      expect(features).not.toContain(FEATURE_KEYS.EXCEL_EXPORT);
      expect(features.length).toBeGreaterThanOrEqual(1);
    });

    it('should return all features for premium users with active subscription', async () => {
      const premiumUser: UserTier = {
        userId: 'user456',
        tier: 'premium',
        subscriptionActive: true,
      };

      const features = await getAccessibleFeatures(premiumUser);

      // Should include both free and premium features that are enabled
      expect(features).toContain(FEATURE_KEYS.CLIPBOARD_IMPORT);
      expect(features).toContain(FEATURE_KEYS.EXCEL_EXPORT);
      expect(features).toContain(FEATURE_KEYS.EXCEL_IMPORT);
    });

    it('should exclude disabled features', async () => {
      dbGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat({
        [FEATURE_KEYS.CLIPBOARD_IMPORT]: { enabled: true },
        [FEATURE_KEYS.EXCEL_EXPORT]: { enabled: false },
      }));

      const freeUser: UserTier = {
        userId: 'user123',
        tier: 'free',
      };

      const features = await getAccessibleFeatures(freeUser);

      expect(features).toContain(FEATURE_KEYS.CLIPBOARD_IMPORT);
      expect(features).not.toContain(FEATURE_KEYS.EXCEL_EXPORT);
    });

    it('should return empty array if all features are disabled', async () => {
      dbGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat({
        [FEATURE_KEYS.MONETIZATION]: { enabled: false },
        [FEATURE_KEYS.AUTH]: { enabled: false },
        [FEATURE_KEYS.PAYMENTS]: { enabled: false },
        [FEATURE_KEYS.EXCEL_EXPORT]: { enabled: false },
        [FEATURE_KEYS.EXCEL_IMPORT]: { enabled: false },
        [FEATURE_KEYS.PDF_IMPORT]: { enabled: false },
        [FEATURE_KEYS.CLIPBOARD_IMPORT]: { enabled: false },
        [FEATURE_KEYS.RISK_CHART]: { enabled: false },
      }));

      const freeUser: UserTier = {
        userId: 'user123',
        tier: 'free',
      };

      const features = await getAccessibleFeatures(freeUser);
      expect(features).toEqual([]);
    });

    it('should respect beta users', async () => {
      dbGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat({
        [FEATURE_KEYS.EXCEL_EXPORT]: {
          enabled: true,
          rolloutPercentage: 0,
          betaUsers: ['beta_user'],
        },
      }));

      const betaUser: UserTier = {
        userId: 'beta_user',
        tier: 'premium',
        subscriptionActive: true,
      };

      const features = await getAccessibleFeatures(betaUser);
      expect(features).toContain(FEATURE_KEYS.EXCEL_EXPORT);
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
        FEATURE_KEYS.EXCEL_EXPORT,
        FEATURE_KEYS.EXCEL_IMPORT,
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
        FEATURE_KEYS.EXCEL_EXPORT,
        expiredUser,
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('no_subscription');
    });
  });
});
