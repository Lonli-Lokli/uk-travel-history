/**
 * Server-side Access Context loader
 * Computes server-authoritative access context for hydration to client
 *
 * SECURITY: This is the single source of truth for access control.
 * - All data comes from server-side SDKs (@uth/auth-server, @uth/db)
 * - Fail-closed: if unable to load tier/role, default to least-privileged
 * - All fields are serializable for RSC → client hydration
 */

import { getCurrentUser, type AuthUser } from '@uth/auth-server';
import {
  getUserByAuthId,
  type AccessContext,
  type PricingData,
  SubscriptionTier,
  SubscriptionStatus,
  UserRole,
} from '@uth/db';
import { getPriceDetails } from '@uth/payments-server';
import { getAllFeaturePolicies, DEFAULT_FEATURE_POLICIES } from './features';
import { FEATURE_KEYS, type FeatureFlagKey } from './shapes';
import * as Sentry from '@sentry/nextjs';
import { TierId, TIERS } from '@uth/domain';

/**
 * Load server-authoritative access context from Clerk + Supabase
 *
 * This function computes the complete access context server-side, ensuring:
 * 1. User authentication status
 * 2. Subscription tier (from Supabase users table)
 * 3. User role (standard/admin)
 * 4. Feature entitlements (computed from tier + feature policies)
 *
 * @returns AccessContext - Serializable context for RSC → client hydration
 *
 * FAIL-CLOSED BEHAVIOR:
 * - If user not authenticated → ANONYMOUS tier, no entitlements
 * - If DB lookup fails → FREE tier (for authenticated users)
 * - If feature policies fail to load → no entitlements
 */
export async function loadAccessContext(): Promise<AccessContext> {
  try {
    // Step 1: Load policies and pricing in parallel (needed for all users)
    const [policies, pricing] = await Promise.all([
      loadPolicies(),
      loadPricing(),
    ]);

    // Step 2: Get current user from Clerk (via auth SDK)
    const authUser: AuthUser | null = await getCurrentUser();

    // Step 3: If not authenticated, return anonymous context with policies/pricing
    if (!authUser) {
      return createAnonymousContext(policies, pricing);
    }

    // Step 4: Load user profile from database to get tier/subscription
    let tier: SubscriptionTier = SubscriptionTier.FREE;
    let subscriptionStatus: SubscriptionStatus | null = null;
    let currentPeriodEnd: Date | null = null;
    let cancelAtPeriodEnd = false;
    let role: UserRole = UserRole.STANDARD;

    try {
      const dbUser = await getUserByAuthId(authUser.uid);

      if (dbUser) {
        tier = dbUser.subscriptionTier;
        subscriptionStatus = dbUser.subscriptionStatus;
        currentPeriodEnd = dbUser.currentPeriodEnd;
        cancelAtPeriodEnd = dbUser.cancelAtPeriodEnd;

        // TODO: Add admin role detection logic when implemented
        // Admin role detection should check:
        // 1. User's role field from DB (when column exists)
        // 2. Admin allowlist (environment variable or feature policy)
        // 3. Clerk metadata/roles (if using Clerk's RBAC features)
        // Example implementation:
        //   if (dbUser.role === 'admin') {
        //     role = UserRole.ADMIN;
        //   } else if (process.env.ADMIN_USER_IDS?.split(',').includes(authUser.uid)) {
        //     role = UserRole.ADMIN;
        //   } else {
        //     role = UserRole.STANDARD;
        //   }
        // For now, all users are STANDARD
        role = UserRole.STANDARD;
      } else {
        // User exists in Clerk but not in DB - fail-closed to FREE tier
        const message = `User ${authUser.uid} not found in database, defaulting to FREE tier`;
        console.warn(`[loadAccessContext] ${message}`);
        Sentry.captureMessage(message, {
          level: 'warning',
          tags: {
            context: 'access-context',
            userId: authUser.uid,
          },
        });
      }
    } catch (error) {
      // DB lookup failed - fail-closed to FREE tier
      console.error(
        '[loadAccessContext] Failed to load user from database:',
        error,
      );
      Sentry.captureException(error, {
        tags: {
          context: 'access-context',
          operation: 'getUserByAuthId',
          userId: authUser.uid,
        },
      });
    }

    // Step 5: Compute entitlements from loaded policies
    const tierId = mapSubscriptionTierToTierId(tier);
    const entitlements = computeEntitlementsFromPolicies(
      policies,
      tierId,
      authUser.uid,
    );

    // Step 6: Return complete access context
    return {
      user: {
        uid: authUser.uid,
        email: authUser.email,
        emailVerified: authUser.emailVerified,
      },
      tier,
      role,
      entitlements,
      policies,
      pricing,
      subscriptionStatus,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    };
  } catch (error) {
    // Critical failure - log and return anonymous context
    console.error(
      '[loadAccessContext] Critical error loading access context:',
      error,
    );
    Sentry.captureException(error, {
      tags: {
        context: 'access-context',
        operation: 'loadAccessContext',
      },
      level: 'error',
    });
    return createAnonymousContext(DEFAULT_FEATURE_POLICIES, null);
  }
}

/**
 * Load feature policies from database
 * Returns default policies on error
 */
async function loadPolicies(): Promise<
  Record<
    string,
    {
      enabled: boolean;
      minTier: TierId;
      rolloutPercentage?: number;
      allowlist?: string[];
      denylist?: string[];
      betaUsers?: string[];
    }
  >
> {
  try {
    return await getAllFeaturePolicies();
  } catch (error) {
    console.error('[loadAccessContext] Failed to load policies:', error);
    return DEFAULT_FEATURE_POLICIES;
  }
}

/**
 * Load pricing data from payments provider
 * Returns null on error (client will use fallback values)
 */
