import { describe, it, expect } from 'vitest';
import { DEFAULT_FEATURE_POLICIES } from './features';
import { FEATURE_KEYS, FeatureFlagKey } from './shapes';
import { TierId, TIERS } from '@uth/domain';

describe('Feature System', () => {
  describe('Tier Constants', () => {
    it('should define all tier IDs', () => {
      expect(TIERS.ANONYMOUS).toBe('anonymous');
      expect(TIERS.FREE).toBe('free');
      expect(TIERS.PREMIUM).toBe('premium');
    });
  });

  describe('FEATURE_KEYS', () => {
    it('should define master switch features', () => {
      expect(FEATURE_KEYS.MONETIZATION).toBe('monetization');
      expect(FEATURE_KEYS.AUTH).toBe('auth');
      expect(FEATURE_KEYS.PAYMENTS).toBe('payments');
    });

    it('should define premium features', () => {
      expect(FEATURE_KEYS.EXCEL_EXPORT).toBe('excel_export');
      expect(FEATURE_KEYS.EXCEL_IMPORT).toBe('excel_import');
      expect(FEATURE_KEYS.PDF_IMPORT).toBe('pdf_import');
      expect(FEATURE_KEYS.CLIPBOARD_IMPORT).toBe('clipboard_import');
    });

    it('should define UI features', () => {
      expect(FEATURE_KEYS.RISK_CHART).toBe('risk_chart');
    });
  });

  describe('DEFAULT_FEATURE_POLICIES', () => {
    it('should define anonymous tier features', () => {
      const anonymousFeatures = Object.entries(DEFAULT_FEATURE_POLICIES)
        .filter(([_, policy]) => policy.minTier === TIERS.ANONYMOUS)
        .map(([featureKey]) => featureKey);

      expect(anonymousFeatures).toContain(FEATURE_KEYS.MONETIZATION);
      expect(anonymousFeatures).toContain(FEATURE_KEYS.AUTH);
      expect(anonymousFeatures).toContain(FEATURE_KEYS.PAYMENTS);
      expect(anonymousFeatures).toContain(FEATURE_KEYS.CLIPBOARD_IMPORT);
    });

    it('should define free tier features', () => {
      const freeFeatures = Object.entries(DEFAULT_FEATURE_POLICIES)
        .filter(([_, policy]) => policy.minTier === TIERS.FREE)
        .map(([featureKey]) => featureKey);

      expect(freeFeatures).not.toContain(FEATURE_KEYS.PDF_IMPORT);
      // CLIPBOARD_IMPORT is now ANONYMOUS tier, not FREE
    });

    it('should define premium tier features', () => {
      const premiumFeatures = Object.entries(DEFAULT_FEATURE_POLICIES)
        .filter(([_, policy]) => policy.minTier === TIERS.PREMIUM)
        .map(([featureKey]) => featureKey);

      expect(premiumFeatures).toContain(FEATURE_KEYS.PDF_IMPORT);
      expect(premiumFeatures).toContain(FEATURE_KEYS.RISK_CHART);
    });

    it('should have all features defined', () => {
      const allFeatures = Object.values(FEATURE_KEYS);
      const definedFeatures = Object.keys(DEFAULT_FEATURE_POLICIES);

      expect(definedFeatures).toEqual(expect.arrayContaining(allFeatures));
      expect(definedFeatures.length).toBe(allFeatures.length);
    });

    it('should mark master switches as disabled by default', () => {
      expect(DEFAULT_FEATURE_POLICIES[FEATURE_KEYS.MONETIZATION].enabled).toBe(
        false,
      );      
    });

    it('should mark enabled features correctly', () => {
      expect(DEFAULT_FEATURE_POLICIES[FEATURE_KEYS.EXCEL_EXPORT].enabled).toBe(
        true,
      );
      expect(DEFAULT_FEATURE_POLICIES[FEATURE_KEYS.EXCEL_IMPORT].enabled).toBe(
        true,
      );
      expect(
        DEFAULT_FEATURE_POLICIES[FEATURE_KEYS.CLIPBOARD_IMPORT].enabled,
      ).toBe(true);
    });

    it('should define tier hierarchy correctly', () => {
      // Master switches - ANONYMOUS (lowest tier)
      expect(DEFAULT_FEATURE_POLICIES[FEATURE_KEYS.MONETIZATION].minTier).toBe(
        TIERS.ANONYMOUS,
      );
      expect(DEFAULT_FEATURE_POLICIES[FEATURE_KEYS.AUTH].minTier).toBe(
        TIERS.ANONYMOUS,
      );
      expect(
        DEFAULT_FEATURE_POLICIES[FEATURE_KEYS.CLIPBOARD_IMPORT].minTier,
      ).toBe(TIERS.ANONYMOUS);

      // Free tier features
      expect(DEFAULT_FEATURE_POLICIES[FEATURE_KEYS.EXCEL_EXPORT].minTier).toBe(
        TIERS.FREE,
      );
        expect(DEFAULT_FEATURE_POLICIES[FEATURE_KEYS.EXCEL_IMPORT].minTier).toBe(
        TIERS.FREE,
      );

      // Premium tier features (highest tier)
      expect(DEFAULT_FEATURE_POLICIES[FEATURE_KEYS.PDF_IMPORT].minTier).toBe(
        TIERS.PREMIUM,
      );
      expect(DEFAULT_FEATURE_POLICIES[FEATURE_KEYS.RISK_CHART].minTier).toBe(
        TIERS.PREMIUM,
      );
    });

    it('should have required policy fields for all features', () => {
      Object.entries(DEFAULT_FEATURE_POLICIES).forEach(
        ([featureKey, policy]) => {
          expect(policy).toHaveProperty('enabled');
          expect(policy).toHaveProperty('minTier');
          expect(typeof policy.enabled).toBe('boolean');
          expect(['anonymous', 'free', 'premium']).toContain(policy.minTier);
        },
      );
    });
  });

  describe('Type Safety', () => {
    it('should have correct TypeScript types', () => {
      // This test ensures TypeScript compilation works correctly
      const featureKey: FeatureFlagKey = FEATURE_KEYS.EXCEL_EXPORT;
      const tierId: TierId = TIERS.FREE;

      expect(typeof featureKey).toBe('string');
      expect(typeof tierId).toBe('string');
    });
  });
});
