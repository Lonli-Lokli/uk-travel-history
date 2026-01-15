import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isFeatureEnabled
} from './features';
import { FEATURE_KEYS, FeatureFlagKey } from './shapes';
import type { FeaturePolicy } from '@uth/db';

// Mock @uth/db
vi.mock('@uth/db', () => ({
  getAllFeaturePolicies: vi.fn(),
}));

// Mock next/cache to avoid incrementalCache errors in tests
vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn) => fn),
}));

// Import the mocked function after mocking
import { getAllFeaturePolicies  } from '@uth/db';

// Helper to convert Edge Config format to DB format
function convertToDbFormat(edgeConfigFlags: Record<string, any> | null): FeaturePolicy[] {
  if (!edgeConfigFlags) return [];

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

const mockGetAllFeaturePolicies = vi.mocked(getAllFeaturePolicies, {partial: true});
describe('Edge Config Feature Flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('FEATURE_KEYS', () => {
    it('should have snake_case values', () => {
      Object.values(FEATURE_KEYS).forEach((value) => {
        expect(value).toMatch(/^[a-z_]+$/);
      });
    });
  });

  describe('isFeatureEnabled (server-side)', () => {
    it('should return false when Edge Config is not configured', async () => {
      mockGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(null));

      const result = await isFeatureEnabled(FEATURE_KEYS.MONETIZATION);
      expect(result).toBe(false);
    });

    it('should return false when feature is not in Edge Config', async () => {
      const flags = {
        other_feature: { enabled: true },
      };
      mockGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(flags));

      const result = await isFeatureEnabled(FEATURE_KEYS.AUTH);
      expect(result).toBe(false);
    });

    it('should return false when feature is disabled in Edge Config', async () => {
      const flags = {
        [FEATURE_KEYS.AUTH]: { enabled: false },
      };
      mockGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(flags));

      const result = await isFeatureEnabled(FEATURE_KEYS.AUTH);
      expect(result).toBe(false);
    });

    it('should return true when feature is enabled without restrictions', async () => {
      const flags = {
        [FEATURE_KEYS.AUTH]: { enabled: true },
      };
      mockGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(flags));

      const result = await isFeatureEnabled(FEATURE_KEYS.AUTH);
      expect(result).toBe(true);
    });

    it('should return true for beta users even if rollout is 0%', async () => {
      const flags = {
        [FEATURE_KEYS.EXCEL_EXPORT]: {
          enabled: true,
          rolloutPercentage: 0,
          betaUsers: ['user123', 'user456'],
        },
      };
      mockGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(flags));

      const result = await isFeatureEnabled(
        FEATURE_KEYS.EXCEL_EXPORT,
        'user123',
      );
      expect(result).toBe(true);
    });

    it('should not enable for non-beta users when rollout is 0%', async () => {
      const flags = {
        [FEATURE_KEYS.EXCEL_EXPORT]: {
          enabled: true,
          rolloutPercentage: 0,
          betaUsers: ['user123'],
        },
      };
      mockGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(flags));

      const result = await isFeatureEnabled(
        FEATURE_KEYS.EXCEL_EXPORT,
        'user999',
      );
      expect(result).toBe(false);
    });

    it('should respect rollout percentage', async () => {
      const flags = {
        [FEATURE_KEYS.EXCEL_EXPORT]: {
          enabled: true,
          rolloutPercentage: 50,
        },
      };
      mockGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(flags));

      // Test with different user IDs to check distribution
      const results = await Promise.all([
        isFeatureEnabled(FEATURE_KEYS.EXCEL_EXPORT, 'user1'),
        isFeatureEnabled(FEATURE_KEYS.EXCEL_EXPORT, 'user2'),
        isFeatureEnabled(FEATURE_KEYS.EXCEL_EXPORT, 'user3'),
      ]);

      // At least one should be enabled and one disabled with 50% rollout
      expect(results).toContain(true);
      expect(results).toContain(false);
    });

    it('should return true when rollout is 100%', async () => {
      const flags = {
        [FEATURE_KEYS.EXCEL_EXPORT]: {
          enabled: true,
          rolloutPercentage: 100,
        },
      };
      mockGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(flags));

      const result = await isFeatureEnabled(
        FEATURE_KEYS.EXCEL_EXPORT,
        'user123',
      );
      expect(result).toBe(true);
    });

    it('should return false on Edge Config error (fail closed)', async () => {
      mockGetAllFeaturePolicies.mockRejectedValue(new Error('Edge Config unavailable'));

      const result = await isFeatureEnabled(FEATURE_KEYS.MONETIZATION);
      expect(result).toBe(false);
    });

    it('should handle missing userId gracefully', async () => {
      const flags = {
        [FEATURE_KEYS.EXCEL_EXPORT]: {
          enabled: true,
          rolloutPercentage: 50,
        },
      };
      mockGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(flags));

      // Without userId, rollout percentage should not apply
      const result = await isFeatureEnabled(FEATURE_KEYS.EXCEL_EXPORT);
      expect(result).toBe(true);
    });

    it('should produce consistent hashes for same userId and featureKey', async () => {
      const flags = {
        [FEATURE_KEYS.EXCEL_EXPORT]: {
          enabled: true,
          rolloutPercentage: 50,
        },
      };
      mockGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(flags));

      const result1 = await isFeatureEnabled(
        FEATURE_KEYS.EXCEL_EXPORT,
        'user123',
      );
      const result2 = await isFeatureEnabled(
        FEATURE_KEYS.EXCEL_EXPORT,
        'user123',
      );

      expect(result1).toBe(result2);
    });
  });

  describe('Type Safety', () => {
    it('should enforce FeatureFlagKey type', async () => {
      const validKey: FeatureFlagKey = FEATURE_KEYS.MONETIZATION;

      const flags = {
        [validKey]: { enabled: true },
      };
      mockGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(flags));

      const result = await isFeatureEnabled(validKey);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should log errors to console on Edge Config failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Suppress console output during tests
      });
      mockGetAllFeaturePolicies.mockRejectedValue(new Error('Test error'));

      await isFeatureEnabled(FEATURE_KEYS.AUTH);

      // Logger.error now formats the output differently:
      // The error is now logged in loadPoliciesFromSupabaseUncached()
      // logger.error(message, error) results in:
      // console.error(message, { error })
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Feature Policies] Error loading from database',
        expect.objectContaining({
          error: expect.any(Error),
        }),
      );

      consoleSpy.mockRestore();
    });

    it('should not throw errors on Edge Config failure', async () => {
      mockGetAllFeaturePolicies.mockRejectedValue(new Error('Network error'));

      await expect(isFeatureEnabled(FEATURE_KEYS.AUTH)).resolves.toBeDefined();
    });

    it('should log warning when Edge Config is not configured', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Suppress console output during tests
      });
      mockGetAllFeaturePolicies.mockResolvedValue(convertToDbFormat(null));

      await isFeatureEnabled(FEATURE_KEYS.AUTH);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('feature policies found in database'),
      );

      consoleSpy.mockRestore();
    });
  });
});
