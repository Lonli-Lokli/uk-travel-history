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
  getUserGoals,
  getGoalTemplates,
  getTrips,
  type PricingData,
  type TrackingGoalData,
  type GoalCalculationData,
  type GoalTemplateWithAccess,
  type TripData,
  SubscriptionTier,
  SubscriptionStatus,
  UserRole,
  type IdentityContext,
  type DataContext,
} from '@uth/db';
import { get } from '@uth/cache';
import { getSessionIdFromHeaders } from '@uth/trip-store';
import { FEATURE_KEYS, type FeatureFlagKey } from './shapes';
import { TierId, TIERS } from '@uth/domain';
import { getFeatureLogger } from './feature-logger';
import { ruleEngineRegistry } from '@uth/rules';
import { getCachedPolicies, getCachedPriceDetails } from './cached-data';
import { DEFAULT_FEATURE_POLICIES } from './defaults';

/**
 * Cache key for anonymous user goals
 */
function getGoalsCacheKey(sessionId: string): string {
  return `goals:session:${sessionId}`;
}

/**
 * Cache key for anonymous user trips
 */
function getTripsCacheKey(sessionId: string): string {
  return `trips:session:${sessionId}`;
}

/**
 * Get goals from cache for anonymous users
 */
async function getCachedGoals(sessionId: string): Promise<TrackingGoalData[]> {
  const key = getGoalsCacheKey(sessionId);
  const goals = await get<TrackingGoalData[]>(key);
  return goals || [];
}

/**
 * Get trips from cache for anonymous users
 */
