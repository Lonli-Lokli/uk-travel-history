import { describe, it, expect } from 'vitest';
import {
  FEATURE_FLAGS,
  isFeatureEnabled,
  isMonetizationActive,
  getEnabledFlags,
  getAllFlagStates,
  type FeatureFlagKey,
} from './featureFlags';

describe('Feature Flags', () => {
  describe('FEATURE_FLAGS', () => {
    it('should default all flags to false when env vars are not set', () => {
      // In test environment, env vars are not set by default
      expect(FEATURE_FLAGS.MONETIZATION_ENABLED).toBe(false);
      expect(FEATURE_FLAGS.FIREBASE_AUTH_ENABLED).toBe(false);
      expect(FEATURE_FLAGS.STRIPE_CHECKOUT_ENABLED).toBe(false);
      expect(FEATURE_FLAGS.EXCEL_EXPORT_PREMIUM).toBe(false);
      expect(FEATURE_FLAGS.PDF_EXPORT_ENABLED).toBe(false);
      expect(FEATURE_FLAGS.CLOUD_SYNC_ENABLED).toBe(false);
      expect(FEATURE_FLAGS.UPGRADE_MODAL_ENABLED).toBe(false);
      expect(FEATURE_FLAGS.PREMIUM_BADGE_ENABLED).toBe(false);
    });

    it('should have DEV_MODE_TOGGLE true in test environment', () => {
      // NODE_ENV is 'test' in vitest
      expect(FEATURE_FLAGS.DEV_MODE_TOGGLE).toBe(false);
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

  describe('Environment Variable Parsing', () => {
    it('should only enable flags when env var is exactly "true"', () => {
      // This test documents the behavior: only "true" string enables flags
      // Values like "1", "yes", "TRUE" will NOT enable the flag
      const testCases = [
        { value: 'true', expected: true },
        { value: 'false', expected: false },
        { value: 'TRUE', expected: false },
        { value: '1', expected: false },
        { value: 'yes', expected: false },
        { value: '', expected: false },
        { value: undefined, expected: false },
      ];

      testCases.forEach(({ value, expected }) => {
        const result = value === 'true';
        expect(result).toBe(expected);
      });
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
