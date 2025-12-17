import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from '@vercel/edge-config';
import {
  isFeatureEnabled,
  isFeatureEnabledClient,
  getAllFeatureFlags,
  isEdgeConfigAvailable,
  setCachedFlags,
  getCachedFlags,
  FEATURE_KEYS,
  type EdgeConfigFlags,
  type FeatureFlagKey,
} from './edgeConfigFlags';

// Mock @vercel/edge-config
vi.mock('@vercel/edge-config', () => ({
  get: vi.fn(),
}));

describe('Edge Config Feature Flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('FEATURE_KEYS', () => {
    it('should have all expected feature keys', () => {
      const expectedKeys = [
        'MONETIZATION_ENABLED',
        'FIREBASE_AUTH_ENABLED',
        'STRIPE_CHECKOUT_ENABLED',
        'EXCEL_EXPORT_PREMIUM',
        'PDF_EXPORT_ENABLED',
        'CLOUD_SYNC_ENABLED',
        'UPGRADE_MODAL_ENABLED',
        'PREMIUM_BADGE_ENABLED',
      ];

      expect(Object.keys(FEATURE_KEYS)).toEqual(expectedKeys);
    });

    it('should have snake_case values', () => {
      Object.values(FEATURE_KEYS).forEach((value) => {
        expect(value).toMatch(/^[a-z_]+$/);
      });
    });
  });

  describe('isFeatureEnabled (server-side)', () => {
    it('should return false when Edge Config is not configured', async () => {
      vi.mocked(get).mockResolvedValue(null);

      const result = await isFeatureEnabled(
        FEATURE_KEYS.FIREBASE_AUTH_ENABLED
      );
      expect(result).toBe(false);
    });

    it('should return false when feature is not in Edge Config', async () => {
      const flags: EdgeConfigFlags = {
        other_feature: { enabled: true },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabled(
        FEATURE_KEYS.FIREBASE_AUTH_ENABLED
      );
      expect(result).toBe(false);
    });

    it('should return false when feature is disabled in Edge Config', async () => {
      const flags: EdgeConfigFlags = {
        [FEATURE_KEYS.FIREBASE_AUTH_ENABLED]: { enabled: false },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabled(
        FEATURE_KEYS.FIREBASE_AUTH_ENABLED
      );
      expect(result).toBe(false);
    });

    it('should return true when feature is enabled without restrictions', async () => {
      const flags: EdgeConfigFlags = {
        [FEATURE_KEYS.FIREBASE_AUTH_ENABLED]: { enabled: true },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabled(
        FEATURE_KEYS.FIREBASE_AUTH_ENABLED
      );
      expect(result).toBe(true);
    });

    it('should return true for beta users even if rollout is 0%', async () => {
      const flags: EdgeConfigFlags = {
        [FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]: {
          enabled: true,
          rolloutPercentage: 0,
          betaUsers: ['user123', 'user456'],
        },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabled(
        FEATURE_KEYS.EXCEL_EXPORT_PREMIUM,
        'user123'
      );
      expect(result).toBe(true);
    });

    it('should not enable for non-beta users when rollout is 0%', async () => {
      const flags: EdgeConfigFlags = {
        [FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]: {
          enabled: true,
          rolloutPercentage: 0,
          betaUsers: ['user123'],
        },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabled(
        FEATURE_KEYS.EXCEL_EXPORT_PREMIUM,
        'user999'
      );
      expect(result).toBe(false);
    });

    it('should respect rollout percentage', async () => {
      const flags: EdgeConfigFlags = {
        [FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]: {
          enabled: true,
          rolloutPercentage: 50,
        },
      };
      vi.mocked(get).mockResolvedValue(flags);

      // Test with different user IDs to check distribution
      const results = await Promise.all([
        isFeatureEnabled(FEATURE_KEYS.EXCEL_EXPORT_PREMIUM, 'user1'),
        isFeatureEnabled(FEATURE_KEYS.EXCEL_EXPORT_PREMIUM, 'user2'),
        isFeatureEnabled(FEATURE_KEYS.EXCEL_EXPORT_PREMIUM, 'user3'),
      ]);

      // At least one should be enabled and one disabled with 50% rollout
      expect(results).toContain(true);
      expect(results).toContain(false);
    });

    it('should return true when rollout is 100%', async () => {
      const flags: EdgeConfigFlags = {
        [FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]: {
          enabled: true,
          rolloutPercentage: 100,
        },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabled(
        FEATURE_KEYS.EXCEL_EXPORT_PREMIUM,
        'user123'
      );
      expect(result).toBe(true);
    });

    it('should return false on Edge Config error (fail closed)', async () => {
      vi.mocked(get).mockRejectedValue(new Error('Edge Config unavailable'));

      const result = await isFeatureEnabled(
        FEATURE_KEYS.FIREBASE_AUTH_ENABLED
      );
      expect(result).toBe(false);
    });

    it('should handle missing userId gracefully', async () => {
      const flags: EdgeConfigFlags = {
        [FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]: {
          enabled: true,
          rolloutPercentage: 50,
        },
      };
      vi.mocked(get).mockResolvedValue(flags);

      // Without userId, rollout percentage should not apply
      const result = await isFeatureEnabled(FEATURE_KEYS.EXCEL_EXPORT_PREMIUM);
      expect(result).toBe(true);
    });

    it('should produce consistent hashes for same userId and featureKey', async () => {
      const flags: EdgeConfigFlags = {
        [FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]: {
          enabled: true,
          rolloutPercentage: 50,
        },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result1 = await isFeatureEnabled(
        FEATURE_KEYS.EXCEL_EXPORT_PREMIUM,
        'user123'
      );
      const result2 = await isFeatureEnabled(
        FEATURE_KEYS.EXCEL_EXPORT_PREMIUM,
        'user123'
      );

      expect(result1).toBe(result2);
    });
  });

  describe('getAllFeatureFlags', () => {
    it('should return all flags evaluated for a user', async () => {
      const flags: EdgeConfigFlags = {
        [FEATURE_KEYS.FIREBASE_AUTH_ENABLED]: { enabled: true },
        [FEATURE_KEYS.MONETIZATION_ENABLED]: { enabled: false },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await getAllFeatureFlags('user123');

      expect(result[FEATURE_KEYS.FIREBASE_AUTH_ENABLED]).toBe(true);
      expect(result[FEATURE_KEYS.MONETIZATION_ENABLED]).toBe(false);
      // Other flags should default to false
      expect(result[FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]).toBe(false);
    });

    it('should return all flags as false when Edge Config is not configured', async () => {
      vi.mocked(get).mockResolvedValue(null);

      const result = await getAllFeatureFlags();

      Object.values(FEATURE_KEYS).forEach((key) => {
        expect(result[key]).toBe(false);
      });
    });
  });

  describe('Client-side caching', () => {
    it('should cache and retrieve flags', () => {
      const testFlags: Record<FeatureFlagKey, boolean> = {
        [FEATURE_KEYS.MONETIZATION_ENABLED]: true,
        [FEATURE_KEYS.FIREBASE_AUTH_ENABLED]: true,
        [FEATURE_KEYS.STRIPE_CHECKOUT_ENABLED]: false,
        [FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]: false,
        [FEATURE_KEYS.PDF_EXPORT_ENABLED]: false,
        [FEATURE_KEYS.CLOUD_SYNC_ENABLED]: false,
        [FEATURE_KEYS.UPGRADE_MODAL_ENABLED]: false,
        [FEATURE_KEYS.PREMIUM_BADGE_ENABLED]: false,
      };

      setCachedFlags(testFlags);
      const cached = getCachedFlags();

      expect(cached).toEqual(testFlags);
    });

    it('should return default flags when no cache is set', () => {
      // Clear any existing cache by setting to empty/default
      const cached = getCachedFlags();

      Object.values(FEATURE_KEYS).forEach((key) => {
        expect(cached[key]).toBe(false);
      });
    });
  });

  describe('isFeatureEnabledClient', () => {
    it('should return cached flag value', () => {
      const testFlags: Record<FeatureFlagKey, boolean> = {
        [FEATURE_KEYS.MONETIZATION_ENABLED]: true,
        [FEATURE_KEYS.FIREBASE_AUTH_ENABLED]: false,
        [FEATURE_KEYS.STRIPE_CHECKOUT_ENABLED]: false,
        [FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]: false,
        [FEATURE_KEYS.PDF_EXPORT_ENABLED]: false,
        [FEATURE_KEYS.CLOUD_SYNC_ENABLED]: false,
        [FEATURE_KEYS.UPGRADE_MODAL_ENABLED]: false,
        [FEATURE_KEYS.PREMIUM_BADGE_ENABLED]: false,
      };

      setCachedFlags(testFlags);

      expect(isFeatureEnabledClient(FEATURE_KEYS.MONETIZATION_ENABLED)).toBe(
        true
      );
      expect(isFeatureEnabledClient(FEATURE_KEYS.FIREBASE_AUTH_ENABLED)).toBe(
        false
      );
    });

    it('should return false for uncached flags', () => {
      const testFlags: Record<FeatureFlagKey, boolean> = {
        [FEATURE_KEYS.MONETIZATION_ENABLED]: true,
        [FEATURE_KEYS.FIREBASE_AUTH_ENABLED]: false,
        [FEATURE_KEYS.STRIPE_CHECKOUT_ENABLED]: false,
        [FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]: false,
        [FEATURE_KEYS.PDF_EXPORT_ENABLED]: false,
        [FEATURE_KEYS.CLOUD_SYNC_ENABLED]: false,
        [FEATURE_KEYS.UPGRADE_MODAL_ENABLED]: false,
        [FEATURE_KEYS.PREMIUM_BADGE_ENABLED]: false,
      };

      setCachedFlags(testFlags);

      expect(isFeatureEnabledClient(FEATURE_KEYS.EXCEL_EXPORT_PREMIUM)).toBe(
        false
      );
    });
  });

  describe('isEdgeConfigAvailable', () => {
    it('should return true when Edge Config is accessible', async () => {
      vi.mocked(get).mockResolvedValue({});

      const result = await isEdgeConfigAvailable();
      expect(result).toBe(true);
    });

    it('should return false when Edge Config throws error', async () => {
      vi.mocked(get).mockRejectedValue(new Error('Not configured'));

      const result = await isEdgeConfigAvailable();
      expect(result).toBe(false);
    });
  });

  describe('Type Safety', () => {
    it('should enforce FeatureFlagKey type', async () => {
      const validKey: FeatureFlagKey = FEATURE_KEYS.MONETIZATION_ENABLED;

      const flags: EdgeConfigFlags = {
        [validKey]: { enabled: true },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabled(validKey);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should log errors to console on Edge Config failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Suppress console output during tests
      });
      vi.mocked(get).mockRejectedValue(new Error('Test error'));

      await isFeatureEnabled(FEATURE_KEYS.FIREBASE_AUTH_ENABLED);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Feature flag check failed:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should not throw errors on Edge Config failure', async () => {
      vi.mocked(get).mockRejectedValue(new Error('Network error'));

      await expect(
        isFeatureEnabled(FEATURE_KEYS.FIREBASE_AUTH_ENABLED)
      ).resolves.toBeDefined();
    });

    it('should log warning when Edge Config is not configured', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Suppress console output during tests
      });
      vi.mocked(get).mockResolvedValue(null);

      await isFeatureEnabled(FEATURE_KEYS.FIREBASE_AUTH_ENABLED);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Edge Config not configured')
      );

      consoleSpy.mockRestore();
    });
  });
});