async function getCachedTrips(sessionId: string): Promise<TripData[]> {
  const key = getTripsCacheKey(sessionId);
  const trips = await get<TripData[]>(key);
  return trips || [];
}

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
export async function loadDataContext(): Promise<DataContext> {
  try {
    // Step 2: Get current user from Clerk (via auth SDK)
    const authUser: AuthUser | null = await getCurrentUser();

    // Step 3: If not authenticated, return anonymous context with policies/pricing
    if (!authUser) {
      return await createAnonymousDataContext();
    }

    // Step 1: Load policies and pricing in parallel (needed for all users)
    const policies = await getCachedPolicies();

    // Step 4: Load user profile from database to get tier/subscription
    let tier: SubscriptionTier = SubscriptionTier.FREE;

    try {
      const dbUser = await getUserByAuthId(authUser.uid);

      if (dbUser) {
        tier = dbUser.subscriptionTier;
      } else {
        // User exists in Clerk but not in DB - fail-closed to FREE tier
        getFeatureLogger().warn(
          `User ${authUser.uid} not found in database, defaulting to FREE tier`,
          {
            level: 'warning',
            tags: {
              context: 'access-context',
              userId: authUser.uid,
            },
          },
        );
      }
    } catch (error) {
      // DB lookup failed - fail-closed to FREE tier
      getFeatureLogger().error(
        '[loadDataAccessContext] Failed to load user from database:',
        error,
        {
          tags: {
            context: 'access-context',
            operation: 'getUserByAuthId',
            userId: authUser.uid,
          },
        },
      );
    }

    // Step 5: Compute entitlements from loaded policies
    const tierId = mapSubscriptionTierToTierId(tier);
    const entitlements = computeEntitlementsFromPolicies(
      policies,
      tierId,
      authUser.uid,
    );

    // Step 6: Load goals, templates, and trips if multi_goal_tracking feature is enabled
    let goals: TrackingGoalData[] | null = null;
    let goalCalculations: Record<string, GoalCalculationData> | null = null;
    let goalTemplates: GoalTemplateWithAccess[] | null = null;
    let trips: TripData[] | null = null;

    if (entitlements[FEATURE_KEYS.MULTI_GOAL_TRACKING]) {
      try {
        // Load goals, templates, and trips in parallel
        const [userGoals, allTemplates, userTrips] = await Promise.all([
          getUserGoals(authUser.uid, false), // exclude archived
          getGoalTemplates(),
          getTrips(authUser.uid),
        ]);

        goals = userGoals;
        trips = userTrips;

        // Server-side calculation of goal metrics
        // This ensures calculations happen on the server and are hydrated to client
        goalCalculations = await calculateGoalMetrics(userGoals, userTrips);

        // Compute template access based on user's tier
        const tierHierarchy: Record<string, number> = {
          [TIERS.ANONYMOUS]: 0,
          [TIERS.FREE]: 1,
          [TIERS.PREMIUM]: 2,
        };
        const userTierLevel = tierHierarchy[tierId] ?? 0;

        goalTemplates = allTemplates.map((template) => {
          const templateTierLevel = tierHierarchy[template.minTier] ?? 0;
          const isAvailableForTier = userTierLevel >= templateTierLevel;
          return {
            ...template,
            isAvailableForTier,
            requiresUpgrade: !isAvailableForTier,
          };
        });
      } catch (error) {
        getFeatureLogger().warn(
          `Failed to load goals/templates for user ${authUser.uid}`,
          {
            level: 'warning',
            tags: {
              context: 'access-context',
              operation: 'getUserGoals/getGoalTemplates',
              userId: authUser.uid,
            },
          },
        );
        // Fail gracefully - user just won't see their goals/trips initially
        goals = null;
        goalCalculations = null;
        goalTemplates = null;
        trips = null;
      }
    }

    // Step 7: Return complete access context
    return {
      goals,
      goalCalculations,
      goalTemplates,
      trips,
    };
  } catch (error) {
    // Critical failure - log and return anonymous context
    getFeatureLogger().error(
      '[loadDataAccessContext] Critical error loading access context:',
      error,
      {
        tags: {
          context: 'access-context',
          operation: 'loadAccessContext',
        },
        level: 'error',
      },
    );
    return await createAnonymousDataContext();
  }
}

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
export async function loadIdentityContext(): Promise<IdentityContext> {
  try {
    // Step 1: Load policies and pricing in parallel (needed for all users)
    const [policies, pricing] = await Promise.all([
      getCachedPolicies(),
      getCachedPriceDetails(),
    ]);

    // Step 2: Get current user from Clerk (via auth SDK)
    const authUser: AuthUser | null = await getCurrentUser();

    // Step 3: If not authenticated, return anonymous context with policies/pricing
    if (!authUser) {
      return await createAnonymousIdentityContext(policies, pricing);
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
        role = dbUser.role;
      } else {
        // User exists in Clerk but not in DB - fail-closed to FREE tier
        getFeatureLogger().warn(
          `User ${authUser.uid} not found in database, defaulting to FREE tier`,
          {
            level: 'warning',
            tags: {
              context: 'access-context',
              userId: authUser.uid,
            },
          },
        );
      }
    } catch (error) {
      // DB lookup failed - fail-closed to FREE tier
      getFeatureLogger().error(
        '[loadDataAccessContext] Failed to load user from database:',
        error,
        {
          tags: {
            context: 'access-context',
            operation: 'getUserByAuthId',
            userId: authUser.uid,
          },
        },
      );
    }

    // Step 5: Compute entitlements from loaded policies
    const tierId = mapSubscriptionTierToTierId(tier);
    const entitlements = computeEntitlementsFromPolicies(
      policies,
      tierId,
      authUser.uid,
    );

    // Step 7: Return complete identity context
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
    getFeatureLogger().error(
      '[loadDataAccessContext] Critical error loading access context:',
      error,
      {
        tags: {
          context: 'access-context',
          operation: 'loadAccessContext',
        },
        level: 'error',
      },
    );
    return await createAnonymousIdentityContext(DEFAULT_FEATURE_POLICIES, null);
  }
}

/**
 * Create anonymous (unauthenticated) access context
 * Includes policies for UI display and entitlements for anonymous tier
 */
