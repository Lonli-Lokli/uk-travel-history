/**
 * API Feature Guards - Server-Side Enforcement
 *
 * CRITICAL: This module provides server-side feature access control.
 * Client-side checks are for UX only - the server MUST be the source of truth.
 *
 * Security principles:
 * 1. Defense in depth - multiple layers of validation
 * 2. Fail closed - deny access by default if config unavailable
 * 3. Centralized logic - DRY principle, single source of truth
 * 4. Comprehensive logging - audit trail for security analysis
 * 5. Type safety - TypeScript ensures correctness at compile time
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@uth/utils';
import type { LogOptions } from '@uth/utils';
import { getUserByAuthId } from '@uth/db';
import { getFeaturePolicy as getFeaturePolicyFromEdgeConfig } from './features';
import type { FeatureFlagKey, FeaturePolicy } from './shapes';
import { auth } from '@clerk/nextjs/server';
import { getSessionFromRequest, getSubscription } from '@uth/auth-server';
import { TierId, TIERS } from '@uth/domain';

/**
 * Logger interface for dependency injection
 * Allows tests to provide custom logger implementations
 */
export interface Logger {
  error: (message: string, error?: unknown, options?: LogOptions) => void;
  warn: (message: string, options?: LogOptions) => void;
  info: (message: string, options?: LogOptions) => void;
  debug: (message: string, options?: LogOptions) => void;
}

/**
 * Configuration options for the API guards
 * Allows injection of dependencies for better testability
 */
export interface ApiGuardsConfig {
  /**
   * Logger implementation (defaults to @uth/utils logger)
   */
  logger?: Logger;
}

/**
 * Global configuration for the API guards
 * Can be set via configureApiGuards() for testing or customization
 */
let apiGuardsConfig: ApiGuardsConfig = {};

/**
 * Configure the API guards with custom dependencies
 * Useful for testing or customizing behavior
 *
 * @example
 * // In tests
 * configureApiGuards({
 *   logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
 * });
 *
 * @example
 * // Reset to defaults
 * configureApiGuards({});
 */
export function configureApiGuards(config: ApiGuardsConfig): void {
  apiGuardsConfig = config;
}

/**
 * Get the configured logger or fall back to default
 */
function getLogger(): Logger {
  return apiGuardsConfig.logger || logger;
}

// SubscriptionStatus enum values for checking subscription state
const SubscriptionStatus = {
  ACTIVE: 'active' as const,
  TRIALING: 'trialing' as const,
  PAST_DUE: 'past_due' as const,
  CANCELED: 'canceled' as const,
  INCOMPLETE: 'incomplete' as const,
  INCOMPLETE_EXPIRED: 'incomplete_expired' as const,
  UNPAID: 'unpaid' as const,
};

/**
 * User context for feature access checks
 * Contains all information needed to determine feature eligibility
 */
export interface UserContext {
  /** User ID from authentication provider (e.g., Clerk user ID) - null for anonymous */
  userId: string | null;
  /** User's email (optional, for logging) */
  email?: string;
  /** User's subscription tier (ANONYMOUS if not authenticated) */
  tier: TierId;
  /** Whether user has an active subscription (for premium tier) */
  hasActiveSubscription: boolean;
}

/**
 * Result of a feature access check
 */
export interface FeatureAccessResult {
  /** Whether access is allowed */
  allowed: boolean;
  /** Reason code if access denied */
  reason?:
    | 'feature_disabled'
    | 'tier_restriction'
    | 'no_active_subscription'
    | 'rollout_not_eligible'
    | 'denylisted'
    | 'unauthenticated';
  /** HTTP status code to return (401/403/404) */
  statusCode?: number;
  /** Human-readable error message */
  message?: string;
}

/**
 * Extract user context from request
 * This is the integration point with the authentication system
 *
 * @param request - Next.js request object (unused in Clerk mode, but kept for API compatibility)
 * @returns User context (never null - returns ANONYMOUS tier if not authenticated)
 */
