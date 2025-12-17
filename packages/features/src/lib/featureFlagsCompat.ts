// Backward compatibility layer for old FEATURE_FLAGS API
// This allows existing code to continue working while we migrate to Edge Config
// DEPRECATED: Use edgeConfigFlags module instead

import { FEATURE_KEYS, getCachedFlags } from './edgeConfigFlags';

/**
 * DEPRECATED: Use FEATURE_KEYS from edgeConfigFlags instead
 *
 * Legacy feature flags object for backward compatibility
 * Values are read from cached Edge Config flags
 */
export const FEATURE_FLAGS = {
  get MONETIZATION_ENABLED(): boolean {
    return getCachedFlags()[FEATURE_KEYS.MONETIZATION_ENABLED] ?? false;
  },
  get FIREBASE_AUTH_ENABLED(): boolean {
    return getCachedFlags()[FEATURE_KEYS.FIREBASE_AUTH_ENABLED] ?? false;
  },
  get STRIPE_CHECKOUT_ENABLED(): boolean {
    return getCachedFlags()[FEATURE_KEYS.STRIPE_CHECKOUT_ENABLED] ?? false;
  },
  get EXCEL_EXPORT_PREMIUM(): boolean {
    return getCachedFlags()[FEATURE_KEYS.EXCEL_EXPORT_PREMIUM] ?? false;
  },
  get PDF_EXPORT_ENABLED(): boolean {
    return getCachedFlags()[FEATURE_KEYS.PDF_EXPORT_ENABLED] ?? false;
  },
  get CLOUD_SYNC_ENABLED(): boolean {
    return getCachedFlags()[FEATURE_KEYS.CLOUD_SYNC_ENABLED] ?? false;
  },
  get UPGRADE_MODAL_ENABLED(): boolean {
    return getCachedFlags()[FEATURE_KEYS.UPGRADE_MODAL_ENABLED] ?? false;
  },
  get PREMIUM_BADGE_ENABLED(): boolean {
    return getCachedFlags()[FEATURE_KEYS.PREMIUM_BADGE_ENABLED] ?? false;
  },
  get DEV_MODE_TOGGLE(): boolean {
    return process.env.NODE_ENV === 'development';
  },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

/**
 * DEPRECATED: Use isFeatureEnabledClient from edgeConfigFlags instead
 *
 * @param flag - The feature flag key to check
 * @returns boolean indicating if the flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[flag] === true;
}

/**
 * DEPRECATED: Use isFeatureEnabledClient(FEATURE_KEYS.MONETIZATION_ENABLED) instead
 *
 * @returns boolean indicating if monetization features should be shown
 */
export function isMonetizationActive(): boolean {
  return FEATURE_FLAGS.MONETIZATION_ENABLED;
}

/**
 * DEPRECATED: Use useFeatureFlags hook instead
 *
 * @returns Array of enabled feature flag keys
 */
export function getEnabledFlags(): FeatureFlagKey[] {
  return Object.entries(FEATURE_FLAGS)
    .filter(([, value]) => value === true)
    .map(([key]) => key as FeatureFlagKey);
}

/**
 * DEPRECATED: Use getCachedFlags from edgeConfigFlags instead
 *
 * @returns Record of all flags and their current state
 */
export function getAllFlagStates(): Record<FeatureFlagKey, boolean> {
  return {
    MONETIZATION_ENABLED: FEATURE_FLAGS.MONETIZATION_ENABLED,
    FIREBASE_AUTH_ENABLED: FEATURE_FLAGS.FIREBASE_AUTH_ENABLED,
    STRIPE_CHECKOUT_ENABLED: FEATURE_FLAGS.STRIPE_CHECKOUT_ENABLED,
    EXCEL_EXPORT_PREMIUM: FEATURE_FLAGS.EXCEL_EXPORT_PREMIUM,
    PDF_EXPORT_ENABLED: FEATURE_FLAGS.PDF_EXPORT_ENABLED,
    CLOUD_SYNC_ENABLED: FEATURE_FLAGS.CLOUD_SYNC_ENABLED,
    UPGRADE_MODAL_ENABLED: FEATURE_FLAGS.UPGRADE_MODAL_ENABLED,
    PREMIUM_BADGE_ENABLED: FEATURE_FLAGS.PREMIUM_BADGE_ENABLED,
    DEV_MODE_TOGGLE: FEATURE_FLAGS.DEV_MODE_TOGGLE,
  };
}
