// Feature Flag Configuration System
// Enables controlled rollout of monetization features using Vercel environment variables
// See RFC-007 for detailed documentation

/**
 * Feature Flags Configuration
 *
 * Uses environment variables with NEXT_PUBLIC_ prefix for client-side access.
 * All flags default to false (disabled) for safety.
 *
 * To enable a feature:
 * 1. Set environment variable to 'true' in Vercel dashboard or .env.local
 * 2. Redeploy (or wait for edge cache to clear)
 *
 * Example:
 * NEXT_PUBLIC_FF_MONETIZATION=true
 */
export const FEATURE_FLAGS = {
  // Master switch for entire monetization system
  MONETIZATION_ENABLED: process.env.NEXT_PUBLIC_FF_MONETIZATION === 'true',

  // Authentication
  FIREBASE_AUTH_ENABLED: process.env.NEXT_PUBLIC_FF_FIREBASE_AUTH === 'true',

  // Payment features
  STRIPE_CHECKOUT_ENABLED:
    process.env.NEXT_PUBLIC_FF_STRIPE_CHECKOUT === 'true',

  // Individual premium features (allow granular control)
  EXCEL_EXPORT_PREMIUM:
    process.env.NEXT_PUBLIC_FF_EXCEL_EXPORT_PREMIUM === 'true',
  PDF_EXPORT_ENABLED: process.env.NEXT_PUBLIC_FF_PDF_EXPORT === 'true',
  CLOUD_SYNC_ENABLED: process.env.NEXT_PUBLIC_FF_CLOUD_SYNC === 'true',

  // UI features
  UPGRADE_MODAL_ENABLED: process.env.NEXT_PUBLIC_FF_UPGRADE_MODAL === 'true',
  PREMIUM_BADGE_ENABLED: process.env.NEXT_PUBLIC_FF_PREMIUM_BADGE === 'true',

  // Development helpers
  DEV_MODE_TOGGLE: process.env.NODE_ENV === 'development',
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

/**
 * Helper to check if a feature flag is enabled
 * @param flag - The feature flag key to check
 * @returns boolean indicating if the flag is enabled
 *
 * @example
 * if (isFeatureEnabled('MONETIZATION_ENABLED')) {
 *   // Show premium features
 * }
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[flag] === true;
}

/**
 * Helper to check if monetization is active
 * Convenience wrapper for checking the master monetization flag
 *
 * @returns boolean indicating if monetization features should be shown
 *
 * @example
 * if (isMonetizationActive()) {
 *   return <PremiumBadge />;
 * }
 */
export function isMonetizationActive(): boolean {
  return FEATURE_FLAGS.MONETIZATION_ENABLED;
}

/**
 * Get all enabled feature flags
 * Useful for debugging and admin dashboards
 *
 * @returns Array of enabled feature flag keys
 */
export function getEnabledFlags(): FeatureFlagKey[] {
  return Object.entries(FEATURE_FLAGS)
    .filter(([, value]) => value === true)
    .map(([key]) => key as FeatureFlagKey);
}

/**
 * Get feature flag status for all flags
 * Useful for debugging and admin dashboards
 *
 * @returns Record of all flags and their current state
 */
export function getAllFlagStates(): Record<FeatureFlagKey, boolean> {
  return { ...FEATURE_FLAGS };
}
