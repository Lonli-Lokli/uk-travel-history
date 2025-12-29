// Server-Side Feature Validation
// CRITICAL: Always validate premium features on the server to prevent client-side bypass
// Client-side checks are for UX only - server must be the source of truth
//
// DEPRECATED: This module is deprecated in favor of api-guards.ts
// Use assertFeatureAccess() or withFeatureAccess() from api-guards.ts instead

import { getFeaturePolicy } from './features';
import { TIERS, type TierId, type FeatureFlagKey } from './shapes';

/**
 * User tier information
 * @deprecated Use UserContext from api-guards.ts instead
 */
export interface UserTier {
  userId: string;
  tier: TierId; // Changed from 'free' | 'premium' to support ANONYMOUS
  subscriptionActive?: boolean;
}

/**
 * Result of a feature access check
 */
export interface FeatureAccessResult {
  allowed: boolean;
  reason?: 'tier_restriction' | 'feature_disabled' | 'no_subscription';
}

/**
 * Get numeric tier level for comparison
 * Higher number = higher tier
 */
function getTierLevel(tier: TierId): number {
  switch (tier) {
    case TIERS.ANONYMOUS:
      return 0;
    case TIERS.FREE:
      return 1;
    case TIERS.PREMIUM:
      return 2;
    default:
      return 0; // Fail closed
  }
}

/**
 * SERVER-SIDE ONLY: Validate if a user can access a premium feature
 *
 * @deprecated Use assertFeatureAccess() or checkFeatureAccess() from api-guards.ts instead
 *
 * This function should be called on ALL API routes that provide premium functionality.
 * Client-side checks can be bypassed - NEVER trust client-side feature flags for access control.
 *
 * @param featureKey - The feature to check
 * @param userTier - The user's tier information (from your auth/database)
 * @returns Promise<FeatureAccessResult> indicating if access is allowed
 *
 * @example
 * // In Next.js API route
 * export async function POST(request: Request) {
 *   const { userId } = await getAuthUser(request);
 *   const userTier = await getUserTier(userId);
 *
 *   const access = await validateFeatureAccess(FEATURE_KEYS.EXCEL_EXPORT, userTier);
 *   if (!access.allowed) {
 *     return new Response('Unauthorized', { status: 403 });
 *   }
 *
 *   // Proceed with premium feature
 * }
 */
export async function validateFeatureAccess(
  featureKey: FeatureFlagKey,
  userTier: UserTier,
): Promise<FeatureAccessResult> {
  // Get feature policy from Edge Config
  const policy = await getFeaturePolicy(featureKey);

  // 1. Check if feature is enabled via feature flags
  if (!policy.enabled) {
    return {
      allowed: false,
      reason: 'feature_disabled',
    };
  }

  // 2. Check tier level
  const userTierLevel = getTierLevel(userTier.tier);
  const requiredTierLevel = getTierLevel(policy.minTier);

  if (userTierLevel < requiredTierLevel) {
    return {
      allowed: false,
      reason: 'tier_restriction',
    };
  }

  // 3. For premium features, verify subscription is active
  if (policy.minTier === TIERS.PREMIUM && !userTier.subscriptionActive) {
    return {
      allowed: false,
      reason: 'no_subscription',
    };
  }

  return { allowed: true };
}

/**
 * SERVER-SIDE ONLY: Check if a feature is premium-only
 *
 * @deprecated Use getFeaturePolicy() from edgeConfigFlags.ts and check policy.minTier instead
 *
 * @param featureKey - The feature to check
 * @returns Promise<boolean> indicating if the feature requires premium tier
 */
export async function isPremiumFeature(featureKey: FeatureFlagKey): Promise<boolean> {
  const policy = await getFeaturePolicy(featureKey);
  return policy.minTier === TIERS.PREMIUM;
}

/**
 * SERVER-SIDE ONLY: Get list of features accessible to a user
 *
 * @deprecated Use getAllFeaturePolicies() from edgeConfigFlags.ts and filter based on tier
 *
 * @param userTier - The user's tier information
 * @returns Promise<FeatureFlagKey[]> list of accessible features
 *
 * @example
 * const features = await getAccessibleFeatures(userTier);
 * return { features };
 */
export async function getAccessibleFeatures(
  userTier: UserTier,
): Promise<FeatureFlagKey[]> {
  const { FEATURE_KEYS } = await import('./shapes');
  const accessibleFeatures: FeatureFlagKey[] = [];

  // Check each feature using the new policy-based system
  for (const featureKey of Object.values(FEATURE_KEYS)) {
    const result = await validateFeatureAccess(featureKey, userTier);
    if (result.allowed) {
      accessibleFeatures.push(featureKey);
    }
  }

  return accessibleFeatures;
}

/**
 * Middleware helper for Next.js API routes
 *
 * @param featureId - The feature to protect
 * @returns Middleware function that checks feature access
 *
 * @example
 * // In Next.js API route
 * export const POST = withFeatureAccess(FEATURES.EXCEL_EXPORT, async (request) => {
 *   // This code only runs if user has access
 *   return generateExcel();
 * });
 */
export function withFeatureAccess(
  _featureId: FeatureFlagKey,
  _handler: (request: Request) => Promise<Response>,
) {
  return async (_request: Request): Promise<Response> => {
    // This is a placeholder - you'll need to implement your auth logic
    // For now, we'll throw an error to remind developers to implement this
    throw new Error(
      'withFeatureAccess requires authentication implementation. ' +
        'Please implement getUserTier() in your app and update this middleware.',
    );

    // Example implementation (uncomment and adapt to your auth system):
    /*
    const { userId } = await getAuthUser(request);
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userTier = await getUserTier(userId);
    const access = await validateFeatureAccess(featureId, userTier);

    if (!access.allowed) {
      return new Response(
        JSON.stringify({ error: 'Feature not available', reason: access.reason }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return handler(request);
    */
  };
}
