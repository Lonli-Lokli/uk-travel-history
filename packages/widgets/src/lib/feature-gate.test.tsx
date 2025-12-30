import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeatureGate } from './feature-gate';
import { FEATURE_KEYS } from '@uth/features';

describe('FeatureGate', () => {
  const mockMonetizationStore = {
    hasFeatureAccess: vi.fn(),
    getMinimumTier: vi.fn(),
    isLoading: false,
    isAuthenticated: false,
  };

  const mockAuthStore = {
    user: null,
  };

  const mockPaymentStore = {
    openPaymentModal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMonetizationStore.isLoading = false;
    mockMonetizationStore.isAuthenticated = false;
    mockMonetizationStore.hasFeatureAccess.mockReturnValue(false);
    mockMonetizationStore.getMinimumTier.mockReturnValue('premium');
    mockAuthStore.user = null;
  });

  describe('Access Granted', () => {
    it('should render children when access is granted', () => {
      mockMonetizationStore.hasFeatureAccess.mockReturnValue(true);

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      expect(screen.getByText('Premium Content')).toBeTruthy();
    });

    it('should render children normally for all modes when access granted', () => {
      mockMonetizationStore.hasFeatureAccess.mockReturnValue(true);

      const modes: Array<'hide' | 'disable' | 'blur' | 'paywall'> = [
        'hide',
        'disable',
        'blur',
        'paywall',
      ];

      modes.forEach((mode) => {
        const { unmount } = render(
          <FeatureGate
            feature={FEATURE_KEYS.EXCEL_EXPORT}
            mode={mode}
            monetizationStore={mockMonetizationStore}
          >
            <div>Content for {mode}</div>
          </FeatureGate>,
        );

        expect(screen.getByText(`Content for ${mode}`)).toBeTruthy();
        unmount();
      });
    });
  });

  describe('Loading State', () => {
    it('should show fallback when loading in hide mode', () => {
      mockMonetizationStore.isLoading = true;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="hide"
          fallback={<div>Loading...</div>}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      expect(screen.getByText('Loading...')).toBeTruthy();
      expect(screen.queryByText('Premium Content')).not.toBeTruthy();
    });

    it('should return null when loading in hide mode without fallback', () => {
      mockMonetizationStore.isLoading = true;

      const { container } = render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="hide"
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show blurred content when loading in other modes', () => {
      mockMonetizationStore.isLoading = true;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="disable"
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const content = screen.getByText('Premium Content');
      expect(content).toBeTruthy();
      expect(content.parentElement?.className).toContain('opacity-50');
      expect(content.parentElement?.className).toContain('pointer-events-none');
    });
  });

  describe('Mode: hide', () => {
    it('should return null when access denied without fallback', () => {
      const { container } = render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="hide"
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show fallback when access denied with fallback', () => {
      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="hide"
          fallback={<div>Upgrade to Premium</div>}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      expect(screen.getByText('Upgrade to Premium')).toBeTruthy();
      expect(screen.queryByText('Premium Content')).not.toBeTruthy();
    });
  });

  describe('Mode: blur', () => {
    it('should render blurred content when access denied', () => {
      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="blur"
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const content = screen.getByText('Premium Content');
      expect(content).toBeTruthy();
      expect(content.parentElement?.className).toContain('blur-[3px]');
      expect(content.parentElement?.className).toContain('select-none');
      expect(content.parentElement?.className).toContain('pointer-events-none');
      expect(content.parentElement?.className).toContain('grayscale');
    });

    it('should have clickable overlay in blur mode', () => {
      const onUpgradeClick = vi.fn();
      mockMonetizationStore.isAuthenticated = true;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="blur"
          onUpgradeClick={onUpgradeClick}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlay = screen.getByRole('button', {
        name: 'Upgrade to access this feature',
      });
      fireEvent.click(overlay);

      expect(onUpgradeClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mode: disable', () => {
    it('should render disabled blurred content when access denied', () => {
      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="disable"
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const content = screen.getByText('Premium Content');
      expect(content).toBeTruthy();
      expect(content.parentElement?.className).toContain('blur-[1.5px]');
      expect(content.parentElement?.className).toContain('opacity-40');
      expect(content.parentElement?.className).toContain('grayscale');
    });

    it('should call upgrade callback on click when authenticated', () => {
      const onUpgradeClick = vi.fn();
      mockMonetizationStore.isAuthenticated = true;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="disable"
          onUpgradeClick={onUpgradeClick}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlay = screen.getByRole('button');
      fireEvent.click(overlay);

      expect(onUpgradeClick).toHaveBeenCalledTimes(1);
    });

    it('should open payment modal when no callback provided', () => {
      mockMonetizationStore.isAuthenticated = true;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="disable"
          monetizationStore={mockMonetizationStore}
          paymentStore={mockPaymentStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlay = screen.getByRole('button');
      fireEvent.click(overlay);

      expect(mockPaymentStore.openPaymentModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mode: paywall', () => {
    it('should render clickable content in paywall mode', () => {
      const onUpgradeClick = vi.fn();
      mockMonetizationStore.isAuthenticated = true;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="paywall"
          onUpgradeClick={onUpgradeClick}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onUpgradeClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Authentication Flow', () => {
    it('should call login callback when not authenticated', () => {
      const onLoginClick = vi.fn();

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="disable"
          onLoginClick={onLoginClick}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlay = screen.getByRole('button');
      fireEvent.click(overlay);

      expect(onLoginClick).toHaveBeenCalledTimes(1);
    });

    it('should check authStore.user if monetizationStore not authenticated', () => {
      const onUpgradeClick = vi.fn();
      mockMonetizationStore.isAuthenticated = false;
      mockAuthStore.user = { uid: 'test-user' } as any;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="disable"
          onUpgradeClick={onUpgradeClick}
          monetizationStore={mockMonetizationStore}
          authStore={mockAuthStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlay = screen.getByRole('button');
      fireEvent.click(overlay);

      // Should call upgrade (not login) because user is authenticated via authStore
      expect(onUpgradeClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should handle Enter key in blur mode', () => {
      const onUpgradeClick = vi.fn();
      mockMonetizationStore.isAuthenticated = true;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="blur"
          onUpgradeClick={onUpgradeClick}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlay = screen.getByRole('button');
      fireEvent.keyDown(overlay, { key: 'Enter' });

      expect(onUpgradeClick).toHaveBeenCalledTimes(1);
    });

    it('should handle Space key in disable mode', () => {
      const onUpgradeClick = vi.fn();
      mockMonetizationStore.isAuthenticated = true;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="disable"
          onUpgradeClick={onUpgradeClick}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlay = screen.getByRole('button');
      fireEvent.keyDown(overlay, { key: ' ' });

      expect(onUpgradeClick).toHaveBeenCalledTimes(1);
    });

    it('should handle Enter key in paywall mode', () => {
      const onUpgradeClick = vi.fn();
      mockMonetizationStore.isAuthenticated = true;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="paywall"
          onUpgradeClick={onUpgradeClick}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });

      expect(onUpgradeClick).toHaveBeenCalledTimes(1);
    });

    it('should handle Space key in paywall mode', () => {
      const onUpgradeClick = vi.fn();
      mockMonetizationStore.isAuthenticated = true;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="paywall"
          onUpgradeClick={onUpgradeClick}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: ' ' });

      expect(onUpgradeClick).toHaveBeenCalledTimes(1);
    });

    it('should not handle other keys', () => {
      const onUpgradeClick = vi.fn();
      mockMonetizationStore.isAuthenticated = true;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="blur"
          onUpgradeClick={onUpgradeClick}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlay = screen.getByRole('button');
      fireEvent.keyDown(overlay, { key: 'Tab' });

      expect(onUpgradeClick).not.toHaveBeenCalled();
    });

    it('should not handle other keys in paywall mode', () => {
      const onUpgradeClick = vi.fn();
      mockMonetizationStore.isAuthenticated = true;

      render(
        <FeatureGate
          feature={FEATURE_KEYS.EXCEL_EXPORT}
          mode="paywall"
          onUpgradeClick={onUpgradeClick}
          monetizationStore={mockMonetizationStore}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Escape' });

      expect(onUpgradeClick).not.toHaveBeenCalled();
    });
  });

  describe('Event Propagation', () => {
    it('should stop propagation on click', () => {
      const parentClick = vi.fn();
      const childClick = vi.fn();
      mockMonetizationStore.isAuthenticated = true;

      render(
        <div onClick={parentClick}>
          <FeatureGate
            feature={FEATURE_KEYS.EXCEL_EXPORT}
            mode="disable"
            onUpgradeClick={childClick}
            monetizationStore={mockMonetizationStore}
          >
            <div>Premium Content</div>
          </FeatureGate>
        </div>,
      );

      const overlay = screen.getByRole('button');
      fireEvent.click(overlay);

      expect(childClick).toHaveBeenCalledTimes(1);
      expect(parentClick).not.toHaveBeenCalled();
    });
  });
});