export async function getUserContext(
  _request: NextRequest,
): Promise<UserContext> {
  try {
    // Determine auth provider from environment
    const authProvider = process.env.UTH_AUTH_PROVIDER || 'clerk';

    let userId: string | null = null;

    if (authProvider === 'clerk') {
      // Use Clerk's auth() helper to get current user
      const authResult = await auth();
      userId = authResult.userId;
    } else {
      // For Firebase mode, extract from Authorization header
      try {
        const session = await getSessionFromRequest(_request.headers);
        userId = session.user.uid;
      } catch {
        userId = null;
      }
    }

    if (!userId) {
      // Not authenticated - return anonymous tier
      return {
        userId: null,
        tier: TIERS.ANONYMOUS,
        hasActiveSubscription: false,
      };
    }

    // Get user from database to check tier
    const dbUser = await getUserByAuthId(userId);

    if (!dbUser) {
      // User authenticated but not in database yet
      // Default to free tier
      return {
        userId,
        tier: TIERS.FREE,
        hasActiveSubscription: false,
      };
    }

    // Check subscription status
    const subscription = await getSubscription(userId);

    // User has active subscription if:
    // 1. Status is 'active' or 'trialing'
    // 2. OR subscription is cancelled but still in grace period (cancelAtPeriodEnd = true, currentPeriodEnd > now)
    const now = new Date();
    const hasActiveSubscription =
      subscription?.status === SubscriptionStatus.ACTIVE ||
      subscription?.status === SubscriptionStatus.TRIALING ||
      (subscription?.cancelAtPeriodEnd === true &&
        subscription?.currentPeriodEnd &&
        subscription.currentPeriodEnd > now);

    const tier: TierId = hasActiveSubscription ? TIERS.PREMIUM : TIERS.FREE;

    return {
      userId,
      email: dbUser.email,
      tier,
      hasActiveSubscription,
    };
  } catch (error) {
    getLogger().error('[Feature Guards] Error extracting user context', error);
    // Fail closed - return anonymous tier on error
    return {
      userId: null,
      tier: TIERS.ANONYMOUS,
      hasActiveSubscription: false,
    };
  }
}

/**
 * Get feature policy from Edge Config or use default
 * This allows runtime control of feature behavior without redeployment
 *
 * @param featureKey - The feature to check
 * @returns Feature policy
 */
async function getFeaturePolicy(
  featureKey: FeatureFlagKey,
): Promise<FeaturePolicy> {
  // Delegate to edgeConfigFlags.ts which now handles full policy fetching
  return getFeaturePolicyFromEdgeConfig(featureKey);
}

/**
 * Get numeric tier level for comparison
 * Higher number = higher tier
 *
 * @param tier - The tier to convert
 * @returns Numeric tier level
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
 * Hash user ID for consistent rollout percentage assignment
 *
 * @param userId - The user ID to hash
 * @param featureId - Feature ID for feature-specific hashing
 * @returns Number between 0-99
 */
