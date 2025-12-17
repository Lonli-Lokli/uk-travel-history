// Feature Flag Runtime Library with Vercel Edge Config Integration
// Provides dynamic feature flag checking with fallback to environment variables
// See RFC-007 for detailed documentation

import { get } from '@vercel/edge-config';

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
 * Check if a feature is enabled via Vercel Edge Config or environment variables
 *
 * This function implements a two-layer checking system:
 * 1. First checks environment variables (compile-time override)
 * 2. Then checks Vercel Edge Config (runtime control)
 * 3. Applies rollout percentage and beta user logic
 *
 * @param featureId - The feature identifier to check
 * @param userId - Optional user ID for rollout percentage and beta user checks
 * @returns Promise<boolean> indicating if the feature is enabled
 *
 * @example
 * // Server-side usage
 * const isEnabled = await isFeatureEnabled('excel_export', userId);
 * if (isEnabled) {
 *   // Proceed with feature
 * }
 *
 * @example
 * // Check without user context
 * const isEnabled = await isFeatureEnabled('monetization');
 */
export async function isFeatureEnabledOnVercel(
  featureId: string,
  userId?: string
): Promise<boolean> {
  // 1. Check environment variable first (compile-time override)
  const envVar = `FEATURE_${featureId.toUpperCase()}`;
  if (process.env[envVar] === 'false') {
    return false; // Hard disable via env var
  }

  // 2. Check Vercel Edge Config (runtime control)
  try {
    const flags = await get<EdgeConfigFlags>('features');

    if (!flags) {
      // Edge Config not configured, fall back to env var default
      return process.env[envVar] === 'true';
    }

    const flag = flags[featureId];

    if (!flag || !flag.enabled) {
      return false;
    }

    // 3. Check beta user list
    if (userId && flag.betaUsers?.includes(userId)) {
      return true;
    }

    // 4. Check rollout percentage
    if (flag.rolloutPercentage !== undefined && userId) {
      const userHash = hashUserId(userId, featureId);
      return userHash % 100 < flag.rolloutPercentage;
    }

    // Feature is enabled without restrictions
    return flag.enabled;
  } catch (error) {
    // Fail open: if Edge Config is down, use default behavior
    console.error('Feature flag check failed:', error);
    return process.env[envVar] === 'true';
  }
}

/**
 * Hash a user ID for consistent rollout percentage assignment
 * Includes feature-specific salt to enable independent rollouts per feature
 *
 * @param userId - The user ID to hash
 * @param featureId - The feature ID for feature-specific hashing
 * @returns A number between 0-99 for percentage-based rollout
 */
function hashUserId(userId: string, featureId: string): number {
  // Combine userId and featureId for feature-specific hashing
  const input = `${userId}:${featureId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Check if a feature is enabled for a specific percentage of users
 *
 * @param featureId - The feature identifier
 * @param userId - The user ID to check
 * @param percentage - Target percentage (0-100)
 * @returns Promise<boolean> indicating if the feature is enabled for this user
 *
 * @example
 * // Enable feature for 10% of users
 * const isEnabled = await isEnabledForUser('new_feature', userId, 10);
 */
export async function isEnabledForUser(
  featureId: string,
  userId: string,
  percentage: number
): Promise<boolean> {
  const isEnabled = await isFeatureEnabledOnVercel(featureId);
  if (!isEnabled) return false;

  const hash = hashUserId(userId, featureId);
  return hash % 100 < percentage;
}

/**
 * Get all feature flags from Edge Config
 *
 * @returns Promise<EdgeConfigFlags | null> All feature flags or null if not configured
 *
 * @example
 * const flags = await getAllFeatureFlags();
 * console.log('Enabled features:', Object.keys(flags).filter(k => flags[k].enabled));
 */
export async function getAllFeatureFlags(): Promise<EdgeConfigFlags | null> {
  try {
    const flags = await get<EdgeConfigFlags>('features');
    return flags ?? null;
  } catch (error) {
    console.error('Failed to fetch feature flags:', error);
    return null;
  }
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
