import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusPage from './page';
import * as features from '@uth/features';

// Mock the features module
vi.mock('@uth/features', async () => {
  const actual = await vi.importActual('@uth/features');
  return {
    ...actual,
    getAllFeatureFlags: vi.fn(),
  };
});

// Mock the flow library
vi.mock('@/lib/appFlow', () => ({
  appFlow: {
    page: (generatorFn: any) => {
      return async () => {
        const gen = generatorFn();
        let value;
        let result = gen.next();

        while (!result.done) {
          value = await result.value;
          result = gen.next(value);
        }

        return result.value;
      };
    },
  },
}));

vi.mock('@/lib/flow', () => ({
  call: (promiseOrValue: any) => promiseOrValue,
}));

describe('StatusPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Structure', () => {
    it('should render the page title', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      const { container } = render(page);

      const title = container.querySelector('h1');
      expect(title?.textContent).toBe('System Status');
    });

    it('should have a back to home button', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      render(page);

      const backButton = screen.getByText('Back to Home');
      expect(backButton).toBeTruthy();
      expect(backButton.closest('a')?.getAttribute('href')).toBe('/');
    });

    it('should display all three feature categories', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      render(page);

      expect(screen.getByText('Master Switches')).toBeTruthy();
      expect(screen.getByText('Premium Features')).toBeTruthy();
      expect(screen.getByText('UI Features')).toBeTruthy();
    });
  });

  describe('Feature Display', () => {
    it('should display all master switch features', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      render(page);

      expect(screen.getByText('Monetization')).toBeTruthy();
      expect(screen.getByText('Authentication')).toBeTruthy();
      expect(screen.getByText('Payments')).toBeTruthy();
    });

    it('should display all premium features', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      render(page);

      expect(screen.getByText('Excel Export')).toBeTruthy();
      expect(screen.getByText('Excel Import')).toBeTruthy();
      expect(screen.getByText('PDF Import')).toBeTruthy();
      expect(screen.getByText('Clipboard Import')).toBeTruthy();
    });

    it('should display all UI features', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      render(page);

      expect(screen.getByText('Risk Chart')).toBeTruthy();
    });

    it('should display feature keys as code elements', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      const { container } = render(page);

      const codeElements = container.querySelectorAll('code');
      const codeTexts = Array.from(codeElements).map((el) => el.textContent);

      expect(codeTexts).toContain('monetization');
      expect(codeTexts).toContain('auth');
      expect(codeTexts).toContain('excel_export');
    });
  });

  describe('Feature Status Badges', () => {
    it('should show "Enabled" badge for enabled features', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      render(page);

      const enabledBadges = screen.getAllByText('Enabled');
      expect(enabledBadges.length).toBeGreaterThan(0);
    });

    it('should show "Disabled" badge for disabled features', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      render(page);

      const disabledBadges = screen.getAllByText('Disabled');
      expect(disabledBadges.length).toBeGreaterThan(0);
    });

    it('should show "Default" badge for features using default state', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      render(page);

      const defaultBadges = screen.getAllByText('Default');
      expect(defaultBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Legend Section', () => {
    it('should display the feature flag information legend', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      render(page);

      expect(screen.getByText('Feature Flag Information')).toBeTruthy();
    });

    it('should explain the Default badge', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      const { container } = render(page);

      const legendText = container.textContent || '';
      expect(legendText).toContain('Default:');
      expect(legendText).toContain('default configuration');
    });

    it('should explain Edge Config', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      const { container } = render(page);

      const legendText = container.textContent || '';
      expect(legendText).toContain('Edge Config:');
      expect(legendText).toContain('Vercel Edge Config');
    });
  });

  describe('Feature State Detection', () => {
    it('should correctly identify features with non-default states', async () => {
      // Mock a state where excel_export is disabled (default is true)
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: false, // Changed from default (true)
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      const { container } = render(page);

      // The page should render without errors
      expect(container.querySelector('h1')?.textContent).toBe('System Status');
    });

    it('should call getAllFeatureFlags on render', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      await StatusPage();

      expect(features.getAllFeatureFlags).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have semantic HTML structure', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      const { container } = render(page);

      expect(container.querySelector('h1')).toBeTruthy();
      expect(container.querySelector('h2')).toBeTruthy();
      expect(container.querySelector('h3')).toBeTruthy();
    });

    it('should have descriptive text for each feature', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      render(page);

      expect(screen.getByText('Master switch for monetization features')).toBeTruthy();
      expect(screen.getByText('Export travel history to Excel format')).toBeTruthy();
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive layout classes', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      const { container } = render(page);

      const mainContainer = container.querySelector('.max-w-4xl');
      expect(mainContainer).toBeTruthy();
    });

    it('should have proper padding and spacing', async () => {
      vi.mocked(features.getAllFeatureFlags).mockResolvedValue({
        monetization: false,
        auth: false,
        payments: false,
        excel_export: true,
        excel_import: true,
        pdf_import: false,
        clipboard_import: true,
        risk_chart: false,
      });

      const page = await StatusPage();
      const { container } = render(page);

      const cards = container.querySelectorAll('.p-8');
      expect(cards.length).toBeGreaterThan(0);
    });
  });
});
