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

// Mock fetch
global.fetch = vi.fn();

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
      monetizationStore.tier = TIERS.FREE;

      expect(monetizationStore.hasFeatureAccess(FEATURES.BASIC_CALCULATION)).toBe(true);
      expect(monetizationStore.hasFeatureAccess(FEATURES.PDF_IMPORT)).toBe(true);
      expect(monetizationStore.hasFeatureAccess(FEATURES.CSV_IMPORT)).toBe(true);
      expect(monetizationStore.hasFeatureAccess(FEATURES.MANUAL_ENTRY)).toBe(true);
    });

    it('should deny premium features for free users', () => {
      monetizationStore.tier = TIERS.FREE;

      expect(monetizationStore.hasFeatureAccess(FEATURES.EXCEL_EXPORT)).toBe(false);
      expect(monetizationStore.hasFeatureAccess(FEATURES.PDF_EXPORT)).toBe(false);
      expect(monetizationStore.hasFeatureAccess(FEATURES.CLOUD_SYNC)).toBe(false);
    });

    it('should allow all features for premium users', () => {
      monetizationStore.tier = TIERS.PREMIUM;

      expect(monetizationStore.hasFeatureAccess(FEATURES.BASIC_CALCULATION)).toBe(true);
      expect(monetizationStore.hasFeatureAccess(FEATURES.EXCEL_EXPORT)).toBe(true);
      expect(monetizationStore.hasFeatureAccess(FEATURES.PDF_EXPORT)).toBe(true);
      expect(monetizationStore.hasFeatureAccess(FEATURES.CLOUD_SYNC)).toBe(true);
    });
  });

  describe('isPremium', () => {
    it('should return false for free tier', () => {
      monetizationStore.tier = TIERS.FREE;
      expect(monetizationStore.isPremium).toBe(false);
    });

    it('should return true for premium tier', () => {
      monetizationStore.tier = TIERS.PREMIUM;
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

  describe('fetchSubscription', () => {
    it('should set tier to FREE when not authenticated', async () => {
      (authStore.user as any) = null;

      await monetizationStore.fetchSubscription();

      expect(monetizationStore.tier).toBe(TIERS.FREE);
      expect(monetizationStore.isLoading).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fetch subscription for authenticated users', async () => {
      (authStore.user as any) = { uid: 'test-user' };
      (authStore.getIdToken as any).mockResolvedValue('test-token');
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tier: TIERS.PREMIUM }),
      });

      await monetizationStore.fetchSubscription();

      expect(fetch).toHaveBeenCalledWith('/api/subscription/current', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-token',
        },
      });
      expect(monetizationStore.tier).toBe(TIERS.PREMIUM);
      expect(monetizationStore.isLoading).toBe(false);
      expect(monetizationStore.lastFetched).toBeInstanceOf(Date);
    });

    it('should default to FREE on 404 error', async () => {
      (authStore.user as any) = { uid: 'test-user' };
      (authStore.getIdToken as any).mockResolvedValue('test-token');
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await monetizationStore.fetchSubscription();

      expect(monetizationStore.tier).toBe(TIERS.FREE);
      expect(monetizationStore.isLoading).toBe(false);
    });

    it('should handle fetch errors gracefully', async () => {
      (authStore.user as any) = { uid: 'test-user' };
      (authStore.getIdToken as any).mockResolvedValue('test-token');
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await monetizationStore.fetchSubscription();

      expect(monetizationStore.tier).toBe(TIERS.FREE);
      expect(monetizationStore.error).toBe('Network error');
      expect(monetizationStore.isLoading).toBe(false);
    });

    it('should handle API errors', async () => {
      (authStore.user as any) = { uid: 'test-user' };
      (authStore.getIdToken as any).mockResolvedValue('test-token');
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      });

      await monetizationStore.fetchSubscription();

      expect(monetizationStore.tier).toBe(TIERS.FREE);
      expect(monetizationStore.error).toBe('Server error');
    });
  });

  describe('refreshIfNeeded', () => {
    it('should fetch if never fetched before', async () => {
      (authStore.user as any) = { uid: 'test-user' };
      (authStore.getIdToken as any).mockResolvedValue('test-token');
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tier: TIERS.PREMIUM }),
      });

      monetizationStore.lastFetched = null;

      await monetizationStore.refreshIfNeeded();

      expect(fetch).toHaveBeenCalled();
    });

    it('should fetch if cache expired', async () => {
      (authStore.user as any) = { uid: 'test-user' };
      (authStore.getIdToken as any).mockResolvedValue('test-token');
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tier: TIERS.PREMIUM }),
      });

      // Set last fetch to 6 minutes ago
      monetizationStore.lastFetched = new Date(Date.now() - 6 * 60 * 1000);

      await monetizationStore.refreshIfNeeded();

      expect(fetch).toHaveBeenCalled();
    });

    it('should not fetch if cache is fresh', async () => {
      monetizationStore.lastFetched = new Date();

      await monetizationStore.refreshIfNeeded();

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should force fetch regardless of cache', async () => {
      (authStore.user as any) = { uid: 'test-user' };
      (authStore.getIdToken as any).mockResolvedValue('test-token');
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tier: TIERS.PREMIUM }),
      });

      monetizationStore.lastFetched = new Date();

      await monetizationStore.refresh();

      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset to default state', () => {
      monetizationStore.tier = TIERS.PREMIUM;
      monetizationStore.isLoading = true;
      monetizationStore.error = 'Some error';
      monetizationStore.lastFetched = new Date();

      monetizationStore.reset();

      expect(monetizationStore.tier).toBe(TIERS.FREE);
      expect(monetizationStore.isLoading).toBe(false);
      expect(monetizationStore.error).toBe(null);
      expect(monetizationStore.lastFetched).toBe(null);
    });
  });
});
