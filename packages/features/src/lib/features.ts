// Unified Feature Flag System with Supabase
// Single source of truth for feature flags with type safety
// Supports both client-side and server-side usage
// Uses Next.js caching with midnight revalidation to minimize database reads

import { unstable_cache } from 'next/cache';
import { logger } from '@uth/utils';
import { FEATURE_KEYS, FeatureFlagKey } from './shapes';
import { TIERS, TierId } from '@uth/domain';

import { getAllFeaturePolicies as dbGetAllFeaturePolicies } from '@uth/db';

/**
 * Feature policy configuration for tier-based access control
 * This allows changing feature tier requirements without code deployment
 *
 * IMPORTANT: This is the source of truth for feature tier configuration
 * - Stored in Supabase feature_policies table
 * - Cached with Next.js unstable_cache until midnight
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
 * Default feature policies (used as fallback if configuration unavailable)
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
    enabled: true,
    minTier: TIERS.ANONYMOUS,
  },
  [FEATURE_KEYS.PAYMENTS]: {
    enabled: true,
    minTier: TIERS.ANONYMOUS,
  },

  // Premium features (require PREMIUM tier)
  [FEATURE_KEYS.EXCEL_EXPORT]: {
    enabled: true,
    minTier: TIERS.FREE,
  },
  [FEATURE_KEYS.EXCEL_IMPORT]: {
    enabled: true,
    minTier: TIERS.FREE,
  },
  [FEATURE_KEYS.PDF_IMPORT]: {
    enabled: true, // Disabled by default, but configured as premium feature
    minTier: TIERS.PREMIUM, // Premium tier - PDF import requires active subscription
  },
  [FEATURE_KEYS.CLIPBOARD_IMPORT]: {
    enabled: true,
    minTier: TIERS.ANONYMOUS,
  },

  // UI features (ANONYMOUS - available to all)
  [FEATURE_KEYS.RISK_CHART]: {
    enabled: true,
    minTier: TIERS.PREMIUM,
  },
};

/**
 * INTERNAL: Load all feature policies from Supabase (uncached)
 * Single source of truth for Supabase access via DB SDK
 *
 * @returns Promise<SupabasePolicies | null> All policies or null if unavailable
 */
async function loadPoliciesFromSupabaseUncached(): Promise<SupabasePolicies | null> {
  try {
    const data = await dbGetAllFeaturePolicies();

    if (!data || data.length === 0) {
      logger.warn('[Feature Policies] No feature policies found in database');
      return null;
    }

    // Convert database rows to SupabasePolicies format
    const policies: SupabasePolicies = {} as SupabasePolicies;

    for (const row of data) {
      policies[row.featureKey as FeatureFlagKey] = {
        enabled: row.enabled,
        minTier: row.minTier as TierId,
        rolloutPercentage: row.rolloutPercentage ?? undefined,
        allowlist: row.allowlist ?? undefined,
        denylist: row.denylist ?? undefined,
        betaUsers: row.betaUsers ?? undefined,
      };
    }

    return policies;
  } catch (error) {
    logger.error('[Feature Policies] Error loading from database', error);
    return null;
  }
}

/**
 * INTERNAL: Load all feature policies from Supabase with Next.js caching
 * Cached until midnight to minimize database reads
 *
 * NOTE: We use a fixed revalidation time since unstable_cache doesn't support dynamic values.
 * The cache will revalidate every 12 hours (43200 seconds), which is a reasonable compromise
 * for feature flag updates.
 *
 * @returns Promise<SupabasePolicies | null> All policies or null if unavailable
 */
const loadPoliciesFromSupabase = unstable_cache(
  loadPoliciesFromSupabaseUncached,
  ['feature-policies'],
  {
    // Revalidate every  hour
    // This ensures feature flags are refreshed daily without excessive DB reads
    revalidate: 3600, // 1 hour
    tags: ['feature-policies'],
  },
);

/**
 * SERVER-SIDE ONLY: Check if a feature is enabled via Supabase
 *
 * WARNING: This function does NOT check user tier or subscription status.
 * For access control, use checkFeatureAccess() or assertFeatureAccess() from api-guards.ts
 *
 * This function only checks:
 * 1. Global enabled flag
 * 2. Rollout percentage
 * 3. Beta user list
 *
 * @param featureKey - The feature identifier to check
 * @param userId - Optional user ID for rollout percentage and beta user checks
 * @returns Promise<boolean> indicating if the feature is enabled
 *
 * @example
 * // Server-side usage (for display purposes only, NOT for access control)
 * const isEnabled = await isFeatureEnabled('excel_export', userId);
 * if (isEnabled) {
 *   // Show UI element (but still enforce access control on API routes!)
 * }
 */
export async function isFeatureEnabled(
  featureKey: FeatureFlagKey,
  userId?: string,
): Promise<boolean> {
  try {
    const flags = await loadPoliciesFromSupabase();

    if (!flags) {
      // Supabase not configured, default to disabled for safety
      logger.warn(
        `Supabase feature policies not available, defaulting ${featureKey} to default policy`,
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
 * Check if Supabase feature policies are available and working
 *
 * @returns Promise<boolean> indicating if Supabase is accessible
 */
export async function isSupabaseFeaturePoliciesAvailable(): Promise<boolean> {
  try {
    const policies = await loadPoliciesFromSupabase();
    return policies !== null;
  } catch {
    return false;
  }
}

/**
 * Supabase schema for feature policies
 * Stored in the 'feature_policies' table in Supabase
 */
export type SupabasePolicies = Record<FeatureFlagKey, FeaturePolicy>;

/**
 * SERVER-SIDE ONLY: Get feature policy from Supabase or use default
 * This allows runtime control of feature behavior without redeployment
 *
 * WARNING: This function does NOT validate user tier or subscription.
 * For access control, use checkFeatureAccess() or assertFeatureAccess() from api-guards.ts
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
    // Fetch all policies from Supabase using centralized method
    const policies = await loadPoliciesFromSupabase();

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
 * SERVER-SIDE ONLY: Get all feature policies from Supabase
 * Useful for batch operations and caching
 *
 * WARNING: This function does NOT validate user tier or subscription.
 * For access control, use checkFeatureAccess() or assertFeatureAccess() from api-guards.ts
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
    // Fetch all policies from Supabase using centralized method
    const policies = await loadPoliciesFromSupabase();

    if (!policies) {
      return DEFAULT_FEATURE_POLICIES;
    }

    // Merge Supabase policies with defaults
    const result: Record<FeatureFlagKey, FeaturePolicy> = {
      ...DEFAULT_FEATURE_POLICIES,
    };

    for (const featureKey of Object.keys(
      DEFAULT_FEATURE_POLICIES,
    ) as FeatureFlagKey[]) {
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
