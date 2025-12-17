import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from '@vercel/edge-config';
import {
  isFeatureEnabledOnVercel,
  isEnabledForUser,
  getAllFeatureFlags,
  isEdgeConfigAvailable,
  type EdgeConfigFlags,
} from './vercel-features';

// Mock @vercel/edge-config
vi.mock('@vercel/edge-config', () => ({
  get: vi.fn(),
}));

describe('Vercel Edge Config Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variables
    delete process.env.FEATURE_EXCEL_EXPORT;
    delete process.env.FEATURE_MONETIZATION;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isFeatureEnabledOnVercel', () => {
    it('should return false when env var is explicitly "false"', async () => {
      process.env.FEATURE_EXCEL_EXPORT = 'false';
      const result = await isFeatureEnabledOnVercel('excel_export');
      expect(result).toBe(false);
      expect(get).not.toHaveBeenCalled(); // Should short-circuit
    });

    it('should fall back to env var when Edge Config returns null', async () => {
      process.env.FEATURE_EXCEL_EXPORT = 'true';
      vi.mocked(get).mockResolvedValue(null);

      const result = await isFeatureEnabledOnVercel('excel_export');
      expect(result).toBe(true);
      expect(get).toHaveBeenCalledWith('features');
    });

    it('should return false when feature is not in Edge Config', async () => {
      const flags: EdgeConfigFlags = {
        other_feature: { enabled: true },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabledOnVercel('excel_export');
      expect(result).toBe(false);
    });

    it('should return false when feature is disabled in Edge Config', async () => {
      const flags: EdgeConfigFlags = {
        excel_export: { enabled: false },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabledOnVercel('excel_export');
      expect(result).toBe(false);
    });

    it('should return true when feature is enabled without restrictions', async () => {
      const flags: EdgeConfigFlags = {
        excel_export: { enabled: true },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabledOnVercel('excel_export');
      expect(result).toBe(true);
    });

    it('should return true for beta users even if rollout is 0%', async () => {
      const flags: EdgeConfigFlags = {
        excel_export: {
          enabled: true,
          rolloutPercentage: 0,
          betaUsers: ['user123', 'user456'],
        },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabledOnVercel('excel_export', 'user123');
      expect(result).toBe(true);
    });

    it('should not enable for non-beta users when not in beta list', async () => {
      const flags: EdgeConfigFlags = {
        excel_export: {
          enabled: true,
          rolloutPercentage: 0,
          betaUsers: ['user123'],
        },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabledOnVercel('excel_export', 'user999');
      expect(result).toBe(false);
    });

    it('should respect rollout percentage', async () => {
      const flags: EdgeConfigFlags = {
        excel_export: {
          enabled: true,
          rolloutPercentage: 50,
        },
      };
      vi.mocked(get).mockResolvedValue(flags);

      // Test with different user IDs to check distribution
      const results = await Promise.all([
        isFeatureEnabledOnVercel('excel_export', 'user1'),
        isFeatureEnabledOnVercel('excel_export', 'user2'),
        isFeatureEnabledOnVercel('excel_export', 'user3'),
      ]);

      // At least one should be enabled and one disabled with 50% rollout
      // This is probabilistic but with different user IDs it should work
      expect(results).toContain(true);
      expect(results).toContain(false);
    });

    it('should return false when rollout is 0%', async () => {
      const flags: EdgeConfigFlags = {
        excel_export: {
          enabled: true,
          rolloutPercentage: 0,
        },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabledOnVercel('excel_export', 'user123');
      expect(result).toBe(false);
    });

    it('should return true when rollout is 100%', async () => {
      const flags: EdgeConfigFlags = {
        excel_export: {
          enabled: true,
          rolloutPercentage: 100,
        },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isFeatureEnabledOnVercel('excel_export', 'user123');
      expect(result).toBe(true);
    });

    it('should fall back to env var on Edge Config error', async () => {
      process.env.FEATURE_EXCEL_EXPORT = 'true';
      vi.mocked(get).mockRejectedValue(new Error('Edge Config unavailable'));

      const result = await isFeatureEnabledOnVercel('excel_export');
      expect(result).toBe(true);
    });

    it('should return false on Edge Config error when env var is not set', async () => {
      vi.mocked(get).mockRejectedValue(new Error('Edge Config unavailable'));

      const result = await isFeatureEnabledOnVercel('excel_export');
      expect(result).toBe(false);
    });

    it('should handle missing userId gracefully', async () => {
      const flags: EdgeConfigFlags = {
        excel_export: {
          enabled: true,
          rolloutPercentage: 50,
        },
      };
      vi.mocked(get).mockResolvedValue(flags);

      // Without userId, rollout percentage should not apply
      const result = await isFeatureEnabledOnVercel('excel_export');
      expect(result).toBe(true);
    });
  });

  describe('isEnabledForUser', () => {
    it('should return false when feature is disabled', async () => {
      const flags: EdgeConfigFlags = {
        new_feature: { enabled: false },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await isEnabledForUser('new_feature', 'user123', 10);
      expect(result).toBe(false);
    });

    it('should apply percentage correctly', async () => {
      const flags: EdgeConfigFlags = {
        new_feature: { enabled: true },
      };
      vi.mocked(get).mockResolvedValue(flags);

      // Test with 0% - should be false
      let result = await isEnabledForUser('new_feature', 'user123', 0);
      expect(result).toBe(false);

      // Test with 100% - should be true
      result = await isEnabledForUser('new_feature', 'user123', 100);
      expect(result).toBe(true);
    });
  });

  describe('getAllFeatureFlags', () => {
    it('should return all flags from Edge Config', async () => {
      const flags: EdgeConfigFlags = {
        feature1: { enabled: true },
        feature2: { enabled: false, rolloutPercentage: 50 },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result = await getAllFeatureFlags();
      expect(result).toEqual(flags);
    });

    it('should return null when Edge Config returns null', async () => {
      vi.mocked(get).mockResolvedValue(null);

      const result = await getAllFeatureFlags();
      expect(result).toBeNull();
    });

    it('should return null on Edge Config error', async () => {
      vi.mocked(get).mockRejectedValue(new Error('Network error'));

      const result = await getAllFeatureFlags();
      expect(result).toBeNull();
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

  describe('Hash Function', () => {
    it('should produce consistent hashes for same userId and featureId', async () => {
      const flags: EdgeConfigFlags = {
        feature1: { enabled: true, rolloutPercentage: 50 },
      };
      vi.mocked(get).mockResolvedValue(flags);

      const result1 = await isFeatureEnabledOnVercel('feature1', 'user123');
      const result2 = await isFeatureEnabledOnVercel('feature1', 'user123');

      expect(result1).toBe(result2);
    });

    it('should produce different results for different features with same user', async () => {
      const flags: EdgeConfigFlags = {
        feature1: { enabled: true, rolloutPercentage: 10 },
        feature2: { enabled: true, rolloutPercentage: 10 },
      };
      vi.mocked(get).mockResolvedValue(flags);

      // With 10% rollout, most users should get different results
      // for different features due to feature-specific hashing
      const results = [];
      for (let i = 0; i < 100; i++) {
        const userId = `user${i}`;
        const r1 = await isFeatureEnabledOnVercel('feature1', userId);
        const r2 = await isFeatureEnabledOnVercel('feature2', userId);
        results.push({ userId, f1: r1, f2: r2 });
      }

      // At least some users should have different results across features
      const differentResults = results.filter(r => r.f1 !== r.f2);
      expect(differentResults.length).toBeGreaterThan(0);
    });
  });

  describe('Environment Variable Handling', () => {
    it('should convert feature ID to uppercase env var name', async () => {
      process.env.FEATURE_EXCEL_EXPORT = 'false';

      const result = await isFeatureEnabledOnVercel('excel_export');
      expect(result).toBe(false);
    });

    it('should handle underscores in feature IDs', async () => {
      process.env.FEATURE_CLOUD_SYNC = 'true';
      vi.mocked(get).mockResolvedValue(null);

      const result = await isFeatureEnabledOnVercel('cloud_sync');
      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should log errors to console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty to suppress console output during tests
      });
      vi.mocked(get).mockRejectedValue(new Error('Test error'));

      await isFeatureEnabledOnVercel('test_feature');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Feature flag check failed:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should not throw errors on Edge Config failure', async () => {
      vi.mocked(get).mockRejectedValue(new Error('Network error'));

      await expect(
        isFeatureEnabledOnVercel('test_feature')
      ).resolves.toBeDefined();
    });
  });
});
