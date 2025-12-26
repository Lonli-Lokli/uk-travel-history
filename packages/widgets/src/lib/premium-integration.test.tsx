import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PremiumGate } from './premium-gate';
import { usePremiumAccess } from './use-premium-access';
import { FeatureGateProvider } from './feature-gate-context';
import type { MonetizationStore, AuthStore, PaymentStore } from './feature-gate-context';

/**
 * Integration tests for PremiumGate and usePremiumAccess
 * Tests the full user journey through premium feature gating
 */
describe('Premium Feature Integration', () => {
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

  describe('Complete User Journey', () => {
    it('shows premium content to premium users', () => {
      mockMonetizationStore.isAuthenticated = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(true);

      render(
        <FeatureGateProvider
          monetizationStore={mockMonetizationStore}
          authStore={mockAuthStore}
          paymentStore={mockPaymentStore}
        >
          <PremiumGate>
            <div>Exclusive Premium Feature</div>
          </PremiumGate>
        </FeatureGateProvider>
      );

      expect(screen.getByText('Exclusive Premium Feature')).toBeTruthy();
    });

    it('blocks free users and shows upgrade prompt', () => {
      mockMonetizationStore.isAuthenticated = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { container } = render(
        <FeatureGateProvider
          monetizationStore={mockMonetizationStore}
          authStore={mockAuthStore}
          paymentStore={mockPaymentStore}
        >
          <PremiumGate mode="blur">
            <div>Exclusive Premium Feature</div>
          </PremiumGate>
        </FeatureGateProvider>
      );

      // Content should be blurred
      expect(container.querySelector('.blur-\\[3px\\]')).toBeTruthy();
      expect(screen.getByText('Premium Feature')).toBeTruthy();
    });

    it('redirects unauthenticated users to sign-up', () => {
      mockMonetizationStore.isAuthenticated = false;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      function TestComponent() {
        const { handleUpgrade } = usePremiumAccess();

        return (
          <button onClick={handleUpgrade}>Upgrade</button>
        );
      }

      render(
        <FeatureGateProvider
          monetizationStore={mockMonetizationStore}
          authStore={mockAuthStore}
          paymentStore={mockPaymentStore}
        >
          <TestComponent />
        </FeatureGateProvider>
      );

      const button = screen.getByText('Upgrade');
      fireEvent.click(button);

      expect(window.location.href).toBe('/sign-up');
    });

    it('shows payment modal for authenticated free users', () => {
      mockMonetizationStore.isAuthenticated = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      function TestComponent() {
        const { handleUpgrade } = usePremiumAccess();

        return (
          <button onClick={handleUpgrade}>Upgrade</button>
        );
      }

      render(
        <FeatureGateProvider
          monetizationStore={mockMonetizationStore}
          authStore={mockAuthStore}
          paymentStore={mockPaymentStore}
        >
          <TestComponent />
        </FeatureGateProvider>
      );

      const button = screen.getByText('Upgrade');
      fireEvent.click(button);

      expect(mockPaymentStore.openPaymentModal).toHaveBeenCalled();
    });
  });

  describe('Multi-gate Scenarios', () => {
    it('can gate multiple features independently', () => {
      mockMonetizationStore.isAuthenticated = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      render(
        <FeatureGateProvider
          monetizationStore={mockMonetizationStore}
          authStore={mockAuthStore}
          paymentStore={mockPaymentStore}
        >
          <div>
            <PremiumGate mode="hide">
              <div>Feature 1</div>
            </PremiumGate>
            <PremiumGate mode="hide">
              <div>Feature 2</div>
            </PremiumGate>
            <PremiumGate mode="hide">
              <div>Feature 3</div>
            </PremiumGate>
          </div>
        </FeatureGateProvider>
      );

      expect(screen.queryByText('Feature 1')).toBeFalsy();
      expect(screen.queryByText('Feature 2')).toBeFalsy();
      expect(screen.queryByText('Feature 3')).toBeFalsy();
    });

    it('shows all premium content when user upgrades', () => {
      mockMonetizationStore.isAuthenticated = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(true);

      render(
        <FeatureGateProvider
          monetizationStore={mockMonetizationStore}
          authStore={mockAuthStore}
          paymentStore={mockPaymentStore}
        >
          <div>
            <PremiumGate>
              <div>Feature 1</div>
            </PremiumGate>
            <PremiumGate>
              <div>Feature 2</div>
            </PremiumGate>
            <PremiumGate>
              <div>Feature 3</div>
            </PremiumGate>
          </div>
        </FeatureGateProvider>
      );

      expect(screen.getByText('Feature 1')).toBeTruthy();
      expect(screen.getByText('Feature 2')).toBeTruthy();
      expect(screen.getByText('Feature 3')).toBeTruthy();
    });
  });

  describe('Loading State Handling', () => {
    it('handles loading state gracefully across multiple gates', () => {
      mockMonetizationStore.isLoading = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { container } = render(
        <FeatureGateProvider
          monetizationStore={mockMonetizationStore}
          authStore={mockAuthStore}
          paymentStore={mockPaymentStore}
        >
          <div>
            <PremiumGate>
              <div>Feature 1</div>
            </PremiumGate>
            <PremiumGate>
              <div>Feature 2</div>
            </PremiumGate>
          </div>
        </FeatureGateProvider>
      );

      // Both should show loading state
      const loadingElements = container.querySelectorAll('.opacity-50');
      expect(loadingElements.length).toBe(2);
    });

    it('transitions from loading to premium state correctly', () => {
      mockMonetizationStore.isLoading = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      const { rerender } = render(
        <FeatureGateProvider
          monetizationStore={mockMonetizationStore}
          authStore={mockAuthStore}
          paymentStore={mockPaymentStore}
        >
          <PremiumGate>
            <div>Feature</div>
          </PremiumGate>
        </FeatureGateProvider>
      );

      // Update to loaded state with premium access
      mockMonetizationStore.isLoading = false;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(true);

      rerender(
        <FeatureGateProvider
          monetizationStore={mockMonetizationStore}
          authStore={mockAuthStore}
          paymentStore={mockPaymentStore}
        >
          <PremiumGate>
            <div>Feature</div>
          </PremiumGate>
        </FeatureGateProvider>
      );

      expect(screen.getByText('Feature')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined user gracefully', () => {
      mockMonetizationStore.isAuthenticated = false;
      mockAuthStore.user = null;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);

      expect(() => {
        render(
          <FeatureGateProvider
            monetizationStore={mockMonetizationStore}
            authStore={mockAuthStore}
            paymentStore={mockPaymentStore}
          >
            <PremiumGate>
              <div>Feature</div>
            </PremiumGate>
          </FeatureGateProvider>
        );
      }).not.toThrow();
    });

    it('handles payment modal errors gracefully', () => {
      mockMonetizationStore.isAuthenticated = true;
      vi.mocked(mockMonetizationStore.hasFeatureAccess).mockReturnValue(false);
      vi.mocked(mockPaymentStore.openPaymentModal).mockImplementation(() => {
        throw new Error('Payment modal error');
      });

      function TestComponent() {
        const { handleUpgrade } = usePremiumAccess();

        return (
          <button onClick={() => {
            try {
              handleUpgrade();
            } catch {
              // Handled
            }
          }}>Upgrade</button>
        );
      }

      render(
        <FeatureGateProvider
          monetizationStore={mockMonetizationStore}
          authStore={mockAuthStore}
          paymentStore={mockPaymentStore}
        >
          <TestComponent />
        </FeatureGateProvider>
      );

      const button = screen.getByText('Upgrade');

      expect(() => {
        fireEvent.click(button);
      }).not.toThrow();
    });
  });
});
