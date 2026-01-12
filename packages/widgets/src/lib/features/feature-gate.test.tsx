import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeatureGate } from './feature-gate';

describe('FeatureGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Access Granted', () => {
    it('should render children when access is granted', () => {
      render(
        <FeatureGate hasAccess={true}>
          <div>Premium Content</div>
        </FeatureGate>,
      );

      expect(screen.getByText('Premium Content')).toBeTruthy();
    });

    it('should render children normally for all modes when access granted', () => {
      const modes: Array<'hide' | 'disable' | 'blur' | 'paywall'> = [
        'hide',
        'disable',
        'blur',
        'paywall',
      ];

      modes.forEach((mode) => {
        const { unmount } = render(
          <FeatureGate hasAccess={true} mode={mode}>
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
      render(
        <FeatureGate
          hasAccess={false}
          isLoading={true}
          mode="hide"
          fallback={<div>Loading...</div>}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      expect(screen.getByText('Loading...')).toBeTruthy();
      expect(screen.queryByText('Premium Content')).not.toBeTruthy();
    });

    it('should return null when loading in hide mode without fallback', () => {
      const { container } = render(
        <FeatureGate hasAccess={false} isLoading={true} mode="hide">
          <div>Premium Content</div>
        </FeatureGate>,
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show blurred content when loading in other modes', () => {
      render(
        <FeatureGate hasAccess={false} isLoading={true} mode="disable">
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
        <FeatureGate hasAccess={false} mode="hide">
          <div>Premium Content</div>
        </FeatureGate>,
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show fallback when access denied with fallback', () => {
      render(
        <FeatureGate
          hasAccess={false}
          mode="hide"
          fallback={<div>Upgrade to Premium</div>}
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
        <FeatureGate hasAccess={false} mode="blur">
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
      const onGatedClick = vi.fn();

      render(
        <FeatureGate
          hasAccess={false}
          mode="blur"
          gateReason="upgrade"
          onGatedClick={onGatedClick}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlay = screen.getByRole('button', {
        name: 'Upgrade to access this feature',
      });
      fireEvent.click(overlay);

      expect(onGatedClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mode: disable', () => {
    it('should render disabled blurred content when access denied', () => {
      render(
        <FeatureGate hasAccess={false} mode="disable">
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const content = screen.getByText('Premium Content');
      expect(content).toBeTruthy();
      expect(content.parentElement?.className).toContain('blur-[1.5px]');
      expect(content.parentElement?.className).toContain('opacity-40');
      expect(content.parentElement?.className).toContain('grayscale');
    });

    it('should call callback on click when provided', () => {
      const onGatedClick = vi.fn();

      render(
        <FeatureGate
          hasAccess={false}
          mode="disable"
          gateReason="upgrade"
          onGatedClick={onGatedClick}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      // Click on the overlay (there are two clickable areas in disable mode)
      const overlays = screen.getAllByRole('button');
      fireEvent.click(overlays[0]);

      expect(onGatedClick).toHaveBeenCalledTimes(1);
    });

    it('should handle click on badge in disable mode', () => {
      const onGatedClick = vi.fn();

      render(
        <FeatureGate
          hasAccess={false}
          mode="disable"
          gateReason="upgrade"
          onGatedClick={onGatedClick}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const badge = screen.getByText('Premium');
      fireEvent.click(badge.parentElement!);

      expect(onGatedClick).toHaveBeenCalled();
    });
  });

  describe('Mode: paywall', () => {
    it('should render clickable content in paywall mode', () => {
      const onGatedClick = vi.fn();

      render(
        <FeatureGate
          hasAccess={false}
          mode="paywall"
          gateReason="upgrade"
          onGatedClick={onGatedClick}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onGatedClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Gate Reason', () => {
    it('should show login badge when gateReason is login', () => {
      const onGatedClick = vi.fn();

      render(
        <FeatureGate
          hasAccess={false}
          mode="disable"
          gateReason="login"
          onGatedClick={onGatedClick}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      expect(screen.getByText('Sign up')).toBeTruthy();
    });

    it('should show premium badge when gateReason is upgrade', () => {
      const onGatedClick = vi.fn();

      render(
        <FeatureGate
          hasAccess={false}
          mode="disable"
          gateReason="upgrade"
          onGatedClick={onGatedClick}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      expect(screen.getByText('Premium')).toBeTruthy();
    });

    it('should show correct aria-label for login gate', () => {
      render(
        <FeatureGate
          hasAccess={false}
          mode="blur"
          gateReason="login"
          onGatedClick={vi.fn()}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlay = screen.getByRole('button', {
        name: 'Sign up to access this feature',
      });
      expect(overlay).toBeTruthy();
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should handle Enter key in blur mode', () => {
      const onGatedClick = vi.fn();

      render(
        <FeatureGate
          hasAccess={false}
          mode="blur"
          gateReason="upgrade"
          onGatedClick={onGatedClick}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlay = screen.getByRole('button');
      fireEvent.keyDown(overlay, { key: 'Enter' });

      expect(onGatedClick).toHaveBeenCalledTimes(1);
    });

    it('should handle Space key in disable mode', () => {
      const onGatedClick = vi.fn();

      render(
        <FeatureGate
          hasAccess={false}
          mode="disable"
          gateReason="upgrade"
          onGatedClick={onGatedClick}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlays = screen.getAllByRole('button');
      fireEvent.keyDown(overlays[0], { key: ' ' });

      expect(onGatedClick).toHaveBeenCalledTimes(1);
    });

    it('should handle Enter key in paywall mode', () => {
      const onGatedClick = vi.fn();

      render(
        <FeatureGate
          hasAccess={false}
          mode="paywall"
          gateReason="upgrade"
          onGatedClick={onGatedClick}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });

      expect(onGatedClick).toHaveBeenCalledTimes(1);
    });

    it('should handle Space key in paywall mode', () => {
      const onGatedClick = vi.fn();

      render(
        <FeatureGate
          hasAccess={false}
          mode="paywall"
          gateReason="upgrade"
          onGatedClick={onGatedClick}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: ' ' });

      expect(onGatedClick).toHaveBeenCalledTimes(1);
    });

    it('should not handle other keys', () => {
      const onGatedClick = vi.fn();

      render(
        <FeatureGate
          hasAccess={false}
          mode="blur"
          gateReason="upgrade"
          onGatedClick={onGatedClick}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const overlay = screen.getByRole('button');
      fireEvent.keyDown(overlay, { key: 'Tab' });

      expect(onGatedClick).not.toHaveBeenCalled();
    });

    it('should not handle other keys in paywall mode', () => {
      const onGatedClick = vi.fn();

      render(
        <FeatureGate
          hasAccess={false}
          mode="paywall"
          gateReason="upgrade"
          onGatedClick={onGatedClick}
        >
          <div>Premium Content</div>
        </FeatureGate>,
      );

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Escape' });

      expect(onGatedClick).not.toHaveBeenCalled();
    });
  });

  describe('Event Propagation', () => {
    it('should stop propagation on click', () => {
      const parentClick = vi.fn();
      const childClick = vi.fn();

      render(
        <div onClick={parentClick}>
          <FeatureGate
            hasAccess={false}
            mode="disable"
            gateReason="upgrade"
            onGatedClick={childClick}
          >
            <div>Premium Content</div>
          </FeatureGate>
        </div>,
      );

      const overlays = screen.getAllByRole('button');
      fireEvent.click(overlays[0]);

      expect(childClick).toHaveBeenCalledTimes(1);
      expect(parentClick).not.toHaveBeenCalled();
    });
  });
});
