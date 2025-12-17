import { describe, it, expect } from 'vitest';
import {
  FEATURES,
  TIERS,
  TIER_CONFIG,
  FEATURE_METADATA,
  getRequiredTier,
  type FeatureId,
  type TierId,
} from './features';

describe('Feature Registry', () => {
  describe('Constants', () => {
    it('should define all feature IDs', () => {
      expect(FEATURES.BASIC_CALCULATION).toBe('basic_calculation');
      expect(FEATURES.PDF_IMPORT).toBe('pdf_import');
      expect(FEATURES.CSV_IMPORT).toBe('csv_import');
      expect(FEATURES.MANUAL_ENTRY).toBe('manual_entry');
      expect(FEATURES.EXCEL_EXPORT).toBe('excel_export');
      expect(FEATURES.PDF_EXPORT).toBe('pdf_export');
      expect(FEATURES.EMPLOYER_LETTERS).toBe('employer_letters');
      expect(FEATURES.CLOUD_SYNC).toBe('cloud_sync');
      expect(FEATURES.ADVANCED_ANALYTICS).toBe('advanced_analytics');
    });

    it('should define all tier IDs', () => {
      expect(TIERS.FREE).toBe('free');
      expect(TIERS.PREMIUM).toBe('premium');
    });
  });

  describe('TIER_CONFIG', () => {
    it('should define features for free tier', () => {
      const freeFeatures = TIER_CONFIG[TIERS.FREE];
      expect(freeFeatures).toContain(FEATURES.BASIC_CALCULATION);
      expect(freeFeatures).toContain(FEATURES.PDF_IMPORT);
      expect(freeFeatures).toContain(FEATURES.CSV_IMPORT);
      expect(freeFeatures).toContain(FEATURES.MANUAL_ENTRY);
      expect(freeFeatures).toHaveLength(4);
    });

    it('should define features for premium tier', () => {
      const premiumFeatures = TIER_CONFIG[TIERS.PREMIUM];
      expect(premiumFeatures).toContain(FEATURES.BASIC_CALCULATION);
      expect(premiumFeatures).toContain(FEATURES.PDF_IMPORT);
      expect(premiumFeatures).toContain(FEATURES.CSV_IMPORT);
      expect(premiumFeatures).toContain(FEATURES.MANUAL_ENTRY);
      expect(premiumFeatures).toContain(FEATURES.EXCEL_EXPORT);
      expect(premiumFeatures).toContain(FEATURES.PDF_EXPORT);
      expect(premiumFeatures).toContain(FEATURES.EMPLOYER_LETTERS);
      expect(premiumFeatures).toContain(FEATURES.CLOUD_SYNC);
      expect(premiumFeatures).toContain(FEATURES.ADVANCED_ANALYTICS);
    });

    it('should include all features in premium tier', () => {
      const allFeatures = Object.values(FEATURES);
      const premiumFeatures = TIER_CONFIG[TIERS.PREMIUM];
      expect(premiumFeatures).toEqual(expect.arrayContaining(allFeatures));
      expect(premiumFeatures.length).toBe(allFeatures.length);
    });

    it('should not include premium-only features in free tier', () => {
      const freeFeatures = TIER_CONFIG[TIERS.FREE];
      expect(freeFeatures).not.toContain(FEATURES.EXCEL_EXPORT);
      expect(freeFeatures).not.toContain(FEATURES.PDF_EXPORT);
      expect(freeFeatures).not.toContain(FEATURES.EMPLOYER_LETTERS);
      expect(freeFeatures).not.toContain(FEATURES.CLOUD_SYNC);
      expect(freeFeatures).not.toContain(FEATURES.ADVANCED_ANALYTICS);
    });
  });

  describe('FEATURE_METADATA', () => {
    it('should have metadata for all features', () => {
      Object.values(FEATURES).forEach((featureId) => {
        expect(FEATURE_METADATA[featureId]).toBeDefined();
        expect(FEATURE_METADATA[featureId].id).toBe(featureId);
        expect(FEATURE_METADATA[featureId].name).toBeTruthy();
        expect(FEATURE_METADATA[featureId].description).toBeTruthy();
      });
    });

    it('should mark coming soon features correctly', () => {
      expect(FEATURE_METADATA[FEATURES.PDF_EXPORT].comingSoon).toBe(true);
      expect(FEATURE_METADATA[FEATURES.EMPLOYER_LETTERS].comingSoon).toBe(true);
      expect(FEATURE_METADATA[FEATURES.CLOUD_SYNC].comingSoon).toBe(true);
      expect(FEATURE_METADATA[FEATURES.ADVANCED_ANALYTICS].comingSoon).toBe(
        true,
      );
    });

    it('should not mark existing features as coming soon', () => {
      expect(
        FEATURE_METADATA[FEATURES.BASIC_CALCULATION].comingSoon,
      ).toBeUndefined();
      expect(FEATURE_METADATA[FEATURES.PDF_IMPORT].comingSoon).toBeUndefined();
      expect(FEATURE_METADATA[FEATURES.CSV_IMPORT].comingSoon).toBeUndefined();
      expect(
        FEATURE_METADATA[FEATURES.MANUAL_ENTRY].comingSoon,
      ).toBeUndefined();
      expect(
        FEATURE_METADATA[FEATURES.EXCEL_EXPORT].comingSoon,
      ).toBeUndefined();
    });
  });

  describe('getRequiredTier', () => {
    it('should return FREE tier for free features', () => {
      expect(getRequiredTier(FEATURES.BASIC_CALCULATION)).toBe(TIERS.FREE);
      expect(getRequiredTier(FEATURES.PDF_IMPORT)).toBe(TIERS.FREE);
      expect(getRequiredTier(FEATURES.CSV_IMPORT)).toBe(TIERS.FREE);
      expect(getRequiredTier(FEATURES.MANUAL_ENTRY)).toBe(TIERS.FREE);
    });

    it('should return PREMIUM tier for premium-only features', () => {
      expect(getRequiredTier(FEATURES.EXCEL_EXPORT)).toBe(TIERS.PREMIUM);
      expect(getRequiredTier(FEATURES.PDF_EXPORT)).toBe(TIERS.PREMIUM);
      expect(getRequiredTier(FEATURES.EMPLOYER_LETTERS)).toBe(TIERS.PREMIUM);
      expect(getRequiredTier(FEATURES.CLOUD_SYNC)).toBe(TIERS.PREMIUM);
      expect(getRequiredTier(FEATURES.ADVANCED_ANALYTICS)).toBe(TIERS.PREMIUM);
    });

    it('should default to PREMIUM for unknown features', () => {
      // TypeScript would prevent this, but testing runtime behavior
      const unknownFeature = 'unknown_feature' as FeatureId;
      expect(getRequiredTier(unknownFeature)).toBe(TIERS.PREMIUM);
    });
  });

  describe('Type Safety', () => {
    it('should have correct TypeScript types', () => {
      // This test ensures TypeScript compilation works correctly
      const featureId: FeatureId = FEATURES.BASIC_CALCULATION;
      const tierId: TierId = TIERS.FREE;

      expect(typeof featureId).toBe('string');
      expect(typeof tierId).toBe('string');
    });
  });
});
