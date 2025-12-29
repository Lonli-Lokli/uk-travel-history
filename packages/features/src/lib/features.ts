// Unified Feature Flag System with Vercel Edge Config
// Single source of truth for feature flags with type safety
// Supports both client-side and server-side usage

import { get } from '@vercel/edge-config';
import { logger } from '@uth/utils';
import { FEATURE_KEYS, FeatureFlagKey, TierId, TIERS } from './shapes';


/**
 * Feature policy configuration for tier-based access control
 * This allows changing feature tier requirements without code deployment
 *
 * IMPORTANT: This is the source of truth for feature tier configuration
 * - Configure via Vercel Edge Config for runtime control
 * - Prevents client-side bypass with server-side enforcement
 * - Supports three access levels: anonymous, free, premium
 */
export interface FeaturePolicy {
  /** Global kill switch - if false, feature is disabled for everyone */
  enabled: boolean;
  /** Minimum tier required to access this feature */
  minTier: TierId;
  /** Rollout percentage (0-100) for gradual feature rollout */
  rolloutPercentage?: number;
  /** Explicit allowlist of user IDs (bypasses tier check) */
  allowlist?: string[];
  /** Explicit denylist of user IDs (blocks access regardless of tier) */
  denylist?: string[];
  /** Explicit list of beta users who get access regardless of tier */
  betaUsers?: string[];
}

/**
 * Default feature policies (used as fallback if Edge Config unavailable)
 * Conservative defaults: features are enabled but require appropriate tier
 *
 * Tier hierarchy:
 * - ANONYMOUS: No authentication required (most restrictive features)
 * - FREE: Authenticated users with free tier (more features)
 * - PREMIUM: Authenticated users with paid subscription (all features)
 */
export const DEFAULT_FEATURE_POLICIES: Record<FeatureFlagKey, FeaturePolicy> = {
  // Master switches (ANONYMOUS - can be checked without auth)
  [FEATURE_KEYS.MONETIZATION]: {
    enabled: false,
    minTier: TIERS.ANONYMOUS,
  },
  [FEATURE_KEYS.AUTH]: {
    enabled: false,
    minTier: TIERS.ANONYMOUS,
  },
  [FEATURE_KEYS.PAYMENTS]: {
    enabled: false,
    minTier: TIERS.ANONYMOUS,
  },

  // Premium features (require PREMIUM tier)
  [FEATURE_KEYS.EXCEL_EXPORT]: {
    enabled: true,
    minTier: TIERS.PREMIUM,
  },
  [FEATURE_KEYS.EXCEL_IMPORT]: {
    enabled: true,
    minTier: TIERS.PREMIUM,
  },
  [FEATURE_KEYS.PDF_IMPORT]: {
    enabled: false,
    minTier: TIERS.FREE,
  },
  [FEATURE_KEYS.CLIPBOARD_IMPORT]: {
    enabled: true,
    minTier: TIERS.ANONYMOUS,
  },

  // UI features (ANONYMOUS - available to all)
  [FEATURE_KEYS.RISK_CHART]: {
    enabled: false,
    minTier: TIERS.ANONYMOUS,
  },
};


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
      acc[key] = DEFAULT_FEATURE_POLICIES[key].enabled;
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
    const flags = await get<EdgeConfigPolicies>('feature-policies');

    if (!flags) {
      // Edge Config not configured, default to disabled for safety
      logger.warn(
        `Edge Config not configured, defaulting ${featureKey} to disabled`,
      );
      return DEFAULT_FEATURE_POLICIES[featureKey].enabled;
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
      extra: {
        featureKey,
      },
    });
    return DEFAULT_FEATURE_POLICIES[featureKey].enabled;
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

/**
 * Edge Config schema for feature policies
 * Stored under the 'featurePolicies' key in Edge Config
 */
export type EdgeConfigPolicies = Record<FeatureFlagKey, FeaturePolicy>;

/**
 * SERVER-SIDE ONLY: Get feature policy from Edge Config or use default
 * This allows runtime control of feature behavior without redeployment
 *
 * @param featureKey - The feature to check
 * @returns Promise<FeaturePolicy> The feature policy
 *
 * @example
 * // Get policy for a feature
 * const policy = await getFeaturePolicy(FEATURE_KEYS.PDF_IMPORT);
 * if (policy.minTier === TIERS.PREMIUM) {
 *   // Feature requires premium tier
 * }
 */
export async function getFeaturePolicy(
  featureKey: FeatureFlagKey,
): Promise<FeaturePolicy> {
  try {
    // Fetch all policies from Edge Config
    const policies = await get<EdgeConfigPolicies>('feature-policies');

    if (policies && policies[featureKey]) {
      // Merge with defaults to ensure all required fields are present
      return {
        ...DEFAULT_FEATURE_POLICIES[featureKey],
        ...policies[featureKey],
      };
    }

    // Fall back to default policy
    return DEFAULT_FEATURE_POLICIES[featureKey];
  } catch (error) {
    logger.warn('[Feature Policies] Error fetching policy, using defaults', {
      extra: { featureKey, error },
    });
    return DEFAULT_FEATURE_POLICIES[featureKey];
  }
}

/**
 * SERVER-SIDE ONLY: Get all feature policies from Edge Config
 * Useful for batch operations and caching
 *
 * @returns Promise<Record<FeatureFlagKey, FeaturePolicy>> All feature policies
 *
 * @example
 * // Get all policies
 * const policies = await getAllFeaturePolicies();
 * return { policies };
 */
export async function getAllFeaturePolicies(): Promise<
  Record<FeatureFlagKey, FeaturePolicy>
> {
  try {
    const policies = await get<EdgeConfigPolicies>('feature-policies');

    if (!policies) {
      return DEFAULT_FEATURE_POLICIES;
    }

    // Merge Edge Config policies with defaults
    const result: Record<FeatureFlagKey, FeaturePolicy> = { ...DEFAULT_FEATURE_POLICIES };

    for (const featureKey of Object.keys(DEFAULT_FEATURE_POLICIES) as FeatureFlagKey[]) {
      if (policies[featureKey]) {
        result[featureKey] = {
          ...DEFAULT_FEATURE_POLICIES[featureKey],
          ...policies[featureKey],
        };
      }
    }

    return result;
  } catch (error) {
    logger.error('[Feature Policies] Error fetching policies', error);
    return DEFAULT_FEATURE_POLICIES;
  }
}