function hashUserIdForRollout(userId: string, featureId: string): number {
  const input = `${userId}:${featureId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100;
}

/**
 * Check if a user has access to a feature
 * This is the core authorization logic
 *
 * @param featureKey - The feature to check
 * @param userContext - User context (includes tier, never null)
 * @returns Access result with decision and reason
 */
export async function checkFeatureAccess(
  featureKey: FeatureFlagKey,
  userContext: UserContext,
): Promise<FeatureAccessResult> {
  // Get feature policy from Edge Config
  const policy = await getFeaturePolicy(featureKey);

  // 1. Check global kill switch
  if (!policy.enabled) {
    return {
      allowed: false,
      reason: 'feature_disabled',
      statusCode: 404, // Hide disabled features
      message: 'Feature not available',
    };
  }

  // 2. Check denylist (takes precedence over everything else)
  if (userContext.userId && policy.denylist?.includes(userContext.userId)) {
    return {
      allowed: false,
      reason: 'denylisted',
      statusCode: 403,
      message: 'Access denied',
    };
  }

  // 3. Check allowlist (bypasses tier requirements)
  if (userContext.userId && policy.allowlist?.includes(userContext.userId)) {
    return { allowed: true };
  }

  // 4. Check tier level
  const userTierLevel = getTierLevel(userContext.tier);
  const requiredTierLevel = getTierLevel(policy.minTier);

  if (userTierLevel < requiredTierLevel) {
    // Determine appropriate status code and message
    if (policy.minTier === TIERS.FREE && userContext.tier === TIERS.ANONYMOUS) {
      return {
        allowed: false,
        reason: 'unauthenticated',
        statusCode: 401,
        message: 'Authentication required',
      };
    }

    return {
      allowed: false,
      reason: 'tier_restriction',
      statusCode: 403,
      message: 'Upgrade required to access this feature',
    };
  }

  // 5. For premium features, verify active subscription
  if (policy.minTier === TIERS.PREMIUM && !userContext.hasActiveSubscription) {
    return {
      allowed: false,
      reason: 'no_active_subscription',
      statusCode: 403,
      message: 'Active subscription required',
    };
  }

  // 6. Check rollout percentage if configured
  if (
    userContext.userId &&
    policy.rolloutPercentage !== undefined &&
    policy.rolloutPercentage < 100
  ) {
    const hash = hashUserIdForRollout(userContext.userId, featureKey);
    if (hash >= policy.rolloutPercentage) {
      return {
        allowed: false,
        reason: 'rollout_not_eligible',
        statusCode: 404,
        message: 'Feature not available',
      };
    }
  }

  // All checks passed
  return { allowed: true };
}

/**
 * Log feature access decision (for audit trail and security analysis)
 *
 * @param featureKey - The feature being accessed
 * @param userContext - User context (includes tier, never null)
 * @param result - Access check result
 * @param requestPath - API route path
 * @param requestMethod - HTTP method
 */
function logFeatureAccess(
  featureKey: FeatureFlagKey,
  userContext: UserContext,
  result: FeatureAccessResult,
  requestPath: string,
  requestMethod: string,
) {
  const logData = {
    featureKey,
    userId: userContext.userId || 'anonymous',
    tier: userContext.tier,
    allowed: result.allowed,
    reason: result.reason,
    path: requestPath,
    method: requestMethod,
  };

  if (result.allowed) {
    getLogger().info('[Feature Access] Allowed', { extra: logData });
  } else {
    getLogger().warn('[Feature Access] Denied', { extra: logData });
  }
}

/**
 * Assert that a request has access to a feature
 * This is the main guard function to use in API routes
 *
 * Throws a NextResponse error if access denied
 * Returns user context if access granted
 *
 * @param request - Next.js request object
 * @param featureKey - The feature to protect
 * @returns User context (includes tier, never null)
 * @throws NextResponse with appropriate error if access denied
 *
 * @example
 * // In API route
 * export async function POST(request: NextRequest) {
 *   const userContext = await assertFeatureAccess(request, FEATURE_KEYS.EXCEL_EXPORT);
 *   // Continue with feature logic...
 * }
 */
export async function assertFeatureAccess(
  request: NextRequest,
  featureKey: FeatureFlagKey,
): Promise<UserContext> {
  // Get user context (never null - returns ANONYMOUS tier if not authenticated)
  const userContext = await getUserContext(request);

  // Check feature access
  const result = await checkFeatureAccess(featureKey, userContext);

  // Log access decision
  logFeatureAccess(
    featureKey,
    userContext,
    result,
    request.nextUrl.pathname,
    request.method,
  );

  // If denied, throw error response
  if (!result.allowed) {
    const response = NextResponse.json(
      {
        error: result.message || 'Access denied',
        code: result.reason,
      },
      { status: result.statusCode || 403 },
    );

    // TypeScript hack: throw NextResponse to exit early
    // This will be caught by Next.js and returned to client
    throw response;
  }

  return userContext;
}

/**
 * Middleware wrapper for protecting API routes with feature access
 *
 * This is a higher-order function that wraps your route handler
 * with automatic feature access enforcement
 *
 * @param featureKey - The feature to protect
 * @param handler - Your route handler function
 * @returns Wrapped handler with feature access enforcement
 *
 * @example
 * export const POST = withFeatureAccess(
 *   FEATURE_KEYS.EXCEL_EXPORT,
 *   async (request, userContext) => {
 *     // Your handler logic here
 *     // userContext is guaranteed to have passed access check
 *     return NextResponse.json({ success: true });
 *   }
 * );
 */
export function withFeatureAccess(
  featureKey: FeatureFlagKey,
  handler: (
    request: NextRequest,
    userContext: UserContext,
  ) => Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const userContext = await assertFeatureAccess(request, featureKey);
      return await handler(request, userContext);
    } catch (error) {
      // If error is a NextResponse (from assertFeatureAccess), return it
      if (error instanceof NextResponse) {
        return error;
      }
      // Otherwise, log and return generic error
      getLogger().error(
        '[Feature Access] Unexpected error in route handler',
        error,
      );
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  };
}
