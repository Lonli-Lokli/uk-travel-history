import { describe, it, expect, beforeEach, vi } from 'vitest';
import { monetizationStore } from './monetizationStore';
import { authStore } from './authStore';
import { FEATURES, TIERS } from '@uth/features';

// Mock the authStore
vi.mock('./authStore', () => ({
  authStore: {
    user: null,
    getIdToken: vi.fn(),
  },
}));

describe('MonetizationStore', () => {
  beforeEach(() => {
    // Reset store state
    monetizationStore.reset();

    // Reset mocks
    vi.clearAllMocks();
    (authStore.user as any) = null;
  });

  describe('hasFeatureAccess', () => {
    it('should allow free tier features for free users', () => {
      monetizationStore.setTier(TIERS.FREE);

      expect(
        monetizationStore.hasFeatureAccess(FEATURES.BASIC_CALCULATION),
      ).toBe(true);
      expect(monetizationStore.hasFeatureAccess(FEATURES.PDF_IMPORT)).toBe(
        true,
      );
      expect(monetizationStore.hasFeatureAccess(FEATURES.CSV_IMPORT)).toBe(
        true,
      );
      expect(monetizationStore.hasFeatureAccess(FEATURES.MANUAL_ENTRY)).toBe(
        true,
      );
    });

    it('should deny premium features for free users', () => {
      monetizationStore.setTier(TIERS.FREE);

      expect(monetizationStore.hasFeatureAccess(FEATURES.EXCEL_EXPORT)).toBe(
        false,
      );
      expect(monetizationStore.hasFeatureAccess(FEATURES.PDF_EXPORT)).toBe(
        false,
      );
      expect(monetizationStore.hasFeatureAccess(FEATURES.CLOUD_SYNC)).toBe(
        false,
      );
    });

    it('should allow all features for premium users', () => {
      monetizationStore.setTier(TIERS.PREMIUM);

      expect(
        monetizationStore.hasFeatureAccess(FEATURES.BASIC_CALCULATION),
      ).toBe(true);
      expect(monetizationStore.hasFeatureAccess(FEATURES.EXCEL_EXPORT)).toBe(
        true,
      );
      expect(monetizationStore.hasFeatureAccess(FEATURES.PDF_EXPORT)).toBe(
        true,
      );
      expect(monetizationStore.hasFeatureAccess(FEATURES.CLOUD_SYNC)).toBe(
        true,
      );
    });
  });

  describe('isPremium', () => {
    it('should return false for free tier', () => {
      monetizationStore.setTier(TIERS.FREE);
      expect(monetizationStore.isPremium).toBe(false);
    });

    it('should return true for premium tier', () => {
      monetizationStore.setTier(TIERS.PREMIUM);
      expect(monetizationStore.isPremium).toBe(true);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no user', () => {
      (authStore.user as any) = null;
      expect(monetizationStore.isAuthenticated).toBe(false);
    });

    it('should return true when user exists', () => {
      (authStore.user as any) = { uid: 'test-user' };
      expect(monetizationStore.isAuthenticated).toBe(true);
    });
  });

  describe('isLoading', () => {
    it('should always return false in simplified version', () => {
      expect(monetizationStore.isLoading).toBe(false);
      monetizationStore.setTier(TIERS.PREMIUM);
      expect(monetizationStore.isLoading).toBe(false);
    });
  });

  describe('setTier', () => {
    it('should set valid tier', () => {
      monetizationStore.setTier(TIERS.PREMIUM);
      expect(monetizationStore.tier).toBe(TIERS.PREMIUM);

      monetizationStore.setTier(TIERS.FREE);
      expect(monetizationStore.tier).toBe(TIERS.FREE);
    });

    it('should reject invalid tier and default to FREE (fail-closed)', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {
          // Mock implementation
        });

      monetizationStore.setTier('invalid-tier');
      expect(monetizationStore.tier).toBe(TIERS.FREE);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid tier value'),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should reject undefined and default to FREE', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {
          // Mock implementation
        });

      monetizationStore.setTier(undefined);
      expect(monetizationStore.tier).toBe(TIERS.FREE);

      consoleWarnSpy.mockRestore();
    });

    it('should reject null and default to FREE', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {
          // Mock implementation
        });

      monetizationStore.setTier(null);
      expect(monetizationStore.tier).toBe(TIERS.FREE);

      consoleWarnSpy.mockRestore();
    });

    it('should reject objects and default to FREE', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {
          // Mock implementation
        });

      monetizationStore.setTier({ tier: TIERS.PREMIUM });
      expect(monetizationStore.tier).toBe(TIERS.FREE);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('reset', () => {
    it('should reset to default state', () => {
      monetizationStore.setTier(TIERS.PREMIUM);

      monetizationStore.reset();

      expect(monetizationStore.tier).toBe(TIERS.FREE);
      expect(monetizationStore.isLoading).toBe(false);
    });
  });

  describe('security - fail-closed behavior', () => {
    it('should default to FREE tier on initialization', () => {
      const newStore = new (monetizationStore.constructor as any)();
      expect(newStore.tier).toBe(TIERS.FREE);
    });

    it('should deny premium features by default', () => {
      const newStore = new (monetizationStore.constructor as any)();
      expect(newStore.hasFeatureAccess(FEATURES.EXCEL_EXPORT)).toBe(false);
      expect(newStore.hasFeatureAccess(FEATURES.PDF_EXPORT)).toBe(false);
      expect(newStore.hasFeatureAccess(FEATURES.CLOUD_SYNC)).toBe(false);
    });

    it('should allow free features by default', () => {
      const newStore = new (monetizationStore.constructor as any)();
      expect(newStore.hasFeatureAccess(FEATURES.BASIC_CALCULATION)).toBe(true);
      expect(newStore.hasFeatureAccess(FEATURES.PDF_IMPORT)).toBe(true);
    });
  });
});