async function loadPricing(): Promise<PricingData | null> {
  try {
    const prices = await getPriceDetails();
    return {
      monthly: {
        id: prices.monthly.id,
        amount: prices.monthly.amount,
        currency: prices.monthly.currency,
      },
      annual: {
        id: prices.annual.id,
        amount: prices.annual.amount,
        currency: prices.annual.currency,
      },
      lifetime: {
        id: prices.lifetime.id,
        amount: prices.lifetime.amount,
        currency: prices.lifetime.currency,
      },
    };
  } catch (error) {
    console.error('[loadAccessContext] Failed to load pricing:', error);
    return null;
  }
}

/**
 * Create anonymous (unauthenticated) access context
 * Includes policies for UI display and entitlements for anonymous tier
 */
function createAnonymousContext(
  policies: Record<
    string,
    {
      enabled: boolean;
      minTier: TierId;
      rolloutPercentage?: number;
      allowlist?: string[];
      denylist?: string[];
      betaUsers?: string[];
    }
  >,
  pricing: PricingData | null,
): AccessContext {
  // Compute entitlements for anonymous tier
  const entitlements = computeEntitlementsFromPolicies(
    policies,
    TIERS.ANONYMOUS,
    null,
  );

  return {
    user: null,
    tier: SubscriptionTier.ANONYMOUS,
    role: UserRole.STANDARD,
    entitlements,
    policies,
    pricing,
    subscriptionStatus: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
}

/**
 * Compute feature entitlements from pre-loaded policies
 * Synchronous function - policies are already loaded
 *
 * @param policies - Pre-loaded feature policies
 * @param tierId - User's tier ID
 * @param userId - User ID (null for anonymous users)
 * @returns Record of feature keys to boolean access flags
 */
function computeEntitlementsFromPolicies(
  policies: Record<
    string,
    {
      enabled: boolean;
      minTier: TierId;
      rolloutPercentage?: number;
      allowlist?: string[];
      denylist?: string[];
      betaUsers?: string[];
    }
  >,
  tierId: TierId,
  userId: string | null,
): Record<string, boolean> {
  const entitlements: Record<string, boolean> = {};

  for (const featureKey of Object.values(FEATURE_KEYS)) {
    const policy =
      policies[featureKey as FeatureFlagKey] ??
      DEFAULT_FEATURE_POLICIES[featureKey as FeatureFlagKey];

    if (!policy) {
      // No policy defined - deny access
      entitlements[featureKey] = false;
      continue;
    }

    // Check if user has access based on policy
    entitlements[featureKey] = checkFeatureAccess(policy, tierId, userId);
  }

  return entitlements;
}

/**
 * Hash user ID using djb2 algorithm
 * Provides better distribution than simple char code sum
 *
 * @param userId - User ID to hash
 * @returns Positive integer hash value
 */
function hashUserId(userId: string): number {
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) + hash + userId.charCodeAt(i); // hash * 33 + c
  }
  return Math.abs(hash);
}

/**
 * Check if user has access to a feature based on policy
 * Implements tier checking, allowlist/denylist, and rollout percentage
 *
 * @param policy - Feature policy from database
 * @param userTier - User's subscription tier
 * @param userId - User ID for allowlist/denylist checks (null for anonymous)
 * @returns true if user has access, false otherwise
 */
function checkFeatureAccess(
  policy: {
    enabled: boolean;
    minTier: TierId;
    allowlist?: string[] | null;
    denylist?: string[] | null;
    betaUsers?: string[] | null;
    rolloutPercentage?: number | null;
  },
  userTier: TierId,
  userId: string | null,
): boolean {
  // 1. Check if feature is enabled globally
  if (!policy.enabled) {
    return false;
  }

  // User-specific checks only apply to authenticated users
  if (userId) {
    // 2. Check denylist (explicit denial overrides everything)
    if (policy.denylist?.includes(userId)) {
      return false;
    }

    // 3. Check allowlist (explicit allow bypasses tier check)
    if (policy.allowlist?.includes(userId)) {
      return true;
    }

    // 4. Check beta users (beta access bypasses tier check)
    if (policy.betaUsers?.includes(userId)) {
      return true;
    }
  }

  // 5. Check tier level
  const tierLevels: Record<TierId, number> = {
    [TIERS.ANONYMOUS]: 0,
    [TIERS.FREE]: 1,
    [TIERS.PREMIUM]: 2,
  };

  const userLevel = tierLevels[userTier];
  const requiredLevel = tierLevels[policy.minTier];

  if (userLevel < requiredLevel) {
    return false;
  }

  // 6. Check rollout percentage (if specified and user is authenticated)
  if (
    userId &&
    policy.rolloutPercentage !== undefined &&
    policy.rolloutPercentage !== null
  ) {
    // Hash-based rollout using djb2 algorithm for better distribution
    // This is a non-cryptographic hash that provides good distribution across user IDs
    const hash = hashUserId(userId);
    const userPercentile = hash % 100;
    if (userPercentile >= policy.rolloutPercentage) {
      return false;
    }
  }

  // All checks passed
  return true;
}

/**
 * Map SubscriptionTier (from DB) to TierId (used by feature system)
 * This bridge ensures compatibility between DB schema and feature flags
 */
function mapSubscriptionTierToTierId(tier: SubscriptionTier): TierId {
  switch (tier) {
    case SubscriptionTier.FREE:
      return TIERS.FREE;
    case SubscriptionTier.MONTHLY:
    case SubscriptionTier.YEARLY:
    case SubscriptionTier.LIFETIME:
      return TIERS.PREMIUM;
    default:
      // Unknown tier - fail-closed to FREE
      console.warn(
        `[mapSubscriptionTierToTierId] Unknown tier: ${tier}, defaulting to FREE`,
      );
      return TIERS.FREE;
  }
}
