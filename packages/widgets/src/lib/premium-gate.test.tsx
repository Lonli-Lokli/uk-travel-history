import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PremiumGate } from './premium-gate';
import { FeatureGateProvider } from './feature-gate-context';
import { FEATURES } from '@uth/features';
import type { MonetizationStore, AuthStore, PaymentStore } from './feature-gate-context';

describe('PremiumGate', () => {
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
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <FeatureGateProvider
        monetizationStore={mockMonetizationStore}
        authStore={mockAuthStore}
        paymentStore={mockPaymentStore}
      >
        {ui}
      </FeatureGateProvider>
    );
  };

  describe('Premium Access', () => {
    it('renders children when user has premium access', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(true);

      renderWithProviders(
        <PremiumGate>
          <div>Premium Content</div>
        </PremiumGate>
      );

      expect(screen.getByText('Premium Content')).toBeTruthy();
      expect(mockMonetizationStore.hasFeatureAccess).toHaveBeenCalledWith(
        FEATURES.EXCEL_EXPORT
      );
    });

    it('does not blur content when user has premium access', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(true);

      const { container } = renderWithProviders(
        <PremiumGate>
          <div>Premium Content</div>
        </PremiumGate>
      );

      expect(container.querySelector('.blur-\\[3px\\]')).toBeFalsy();
    });
  });

  describe('Free User Access', () => {
    it('blurs content by default when user does not have premium access', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { container } = renderWithProviders(
        <PremiumGate>
          <div>Premium Content</div>
        </PremiumGate>
      );

      expect(container.querySelector('.blur-\\[3px\\]')).toBeTruthy();
    });

    it('hides content when mode is "hide"', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      renderWithProviders(
        <PremiumGate mode="hide">
          <div>Premium Content</div>
        </PremiumGate>
      );

      expect(screen.queryByText('Premium Content')).toBeFalsy();
    });

    it('shows fallback when mode is "hide" and fallback is provided', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      renderWithProviders(
        <PremiumGate mode="hide" fallback={<div>Upgrade to Premium</div>}>
          <div>Premium Content</div>
        </PremiumGate>
      );

      expect(screen.getByText('Upgrade to Premium')).toBeTruthy();
      expect(screen.queryByText('Premium Content')).toBeFalsy();
    });

    it('shows premium badge when mode is "disable"', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      renderWithProviders(
        <PremiumGate mode="disable">
          <div>Premium Content</div>
        </PremiumGate>
      );

      expect(screen.getByText('Premium')).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('shows loading state while checking subscription', () => {
      mockMonetizationStore.isLoading = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { container } = renderWithProviders(
        <PremiumGate>
          <div>Premium Content</div>
        </PremiumGate>
      );

      expect(container.querySelector('.opacity-50')).toBeTruthy();
      expect(container.querySelector('.pointer-events-none')).toBeTruthy();
    });

    it('shows fallback during loading when mode is "hide"', () => {
      mockMonetizationStore.isLoading = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      renderWithProviders(
        <PremiumGate mode="hide" fallback={<div>Loading...</div>}>
          <div>Premium Content</div>
        </PremiumGate>
      );

      expect(screen.getByText('Loading...')).toBeTruthy();
    });
  });

  describe('Render Modes', () => {
    it('supports blur mode', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { container } = renderWithProviders(
        <PremiumGate mode="blur">
          <div>Content</div>
        </PremiumGate>
      );

      expect(container.querySelector('.blur-\\[3px\\]')).toBeTruthy();
      expect(screen.getByText('Premium Feature')).toBeTruthy();
    });

    it('supports disable mode', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { container } = renderWithProviders(
        <PremiumGate mode="disable">
          <div>Content</div>
        </PremiumGate>
      );

      expect(container.querySelector('.blur-\\[1\\.5px\\]')).toBeTruthy();
      expect(screen.getByText('Premium')).toBeTruthy();
    });

    it('supports hide mode', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      renderWithProviders(
        <PremiumGate mode="hide">
          <div>Content</div>
        </PremiumGate>
      );

      expect(screen.queryByText('Content')).toBeFalsy();
    });

    it('supports paywall mode', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { container } = renderWithProviders(
        <PremiumGate mode="paywall">
          <div>Content</div>
        </PremiumGate>
      );

      expect(container.querySelector('[role="button"]')).toBeTruthy();
    });
  });

  describe('Integration with FeatureGate', () => {
    it('passes onUpgradeClick to underlying FeatureGate', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);
      const onUpgradeClick = vi.fn();

      renderWithProviders(
        <PremiumGate mode="blur" onUpgradeClick={onUpgradeClick}>
          <div>Content</div>
        </PremiumGate>
      );

      // The upgrade button should be present
      expect(screen.getByText('Premium Feature')).toBeTruthy();
    });

    it('checks EXCEL_EXPORT feature specifically', () => {
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(true);

      renderWithProviders(
        <PremiumGate>
          <div>Content</div>
        </PremiumGate>
      );

      expect(mockMonetizationStore.hasFeatureAccess).toHaveBeenCalledWith(
        FEATURES.EXCEL_EXPORT
      );
    });
  });

  describe('Authentication State', () => {
    it('works with authenticated users', () => {
      mockMonetizationStore.isAuthenticated = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(true);

      renderWithProviders(
        <PremiumGate>
          <div>Premium Content</div>
        </PremiumGate>
      );

      expect(screen.getByText('Premium Content')).toBeTruthy();
    });

    it('works with unauthenticated users', () => {
      mockMonetizationStore.isAuthenticated = false;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      renderWithProviders(
        <PremiumGate mode="blur">
          <div>Premium Content</div>
        </PremiumGate>
      );

      expect(screen.getByText('Premium Feature')).toBeTruthy();
    });
  });
});
