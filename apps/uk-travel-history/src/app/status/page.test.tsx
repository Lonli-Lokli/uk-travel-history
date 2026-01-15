import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusPage from './page';
import * as features from '@uth/features';
import * as db from '@uth/db';
import { FEATURE_KEYS } from '@uth/features';

// Mock the features module
vi.mock('@uth/features', async () => {
  const actual = await vi.importActual('@uth/features');
  return {
    ...actual,
    getAllFeaturePolicies: vi.fn(),
  };
});

vi.mock('@uth/db', async () => {
  const actual = await vi.importActual('@uth/db');
  return {
    ...actual,
    isDbAlive: vi.fn(),
  };
});

// Mock feature gate context
vi.mock('@uth/widgets', () => ({
  useFeatureGateContext: vi.fn(() => ({
    monetizationStore: {
      hasFeatureAccess: vi.fn(() => false),
      getMinimumTier: vi.fn(() => 'anonymous'),
      isLoading: false,
      isAuthenticated: false,
      tier: 'anonymous',
    },
    authStore: {
      user: null,
    },
    paymentStore: {
      openPaymentModal: vi.fn(),
    },
  })),
}));

describe('StatusPage', () => {
  const mockPolicies:  Record<features.FeatureFlagKey, features.FeaturePolicy> = {
    [FEATURE_KEYS.MONETIZATION]: { enabled: false, minTier: 'anonymous' as const },
    [FEATURE_KEYS.AUTH]: { enabled: false, minTier: 'anonymous' as const },
    [FEATURE_KEYS.PAYMENTS]: { enabled: false, minTier: 'anonymous' as const },
    [FEATURE_KEYS.EXCEL_EXPORT]: { enabled: true, minTier: 'premium' as const },
    [FEATURE_KEYS.EXCEL_IMPORT]: { enabled: true, minTier: 'premium' as const },
    [FEATURE_KEYS.PDF_IMPORT]: { enabled: false, minTier: 'premium' as const },
    [FEATURE_KEYS.CLIPBOARD_IMPORT]: { enabled: true, minTier: 'anonymous' as const },
    [FEATURE_KEYS.RISK_CHART]: { enabled: false, minTier: 'anonymous' as const },
    [FEATURE_KEYS.MULTI_GOAL_TRACKING]: {enabled: false, minTier: 'premium' as const}
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(features.getAllFeaturePolicies).mockResolvedValue(mockPolicies);
    vi.mocked(db.isDbAlive).mockResolvedValue(true);
  });

  describe('Page Structure', () => {
    it('should render the page title', async () => {
      const page = await StatusPage();
      const { container } = render(page);

      const title = container.querySelector('h1');
      expect(title?.textContent).toBe('Feature Access Status');
    });

    it('should display all three feature categories', async () => {
      const page = await StatusPage();
      render(page);

      expect(screen.getByText('Master Switches')).toBeTruthy();
      expect(screen.getByText('Premium Features')).toBeTruthy();
      expect(screen.getByText('UI Features')).toBeTruthy();
    });
  });

  describe('Feature Display', () => {
    it('should display all master switch features', async () => {
      const page = await StatusPage();
      render(page);

      expect(screen.getByText('Monetization')).toBeTruthy();
      expect(screen.getByText('Authentication')).toBeTruthy();
      expect(screen.getByText('Payments')).toBeTruthy();
    });

    it('should display all premium features', async () => {
      const page = await StatusPage();
      render(page);

      expect(screen.getByText('Excel Export')).toBeTruthy();
      expect(screen.getByText('Excel Import')).toBeTruthy();
      expect(screen.getByText('PDF Import')).toBeTruthy();
      expect(screen.getByText('Clipboard Import')).toBeTruthy();
    });

    it('should display all UI features', async () => {
      const page = await StatusPage();
      render(page);

      expect(screen.getByText('Risk Chart')).toBeTruthy();
    });

    it('should display feature keys as code elements', async () => {
      const page = await StatusPage();
      const { container } = render(page);

      const codeElements = container.querySelectorAll('code');
      const codeTexts = Array.from(codeElements).map((el) => el.textContent);

      expect(codeTexts).toContain('monetization');
      expect(codeTexts).toContain('auth');
      expect(codeTexts).toContain('excel_export');
    });
  });

  describe('Data Source Indicator', () => {
    it('should show database source when Supabase is available', async () => {
      vi.mocked(db.isDbAlive).mockResolvedValue(true);

      const page = await StatusPage();
      render(page);

      expect(screen.getByText(/Database \(live policies\)/)).toBeTruthy();
    });

    it('should show fallback source when Supabase is unavailable', async () => {
      vi.mocked(db.isDbAlive).mockResolvedValue(false);

      const page = await StatusPage();
      render(page);

      expect(screen.getByText(/Using default fallback values/)).toBeTruthy();
    });
  });

  describe('Legend Section', () => {
    it('should display the feature access information legend', async () => {
      const page = await StatusPage();
      render(page);

      expect(screen.getByText('Feature Access Information')).toBeTruthy();
    });

    it('should explain tier requirements', async () => {
      const page = await StatusPage();
      const { container } = render(page);

      const legendText = container.textContent || '';
      expect(legendText).toContain('Anonymous:');
      expect(legendText).toContain('Free:');
      expect(legendText).toContain('Premium:');
    });
  });

  describe('Feature State Detection', () => {
    it('should call getAllFeaturePolicies on render', async () => {
      await StatusPage();

      expect(features.getAllFeaturePolicies).toHaveBeenCalledTimes(1);
    });

    it('should call isSupabaseFeaturePoliciesAvailable on render', async () => {
      await StatusPage();

      expect(db.isDbAlive).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have semantic HTML structure', async () => {
      const page = await StatusPage();
      const { container } = render(page);

      expect(container.querySelector('h1')).toBeTruthy();
      expect(container.querySelector('h2')).toBeTruthy();
      expect(container.querySelector('h3')).toBeTruthy();
    });

    it('should have descriptive text for each feature', async () => {
      const page = await StatusPage();
      render(page);

      expect(screen.getByText('Master switch for monetization features')).toBeTruthy();
      expect(screen.getByText('Export travel history to Excel format')).toBeTruthy();
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive layout classes', async () => {
      const page = await StatusPage();
      const { container } = render(page);

      const mainContainer = container.querySelector('.max-w-6xl');
      expect(mainContainer).toBeTruthy();
    });

    it('should have proper padding and spacing', async () => {
      const page = await StatusPage();
      const { container } = render(page);

      // Check for responsive padding classes
      const paddedElements = container.querySelectorAll('[class*="p-4"], [class*="p-6"], [class*="p-8"]');
      expect(paddedElements.length).toBeGreaterThan(0);
    });
  });
});
