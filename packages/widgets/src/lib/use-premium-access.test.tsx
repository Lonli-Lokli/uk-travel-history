import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePremiumAccess } from './use-premium-access';
import { FeatureGateProvider } from './feature-gate-context';
import { FEATURES } from '@uth/features';
import type { MonetizationStore, AuthStore, PaymentStore } from './feature-gate-context';

describe('usePremiumAccess', () => {
  let mockMonetizationStore: MonetizationStore;
  let mockAuthStore: AuthStore;
  let mockPaymentStore: PaymentStore;

  beforeEach(() => {
    mockMonetizationStore = {
      hasFeatureAccess: vi.fn(),
      isLoading: false,
      isAuthenticated: false,
    };

    mockAuthStore = {
      user: null,
    };

    mockPaymentStore = {
      openPaymentModal: vi.fn(),
    };

    // Reset location mock
    delete (window as { location?: unknown }).location;
    window.location = { href: '' } as Location;
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <FeatureGateProvider
      monetizationStore={mockMonetizationStore}
      authStore={mockAuthStore}
      paymentStore={mockPaymentStore}
    >
      {children}
    </FeatureGateProvider>
  );

  describe('Premium Access Detection', () => {
    it('returns true when user has premium access', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(true);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      expect(result.current.hasPremiumAccess).toBe(true);
      expect(result.current.isPremium).toBe(true);
    });

    it('returns false when user does not have premium access', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      expect(result.current.hasPremiumAccess).toBe(false);
      expect(result.current.isPremium).toBe(false);
    });

    it('checks EXCEL_EXPORT feature for premium access', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(true);

      renderHook(() => usePremiumAccess(), { wrapper });

      expect(mockMonetizationStore.hasFeatureAccess).toHaveBeenCalledWith(
        FEATURES.EXCEL_EXPORT
      );
    });
  });

  describe('Loading State', () => {
    it('returns loading state from monetization store', () => {
      mockMonetizationStore.isLoading = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('returns false when not loading', () => {
      mockMonetizationStore.isLoading = false;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Authentication State', () => {
    it('returns authenticated from monetization store', () => {
      mockMonetizationStore.isAuthenticated = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      expect(result.current.isAuthenticated).toBe(true);
    });

    it('returns authenticated when authStore has user', () => {
      mockMonetizationStore.isAuthenticated = false;
      mockAuthStore.user = { id: '123' };
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      expect(result.current.isAuthenticated).toBe(true);
    });

    it('returns false when not authenticated', () => {
      mockMonetizationStore.isAuthenticated = false;
      mockAuthStore.user = null;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('handleUpgrade', () => {
    it('redirects to /claim when user is not authenticated', () => {
      mockMonetizationStore.isAuthenticated = false;
      mockAuthStore.user = null;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      result.current.handleUpgrade();

      expect(window.location.href).toBe('/claim');
    });

    it('opens payment modal when user is authenticated', () => {
      mockMonetizationStore.isAuthenticated = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      result.current.handleUpgrade();

      expect(mockPaymentStore.openPaymentModal).toHaveBeenCalled();
    });

    it('opens payment modal when authStore has user', () => {
      mockMonetizationStore.isAuthenticated = false;
      mockAuthStore.user = { id: '123' };
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      result.current.handleUpgrade();

      expect(mockPaymentStore.openPaymentModal).toHaveBeenCalled();
    });
  });

  describe('Store Access', () => {
    it('provides direct access to monetization store', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      expect(result.current.monetizationStore).toBe(mockMonetizationStore);
    });
  });

  describe('Return Value Structure', () => {
    it('returns all expected properties', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(true);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      expect(result.current).toHaveProperty('hasPremiumAccess');
      expect(result.current).toHaveProperty('isPremium');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isAuthenticated');
      expect(result.current).toHaveProperty('handleUpgrade');
      expect(result.current).toHaveProperty('monetizationStore');
    });

    it('isPremium is an alias for hasPremiumAccess', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(true);

      const { result } = renderHook(() => usePremiumAccess(), { wrapper });

      expect(result.current.isPremium).toBe(result.current.hasPremiumAccess);
    });
  });
});