async function createAnonymousIdentityContext(
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
): Promise<IdentityContext> {
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
 * Create anonymous (unauthenticated) access context
 * Includes policies for UI display and entitlements for anonymous tier
 *
 * For anonymous users with a session cookie, we also load their cached data
 * from the ephemeral storage (Redis cache with TTL).
 */
async function createAnonymousDataContext(): Promise<DataContext> {
  // Load goal templates for anonymous users
  // This allows anonymous users to see available goal options in the UI
  let goalTemplates: GoalTemplateWithAccess[] | null = null;
  let goals: TrackingGoalData[] | null = null;
  let goalCalculations: Record<string, GoalCalculationData> | null = null;
  let trips: TripData[] | null = null;
  let ephemeralDataExpired = false;
  let isEphemeral = false;

  // Check for session cookie - if present, load cached data
  const sessionId = await getSessionIdFromHeaders();

  try {
    const allTemplates = await getGoalTemplates();

    // Filter templates available to anonymous tier
    const tierHierarchy: Record<string, number> = {
      [TIERS.ANONYMOUS]: 0,
      [TIERS.FREE]: 1,
      [TIERS.PREMIUM]: 2,
    };
    const anonymousTierLevel = tierHierarchy[TIERS.ANONYMOUS];

    goalTemplates = allTemplates.map((template) => {
      const templateTierLevel = tierHierarchy[template.minTier] ?? 0;
      const isAvailableForTier = anonymousTierLevel >= templateTierLevel;
      return {
        ...template,
        isAvailableForTier,
        requiresUpgrade: !isAvailableForTier,
      };
    });
  } catch (error) {
    getFeatureLogger().warn(
      'Failed to load goal templates for anonymous user',
      {
        level: 'warning',
        tags: {
          context: 'access-context',
          operation: 'getGoalTemplates',
        },
      },
    );
    // Fail gracefully - anonymous users just won't see templates
    goalTemplates = null;
  }

  // If session exists, attempt to load cached goals and trips
  if (sessionId) {
    try {
      const [cachedGoals, cachedTrips] = await Promise.all([
        getCachedGoals(sessionId),
        getCachedTrips(sessionId),
      ]);

      // Check if we have any cached data
      const hasCachedData = cachedGoals.length > 0 || cachedTrips.length > 0;

      if (hasCachedData) {
        goals = cachedGoals.length > 0 ? cachedGoals : null;
        trips = cachedTrips.length > 0 ? cachedTrips : null;
        isEphemeral = true;

        // Calculate metrics for cached goals if we have both goals and trips
        if (goals && goals.length > 0) {
          goalCalculations = await calculateGoalMetrics(goals, cachedTrips);
        }
      } else {
        // Session exists but cache is empty - data may have expired
        // This happens when:
        // 1. User created data previously (got session cookie)
        // 2. Cache TTL expired (midnight UTC)
        // 3. User returns - session cookie exists but cache is empty
        ephemeralDataExpired = true;
      }
    } catch (error) {
      getFeatureLogger().warn(
        'Failed to load cached data for anonymous user',
        {
          level: 'warning',
          tags: {
            context: 'access-context',
            operation: 'getCachedData',
            sessionId,
          },
        },
      );
      // Fail gracefully - return empty data
    }
  }

  return {
    goals,
    goalCalculations,
    goalTemplates,
    trips,
    ephemeralDataExpired,
    isEphemeral,
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

/**
 * Calculate goal metrics server-side using rule engines
 *
 * @param goals - User's tracking goals
 * @param trips - User's trip data
 * @returns Record of goal IDs to calculation results
 */
async function calculateGoalMetrics(
  goals: TrackingGoalData[],
  trips: TripData[],
): Promise<Record<string, GoalCalculationData>> {
  const calculations: Record<string, GoalCalculationData> = {};

  // Convert TripData to TripRecord format (required by rule engines)
  const tripRecords = trips.map((trip) => ({
    id: trip.id,
    outDate: trip.outDate,
    inDate: trip.inDate,
    outRoute: trip.outRoute || '',
    inRoute: trip.inRoute || '',
  }));

  // Calculate metrics for each active goal
  for (const goal of goals) {
    if (!goal.isActive || goal.isArchived) {
      continue;
    }

    try {
      const engine = ruleEngineRegistry.get(goal.type);

      if (!engine) {
        getFeatureLogger().warn(
          `No rule engine found for goal type: ${goal.type}`,
          {
            level: 'warning',
            tags: {
              context: 'access-context',
              operation: 'calculateGoalMetrics',
              goalId: goal.id,
              goalType: goal.type,
            },
          },
        );
        continue;
      }

      const calculation = engine.calculate(
        tripRecords,
        goal.config as any,
        new Date(goal.startDate),
      );

      // Set the goal ID on the calculation
      calculation.goalId = goal.id;

      calculations[goal.id] = calculation as GoalCalculationData;
    } catch (error) {
      getFeatureLogger().error(`Failed to calculate goal ${goal.id}:`, error, {
        tags: {
          context: 'access-context',
          operation: 'calculateGoalMetrics',
          goalId: goal.id,
          goalType: goal.type,
        },
      });
    }
  }

  return calculations;
}
