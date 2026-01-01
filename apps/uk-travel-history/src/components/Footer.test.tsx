import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the footer component', () => {
      const { container } = render(<Footer />);
      const footer = container.querySelector('footer');
      expect(footer).toBeTruthy();
    });

    it('should have proper semantic HTML structure', () => {
      const { container } = render(<Footer />);
      const footer = container.querySelector('footer');
      expect(footer?.tagName).toBe('FOOTER');
    });

    it('should have Terms link but not Status link for non-admin users', () => {
      render(<Footer />);
      const termsLink = screen.getByRole('link', { name: 'Terms and Conditions' });
      const statusLink = screen.queryByRole('link', { name: 'Status' });

      expect(termsLink).toBeTruthy();
      expect(statusLink).toBeFalsy();
    });

    it('should have both Terms and Status links for admin users', () => {
      render(<Footer role="admin" />);
      const termsLink = screen.getByRole('link', { name: 'Terms and Conditions' });
      const statusLink = screen.getByRole('link', { name: 'Status' });

      expect(termsLink).toBeTruthy();
      expect(statusLink).toBeTruthy();
    });

    it('should render developer info trigger button', () => {
      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });
      expect(trigger).toBeTruthy();
    });
  });

  describe('Navigation Links', () => {
    it('should have correct href for Terms link', () => {
      render(<Footer />);
      const termsLink = screen.getByRole('link', { name: 'Terms and Conditions' });
      expect(termsLink.getAttribute('href')).toBe('/terms');
    });

    it('should have correct href for Status link when user is admin', () => {
      render(<Footer role="admin" />);
      const statusLink = screen.getByRole('link', { name: 'Status' });
      expect(statusLink.getAttribute('href')).toBe('/status');
    });

    it('should not render Status link for non-admin users', () => {
      render(<Footer />);
      const statusLink = screen.queryByRole('link', { name: 'Status' });
      expect(statusLink).toBeFalsy();
    });

    it('should have proper hover states on links', () => {
      render(<Footer />);
      const termsLink = screen.getByRole('link', { name: 'Terms and Conditions' });
      expect(termsLink.className).toContain('hover:text-slate-900');
    });
  });

  describe('Developer Info Popover', () => {
    it('should not show popover content initially', () => {
      render(<Footer />);
      expect(screen.queryByText('Build Information')).not.toBeTruthy();
    });

    it('should show popover content when trigger is clicked', () => {
      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });

      fireEvent.click(trigger);

      expect(screen.getByText('Build Information')).toBeTruthy();
    });

    it('should display commit hash in trigger', () => {
      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });

      // Should display first 7 chars of commit hash
      expect(trigger.textContent).toBeTruthy();
      expect(trigger.textContent?.length).toBeGreaterThan(0);
    });

    it('should display commit hash in popover content', () => {
      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });

      fireEvent.click(trigger);

      expect(screen.getByText('Commit:')).toBeTruthy();
    });

    it('should display build time in popover content', () => {
      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });

      fireEvent.click(trigger);

      expect(screen.getByText('Built:')).toBeTruthy();
    });

    it('should display environment in popover content', () => {
      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });

      fireEvent.click(trigger);

      expect(screen.getByText('Environment:')).toBeTruthy();
    });

    it('should close popover when clicking outside', () => {
      const { container } = render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });

      // Open popover
      fireEvent.click(trigger);
      expect(screen.getByText('Build Information')).toBeTruthy();

      // Click outside (on the backdrop)
      const backdrop = container.querySelector('.fixed.inset-0');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      // Popover should be closed
      expect(screen.queryByText('Build Information')).not.toBeTruthy();
    });

    it('should have proper aria-label on trigger', () => {
      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });
      expect(trigger.getAttribute('aria-label')).toBe('View build information');
    });

    it('should show copyright year in trigger', () => {
      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });
      const currentYear = new Date().getFullYear();
      expect(trigger.textContent).toContain(`© ${currentYear}`);
    });
  });

  describe('Accessibility', () => {
    it('should have focus styles on navigation links', () => {
      render(<Footer />);
      const termsLink = screen.getByRole('link', { name: 'Terms and Conditions' });
      expect(termsLink.className).toContain('focus:outline-none');
      expect(termsLink.className).toContain('focus:ring-2');
    });

    it('should have focus styles on developer info trigger', () => {
      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });
      expect(trigger.className).toContain('focus:outline-none');
      expect(trigger.className).toContain('focus:ring-2');
    });

    it('should have proper color contrast', () => {
      render(<Footer />);
      const termsLink = screen.getByRole('link', { name: 'Terms and Conditions' });
      expect(termsLink.className).toContain('text-slate-600');
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive layout classes', () => {
      const { container } = render(<Footer />);
      const layout = container.querySelector('.flex-col.sm\\:flex-row');
      expect(layout).toBeTruthy();
    });

    it('should have responsive gap classes', () => {
      const { container } = render(<Footer />);
      const layout = container.querySelector('.gap-3');
      expect(layout).toBeTruthy();
    });
  });

  describe('Environment Variables', () => {
    it('should handle missing NEXT_PUBLIC_GIT_COMMIT_HASH', () => {
      const originalEnv = process.env.NEXT_PUBLIC_GIT_COMMIT_HASH;
      delete process.env.NEXT_PUBLIC_GIT_COMMIT_HASH;

      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });

      // Open popover to check commit hash inside
      fireEvent.click(trigger);

      // Should fall back to 'dev' in popover content
      const commitCode = screen.getByText('dev');
      expect(commitCode).toBeTruthy();

      process.env.NEXT_PUBLIC_GIT_COMMIT_HASH = originalEnv;
    });

    it('should handle missing NEXT_PUBLIC_BUILD_TIME', () => {
      const originalEnv = process.env.NEXT_PUBLIC_BUILD_TIME;
      delete process.env.NEXT_PUBLIC_BUILD_TIME;

      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });

      fireEvent.click(trigger);

      // Should still render without error
      expect(screen.getByText('Built:')).toBeTruthy();

      process.env.NEXT_PUBLIC_BUILD_TIME = originalEnv;
    });

    it('should display custom git commit hash when provided', () => {
      const originalEnv = process.env.NEXT_PUBLIC_GIT_COMMIT_HASH;
      process.env.NEXT_PUBLIC_GIT_COMMIT_HASH = 'abc123def456';

      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });

      // Open popover to check commit hash
      fireEvent.click(trigger);

      // Should display first 7 characters in popover content
      const commitCode = screen.getByText('abc123d');
      expect(commitCode).toBeTruthy();

      process.env.NEXT_PUBLIC_GIT_COMMIT_HASH = originalEnv;
    });
  });

  describe('Styling', () => {
    it('should have border-top styling', () => {
      const { container } = render(<Footer />);
      const footer = container.querySelector('footer');
      expect(footer?.className).toContain('border-t');
    });

    it('should have white background', () => {
      const { container } = render(<Footer />);
      const footer = container.querySelector('footer');
      expect(footer?.className).toContain('bg-white');
    });

    it('should have proper padding', () => {
      const { container } = render(<Footer />);
      const innerDiv = container.querySelector('.px-3.py-4');
      expect(innerDiv).toBeTruthy();
    });

    it('should have max-width constraint', () => {
      const { container } = render(<Footer />);
      const maxWidthDiv = container.querySelector('.max-w-6xl');
      expect(maxWidthDiv).toBeTruthy();
    });

    it('should have mt-auto for sticky footer behavior', () => {
      const { container } = render(<Footer />);
      const footer = container.querySelector('footer');
      expect(footer?.className).toContain('mt-auto');
    });
  });

  describe('Visual Separator', () => {
    it('should have visual separator between navigation links', () => {
      const { container } = render(<Footer />);
      const separator = container.querySelector('.text-slate-300');
      expect(separator).toBeTruthy();
      expect(separator?.textContent).toBe('•');
    });
  });

  describe('Popover State Management', () => {
    it('should toggle popover state correctly', () => {
      render(<Footer />);
      const trigger = screen.getByRole('button', { name: /view build information/i });

      // Initially closed
      expect(screen.queryByText('Build Information')).not.toBeTruthy();

      // Open
      fireEvent.click(trigger);
      expect(screen.getByText('Build Information')).toBeTruthy();

      // Close via backdrop
      const backdrop = document.querySelector('.fixed.inset-0');
      if (backdrop) {
        fireEvent.click(backdrop);
      }
      expect(screen.queryByText('Build Information')).not.toBeTruthy();

      // Re-open
      fireEvent.click(trigger);
      expect(screen.getByText('Build Information')).toBeTruthy();
    });
  });

  describe('Display Name', () => {
    it('should have displayName set for debugging', () => {
      expect(Footer.displayName).toBe('Footer');
    });
  });
});
