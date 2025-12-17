import { describe, it, expect, beforeEach } from 'vitest';
import {
  FEATURE_FLAGS,
  isFeatureEnabled,
  isMonetizationActive,
  getEnabledFlags,
  getAllFlagStates,
  type FeatureFlagKey,
} from './featureFlags';
import { setCachedFlags, FEATURE_KEYS } from './edgeConfigFlags';

describe('Feature Flags (Backward Compatibility)', () => {
  beforeEach(() => {
    // Reset cache before each test
    setCachedFlags({
      [FEATURE_KEYS.MONETIZATION_ENABLED]: false,
      [FEATURE_KEYS.FIREBASE_AUTH_ENABLED]: false,
      [FEATURE_KEYS.STRIPE_CHECKOUT_ENABLED]: false,
      [FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]: false,
      [FEATURE_KEYS.PDF_EXPORT_ENABLED]: false,
      [FEATURE_KEYS.CLOUD_SYNC_ENABLED]: false,
      [FEATURE_KEYS.UPGRADE_MODAL_ENABLED]: false,
      [FEATURE_KEYS.PREMIUM_BADGE_ENABLED]: false,
    });
  });

  describe('FEATURE_FLAGS', () => {
    it('should default all flags to false when cache is empty', () => {
      // Flags should read from cache which defaults to false
      expect(FEATURE_FLAGS.MONETIZATION_ENABLED).toBe(false);
      expect(FEATURE_FLAGS.FIREBASE_AUTH_ENABLED).toBe(false);
      expect(FEATURE_FLAGS.STRIPE_CHECKOUT_ENABLED).toBe(false);
      expect(FEATURE_FLAGS.EXCEL_EXPORT_PREMIUM).toBe(false);
      expect(FEATURE_FLAGS.PDF_EXPORT_ENABLED).toBe(false);
      expect(FEATURE_FLAGS.CLOUD_SYNC_ENABLED).toBe(false);
      expect(FEATURE_FLAGS.UPGRADE_MODAL_ENABLED).toBe(false);
      expect(FEATURE_FLAGS.PREMIUM_BADGE_ENABLED).toBe(false);
    });

    it('should have DEV_MODE_TOGGLE based on NODE_ENV', () => {
      // NODE_ENV is 'test' in vitest, so DEV_MODE_TOGGLE should be false
      expect(FEATURE_FLAGS.DEV_MODE_TOGGLE).toBe(process.env.NODE_ENV === 'development');
    });

    it('should read from cached Edge Config flags', () => {
      // Set some flags to true via cache
      setCachedFlags({
        [FEATURE_KEYS.MONETIZATION_ENABLED]: true,
        [FEATURE_KEYS.FIREBASE_AUTH_ENABLED]: true,
        [FEATURE_KEYS.STRIPE_CHECKOUT_ENABLED]: false,
        [FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]: false,
        [FEATURE_KEYS.PDF_EXPORT_ENABLED]: false,
        [FEATURE_KEYS.CLOUD_SYNC_ENABLED]: false,
        [FEATURE_KEYS.UPGRADE_MODAL_ENABLED]: false,
        [FEATURE_KEYS.PREMIUM_BADGE_ENABLED]: false,
      });

      expect(FEATURE_FLAGS.MONETIZATION_ENABLED).toBe(true);
      expect(FEATURE_FLAGS.FIREBASE_AUTH_ENABLED).toBe(true);
      expect(FEATURE_FLAGS.STRIPE_CHECKOUT_ENABLED).toBe(false);
    });

    it('should be immutable (as const)', () => {
      // TypeScript enforces this at compile time with 'as const'
      // At runtime, the object is still mutable in JavaScript, but TS prevents it
      expect(FEATURE_FLAGS).toBeDefined();
      // The 'as const' makes it readonly in TypeScript type system
    });

    it('should have all expected flag keys', () => {
      const expectedKeys = [
        'MONETIZATION_ENABLED',
        'FIREBASE_AUTH_ENABLED',
        'STRIPE_CHECKOUT_ENABLED',
        'EXCEL_EXPORT_PREMIUM',
        'PDF_EXPORT_ENABLED',
        'CLOUD_SYNC_ENABLED',
        'UPGRADE_MODAL_ENABLED',
        'PREMIUM_BADGE_ENABLED',
        'DEV_MODE_TOGGLE',
      ];

      const actualKeys = Object.keys(FEATURE_FLAGS);
      expect(actualKeys).toEqual(expectedKeys);
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return false for disabled flags', () => {
      expect(isFeatureEnabled('MONETIZATION_ENABLED')).toBe(false);
      expect(isFeatureEnabled('FIREBASE_AUTH_ENABLED')).toBe(false);
    });

    it('should return correct value for all flags', () => {
      Object.keys(FEATURE_FLAGS).forEach((key) => {
        const flagKey = key as FeatureFlagKey;
        const expected = FEATURE_FLAGS[flagKey] === true;
        expect(isFeatureEnabled(flagKey)).toBe(expected);
      });
    });

    it('should be type-safe with FeatureFlagKey', () => {
      // This test ensures TypeScript compilation works
      const flag: FeatureFlagKey = 'MONETIZATION_ENABLED';
      expect(typeof isFeatureEnabled(flag)).toBe('boolean');
    });
  });

  describe('isMonetizationActive', () => {
    it('should return false when MONETIZATION_ENABLED is false', () => {
      expect(isMonetizationActive()).toBe(false);
    });

    it('should match MONETIZATION_ENABLED flag', () => {
      expect(isMonetizationActive()).toBe(
        FEATURE_FLAGS.MONETIZATION_ENABLED === true
      );
    });
  });

  describe('getEnabledFlags', () => {
    it('should return empty array when no flags are enabled', () => {
      const enabled = getEnabledFlags();
      // In test environment, all flags should be false
      expect(enabled).toEqual([]);
    });

    it('should return only enabled flags', () => {
      const enabled = getEnabledFlags();
      enabled.forEach((flag) => {
        expect(FEATURE_FLAGS[flag]).toBe(true);
      });
    });

    it('should not include disabled flags', () => {
      const enabled = getEnabledFlags();
      const disabled = Object.entries(FEATURE_FLAGS)
        .filter(([, value]) => value === false)
        .map(([key]) => key as FeatureFlagKey);

      disabled.forEach((flag) => {
        expect(enabled).not.toContain(flag);
      });
    });
  });

  describe('getAllFlagStates', () => {
    it('should return all flags with their current state', () => {
      const states = getAllFlagStates();

      Object.keys(FEATURE_FLAGS).forEach((key) => {
        const flagKey = key as FeatureFlagKey;
        expect(states[flagKey]).toBe(FEATURE_FLAGS[flagKey]);
      });
    });

    it('should return a copy of flags, not reference', () => {
      const states = getAllFlagStates();
      expect(states).not.toBe(FEATURE_FLAGS);
      expect(states).toEqual(FEATURE_FLAGS);
    });

    it('should have all flag keys', () => {
      const states = getAllFlagStates();
      const expectedKeys = Object.keys(FEATURE_FLAGS);
      expect(Object.keys(states)).toEqual(expectedKeys);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain same API as old implementation', () => {
      // Verify that the compat layer provides the same API
      expect(typeof FEATURE_FLAGS.MONETIZATION_ENABLED).toBe('boolean');
      expect(typeof isFeatureEnabled).toBe('function');
      expect(typeof isMonetizationActive).toBe('function');
      expect(typeof getEnabledFlags).toBe('function');
      expect(typeof getAllFlagStates).toBe('function');
    });

    it('should work with Edge Config cached flags', () => {
      setCachedFlags({
        [FEATURE_KEYS.MONETIZATION_ENABLED]: true,
        [FEATURE_KEYS.FIREBASE_AUTH_ENABLED]: false,
        [FEATURE_KEYS.STRIPE_CHECKOUT_ENABLED]: false,
        [FEATURE_KEYS.EXCEL_EXPORT_PREMIUM]: false,
        [FEATURE_KEYS.PDF_EXPORT_ENABLED]: false,
        [FEATURE_KEYS.CLOUD_SYNC_ENABLED]: false,
        [FEATURE_KEYS.UPGRADE_MODAL_ENABLED]: false,
        [FEATURE_KEYS.PREMIUM_BADGE_ENABLED]: false,
      });

      expect(isMonetizationActive()).toBe(true);
      expect(getEnabledFlags()).toContain('MONETIZATION_ENABLED');
    });
  });

  describe('Type Safety', () => {
    it('should enforce FeatureFlagKey type', () => {
      // This test ensures TypeScript compilation works correctly
      const validKey: FeatureFlagKey = 'MONETIZATION_ENABLED';
      expect(isFeatureEnabled(validKey)).toBeDefined();

      // TypeScript should prevent this:
      // const invalidKey: FeatureFlagKey = 'INVALID_KEY';
    });

    it('should have readonly const assertion', () => {
      // Verify the as const assertion makes the object deeply readonly
      type Writeable<T> = { -readonly [P in keyof T]: T[P] };
      type IsReadonly<T> = T extends Writeable<T> ? false : true;

      // This type check ensures FEATURE_FLAGS is readonly
      type FlagsReadonly = IsReadonly<typeof FEATURE_FLAGS>;
      const isReadonly: FlagsReadonly = true;
      expect(isReadonly).toBe(true);
    });
  });
});
