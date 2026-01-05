import { describe, it, expect, beforeEach, vi } from 'vitest';
import { monetizationStore } from './monetizationStore';
import { authStore } from './authStore';
import { FEATURE_KEYS } from '@uth/features';
import { TIERS } from '@uth/domain';

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

      // CLIPBOARD_IMPORT is enabled for FREE tier
      expect(monetizationStore.hasFeatureAccess(FEATURE_KEYS.CLIPBOARD_IMPORT)).toBe(true);
    });

    it('should deny premium features for free users', () => {
      monetizationStore.setTier(TIERS.FREE);

      // PDF_IMPORT and RISK_CHART require PREMIUM tier
      expect(monetizationStore.hasFeatureAccess(FEATURE_KEYS.PDF_IMPORT)).toBe(false);
      expect(monetizationStore.hasFeatureAccess(FEATURE_KEYS.RISK_CHART)).toBe(false);
    });

    it('should allow all features for premium users', () => {
      monetizationStore.setTier(TIERS.PREMIUM);

      // Premium users get all enabled features
      expect(monetizationStore.hasFeatureAccess(FEATURE_KEYS.CLIPBOARD_IMPORT)).toBe(true);
      expect(monetizationStore.hasFeatureAccess(FEATURE_KEYS.EXCEL_EXPORT)).toBe(true);
      expect(monetizationStore.hasFeatureAccess(FEATURE_KEYS.EXCEL_IMPORT)).toBe(true);
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

    it('should reject invalid tier and default to ANONYMOUS (fail-closed)', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {
          // Mock implementation
        });

      monetizationStore.setTier('invalid-tier');
      expect(monetizationStore.tier).toBe(TIERS.ANONYMOUS);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid tier value'),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should reject undefined and default to ANONYMOUS', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {
          // Mock implementation
        });

      monetizationStore.setTier(undefined);
      expect(monetizationStore.tier).toBe(TIERS.ANONYMOUS);

      consoleWarnSpy.mockRestore();
    });

    it('should reject null and default to ANONYMOUS', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {
          // Mock implementation
        });

      monetizationStore.setTier(null);
      expect(monetizationStore.tier).toBe(TIERS.ANONYMOUS);

      consoleWarnSpy.mockRestore();
    });

    it('should reject objects and default to ANONYMOUS', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {
          // Mock implementation
        });

      monetizationStore.setTier({ tier: TIERS.PREMIUM });
      expect(monetizationStore.tier).toBe(TIERS.ANONYMOUS);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('reset', () => {
    it('should reset to default state', () => {
      monetizationStore.setTier(TIERS.PREMIUM);

      monetizationStore.reset();

      expect(monetizationStore.tier).toBe(TIERS.ANONYMOUS);
      expect(monetizationStore.isLoading).toBe(false);
    });
  });

  describe('security - fail-closed behavior', () => {
    it('should default to ANONYMOUS tier on initialization', () => {
      const newStore = new (monetizationStore.constructor as any)();
      expect(newStore.tier).toBe(TIERS.ANONYMOUS);
    });

    it('should deny premium features by default', () => {
      const newStore = new (monetizationStore.constructor as any)();
      expect(newStore.hasFeatureAccess(FEATURE_KEYS.EXCEL_EXPORT)).toBe(false);
      expect(newStore.hasFeatureAccess(FEATURE_KEYS.EXCEL_IMPORT)).toBe(false);
    });

    it('should allow anonymous tier features by default', () => {
      const newStore = new (monetizationStore.constructor as any)();
      // CLIPBOARD_IMPORT is available at ANONYMOUS tier
      expect(newStore.hasFeatureAccess(FEATURE_KEYS.CLIPBOARD_IMPORT)).toBe(true);
      // But disabled features should return false for everyone
      expect(newStore.hasFeatureAccess(FEATURE_KEYS.MONETIZATION)).toBe(false);
    });
  });
});
