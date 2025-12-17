// Server-Side Feature Validation
// CRITICAL: Always validate premium features on the server to prevent client-side bypass
// Client-side checks are for UX only - server must be the source of truth

import { isFeatureEnabled as isFeatureEnabledEdgeConfig } from './edgeConfigFlags';
import { TIER_CONFIG, TIERS, type FeatureId } from './features';

/**
 * User tier information
 */
export interface UserTier {
  userId: string;
  tier: 'free' | 'premium';
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
 * SERVER-SIDE ONLY: Validate if a user can access a premium feature
 *
 * This function should be called on ALL API routes that provide premium functionality.
 * Client-side checks can be bypassed - NEVER trust client-side feature flags for access control.
 *
 * @param featureId - The feature to check
 * @param userTier - The user's tier information (from your auth/database)
 * @returns Promise<FeatureAccessResult> indicating if access is allowed
 *
 * @example
 * // In Next.js API route
 * export async function POST(request: Request) {
 *   const { userId } = await getAuthUser(request);
 *   const userTier = await getUserTier(userId);
 *
 *   const access = await validateFeatureAccess(FEATURES.EXCEL_EXPORT, userTier);
 *   if (!access.allowed) {
 *     return new Response('Unauthorized', { status: 403 });
 *   }
 *
 *   // Proceed with premium feature
 * }
 */
export async function validateFeatureAccess(
  featureId: FeatureId,
  userTier: UserTier
): Promise<FeatureAccessResult> {
  // 1. Check if feature is enabled via feature flags
  // Note: featureId from FEATURES uses snake_case which matches FEATURE_KEYS
  const isEnabled = await isFeatureEnabledEdgeConfig(
    featureId as any,
    userTier.userId
  );
  if (!isEnabled) {
    return {
      allowed: false,
      reason: 'feature_disabled',
    };
  }

  // 2. Check if user's tier includes this feature
  const requiredFeatures = TIER_CONFIG[userTier.tier];
  if (!requiredFeatures.includes(featureId)) {
    return {
      allowed: false,
      reason: 'tier_restriction',
    };
  }

  // 3. For premium-only features, verify subscription is active
  const freeFeatures = TIER_CONFIG[TIERS.FREE];
  const isPremiumOnlyFeature = !freeFeatures.includes(featureId);

  if (
    isPremiumOnlyFeature &&
    userTier.tier === TIERS.PREMIUM &&
    !userTier.subscriptionActive
  ) {
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
 * @param featureId - The feature to check
 * @returns boolean indicating if the feature requires premium tier
 */
export function isPremiumFeature(featureId: FeatureId): boolean {
  const freeFeatures = TIER_CONFIG[TIERS.FREE];
  return !freeFeatures.includes(featureId);
}

/**
 * SERVER-SIDE ONLY: Get list of features accessible to a user
 *
 * @param userTier - The user's tier information
 * @returns Promise<FeatureId[]> list of accessible features
 *
 * @example
 * const features = await getAccessibleFeatures(userTier);
 * return { features };
 */
export async function getAccessibleFeatures(
  userTier: UserTier
): Promise<FeatureId[]> {
  const tierFeatures = TIER_CONFIG[userTier.tier];

  // Filter by enabled feature flags
  const accessibleFeatures: FeatureId[] = [];
  for (const feature of tierFeatures) {
    const isEnabled = await isFeatureEnabledEdgeConfig(
      feature as any,
      userTier.userId
    );
    if (isEnabled) {
      accessibleFeatures.push(feature);
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
  _featureId: FeatureId,
  _handler: (request: Request) => Promise<Response>
) {
  return async (_request: Request): Promise<Response> => {
    // This is a placeholder - you'll need to implement your auth logic
    // For now, we'll throw an error to remind developers to implement this
    throw new Error(
      'withFeatureAccess requires authentication implementation. ' +
      'Please implement getUserTier() in your app and update this middleware.'
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
