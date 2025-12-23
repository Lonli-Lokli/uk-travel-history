// Unified Feature Flag System with Vercel Edge Config
// Single source of truth for feature flags with type safety
// Supports both client-side and server-side usage

import { get } from '@vercel/edge-config';
import { logger } from '@uth/utils';
/**
 * Feature flag identifiers (typed constants)
 * These match the keys in Vercel Edge Config
 */
export const FEATURE_KEYS = {
  // Master switches
  MONETIZATION: 'monetization',
  AUTH: 'firebase_auth',
  PAYMENTS: 'stripe_checkout',

  // Premium features
  EXCEL_EXPORT: 'excel_export',
  EXCEL_IMPORT: 'excel_import',
  PDF_IMPORT: 'pdf_import',
  CLIPBOARD_IMPORT: 'clipboard_import',

  // UI features
  RISK_CHART: 'risk_chart',
} as const;

export type FeatureFlagKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export const DEFAULT_FEATURE_STATES: Record<FeatureFlagKey, boolean> = {
  // Master switches
  [FEATURE_KEYS.MONETIZATION]: false,
  [FEATURE_KEYS.AUTH]: false,
  [FEATURE_KEYS.PAYMENTS]: false,

  // Premium features
  [FEATURE_KEYS.EXCEL_EXPORT]: true,
  [FEATURE_KEYS.EXCEL_IMPORT]: true,
  [FEATURE_KEYS.PDF_IMPORT]: false,
  [FEATURE_KEYS.CLIPBOARD_IMPORT]: true,
  // UI features
  [FEATURE_KEYS.RISK_CHART]: false,
};
/**
 * Feature flag configuration from Vercel Edge Config
 */
export interface FeatureFlag {
  /** Whether the feature is enabled */
  enabled: boolean;
  /** Percentage of users to roll out to (0-100) */
  rolloutPercentage?: number;
  /** Specific user IDs to include in beta */
  betaUsers?: string[];
}

/**
 * Edge Config feature flags schema
 */
export type EdgeConfigFlags = Record<string, FeatureFlag>;

/**
 * In-memory cache for feature flags (used client-side)
 * This is populated by server components and passed to client
 */
let cachedFlags: Record<FeatureFlagKey, boolean> | null = null;

/**
 * Set cached feature flags (called from server components)
 * @param flags - The flags to cache (or null to clear cache)
 */
export function setCachedFlags(
  flags: Record<FeatureFlagKey, boolean> | null,
): void {
  cachedFlags = flags;
}

/**
 * Get cached feature flags (used client-side)
 * @returns The cached flags or default values
 */
export function getCachedFlags(): Record<FeatureFlagKey, boolean> {
  if (cachedFlags) {
    return cachedFlags;
  }

  // Default all flags to false if not cached
  return Object.values(FEATURE_KEYS).reduce(
    (acc, key) => {
      acc[key] = DEFAULT_FEATURE_STATES[key];
      return acc;
    },
    {} as Record<FeatureFlagKey, boolean>,
  );
}

/**
 * SERVER-SIDE ONLY: Check if a feature is enabled via Vercel Edge Config
 *
 * This function fetches from Edge Config with fallback logic:
 * 1. First checks Vercel Edge Config (runtime control)
 * 2. Applies rollout percentage and beta user logic
 * 3. Falls back to disabled state on error
 *
 * @param featureKey - The feature identifier to check
 * @param userId - Optional user ID for rollout percentage and beta user checks
 * @returns Promise<boolean> indicating if the feature is enabled
 *
 * @example
 * // Server-side usage
 * const isEnabled = await isFeatureEnabled('excel_export_premium', userId);
 * if (isEnabled) {
 *   // Proceed with feature
 * }
 */
export async function isFeatureEnabled(
  featureKey: FeatureFlagKey,
  userId?: string,
): Promise<boolean> {
  try {
    const flags = await get<EdgeConfigFlags>('features');

    if (!flags) {
      // Edge Config not configured, default to disabled for safety
      console.warn(
        `Edge Config not configured, defaulting ${featureKey} to disabled`,
      );
      return DEFAULT_FEATURE_STATES[featureKey];
    }

    const flag = flags[featureKey];

    if (!flag || !flag.enabled) {
      return false;
    }

    // Check beta user list
    if (userId && flag.betaUsers?.includes(userId)) {
      return true;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && userId) {
      const userHash = hashUserId(userId, featureKey);
      return userHash % 100 < flag.rolloutPercentage;
    }

    // Feature is enabled without restrictions
    return flag.enabled;
  } catch (error) {
    logger.error('[Feature Flags] Error checking feature flag', error, {
      featureKey,
    });
    return DEFAULT_FEATURE_STATES[featureKey];
  }
}

/**
 * Hash a user ID for consistent rollout percentage assignment
 * Includes feature-specific salt to enable independent rollouts per feature
 *
 * @param userId - The user ID to hash
 * @param featureKey - The feature key for feature-specific hashing
 * @returns A number between 0-99 for percentage-based rollout
 */
function hashUserId(userId: string, featureKey: string): number {
  // Combine userId and featureKey for feature-specific hashing
  const input = `${userId}:${featureKey}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * SERVER-SIDE ONLY: Get all feature flags from Edge Config
 * Useful for server components that need to pass flags to client
 *
 * @param userId - Optional user ID for personalized flag evaluation
 * @returns Promise<Record<FeatureFlagKey, boolean>> All feature flags evaluated
 *
 * @example
 * // In server component
 * const flags = await getAllFeatureFlags(userId);
 * return <ClientComponent flags={flags} />;
 */
export async function getAllFeatureFlags(
  userId?: string,
): Promise<Record<FeatureFlagKey, boolean>> {
  const result: Record<FeatureFlagKey, boolean> = {} as Record<
    FeatureFlagKey,
    boolean
  >;

  for (const key of Object.values(FEATURE_KEYS)) {
    result[key] = await isFeatureEnabled(key, userId);
  }

  return result;
}

/**
 * CLIENT-SIDE: Check if a feature is enabled using cached flags
 *
 * This must be used on the client-side. Cached flags are set by server components.
 * If flags are not cached, defaults to false (disabled).
 *
 * @param featureKey - The feature identifier to check
 * @returns boolean indicating if the feature is enabled
 *
 * @example
 * // In client component
 * const isEnabled = isFeatureEnabledClient('firebase_auth_enabled');
 * if (isEnabled) {
 *   return <LoginButton />;
 * }
 */
export function isFeatureEnabledClient(featureKey: FeatureFlagKey): boolean {
  const flags = getCachedFlags();
  return flags[featureKey] ?? false;
}

/**
 * Check if Edge Config is available and working
 *
 * @returns Promise<boolean> indicating if Edge Config is accessible
 */
export async function isEdgeConfigAvailable(): Promise<boolean> {
  try {
    await get('features');
    return true;
  } catch {
    return false;
  }
}
