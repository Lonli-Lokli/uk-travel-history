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

/* eslint-disable @nx/enforce-module-boundaries */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@uth/utils';
import type { LogOptions } from '@uth/utils';
import { getUserByAuthId } from '@uth/db';
import { isFeatureEnabled } from './edgeConfigFlags';
import { FEATURES, type FeatureId, type TierId, TIERS } from './features';

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

// Dynamic imports for lazy-loaded libraries
// auth-server is marked as lazy-loaded in nx.json to avoid circular dependencies
// We use dynamic imports at runtime instead of static imports

// Re-export SubscriptionStatus enum values for use in this file
// This avoids static imports of @uth/auth-server
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
 * Feature policy configuration (remote-configurable via Edge Config)
 * This allows changing feature behavior without code deployment
 */
export interface FeaturePolicy {
  /** Global kill switch - if false, feature is disabled for everyone */
  enabled: boolean;
  /** Feature mode - controls tier requirements */
  mode: 'free' | 'paid';
  /** Minimum tier required (only enforced if mode='paid') */
  minTier: TierId;
  /** Rollout percentage (0-100) for gradual feature rollout */
  rolloutPercentage?: number;
  /** Explicit allowlist of user IDs (bypasses tier check) */
  allowlist?: string[];
  /** Explicit denylist of user IDs (blocks access regardless of tier) */
  denylist?: string[];
}

/**
 * Default feature policies (used as fallback if Edge Config unavailable)
 * Conservative defaults: features are enabled but require appropriate tier
 */
export const DEFAULT_FEATURE_POLICIES: Record<FeatureId, FeaturePolicy> = {
  [FEATURES.BASIC_CALCULATION]: {
    enabled: true,
    mode: 'free',
    minTier: TIERS.FREE,
  },
  [FEATURES.PDF_IMPORT]: {
    enabled: true,
    mode: 'free',
    minTier: TIERS.FREE,
  },
  [FEATURES.CSV_IMPORT]: {
    enabled: true,
    mode: 'free',
    minTier: TIERS.FREE,
  },
  [FEATURES.MANUAL_ENTRY]: {
    enabled: true,
    mode: 'free',
    minTier: TIERS.FREE,
  },
  [FEATURES.EXCEL_EXPORT]: {
    enabled: true,
    mode: 'paid',
    minTier: TIERS.PREMIUM,
  },
  [FEATURES.PDF_EXPORT]: {
    enabled: false, // Coming soon
    mode: 'paid',
    minTier: TIERS.PREMIUM,
  },
  [FEATURES.EMPLOYER_LETTERS]: {
    enabled: false, // Coming soon
    mode: 'paid',
    minTier: TIERS.PREMIUM,
  },
  [FEATURES.CLOUD_SYNC]: {
    enabled: false, // Coming soon
    mode: 'paid',
    minTier: TIERS.PREMIUM,
  },
  [FEATURES.ADVANCED_ANALYTICS]: {
    enabled: false, // Coming soon
    mode: 'paid',
    minTier: TIERS.PREMIUM,
  },
};

/**
 * User context for feature access checks
 * Contains all information needed to determine feature eligibility
 */
export interface UserContext {
  /** User ID from authentication provider (e.g., Clerk user ID) */
  userId: string;
  /** User's email (optional, for logging) */
  email?: string;
  /** User's subscription tier */
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
 * @returns User context or null if not authenticated
 */
export async function getUserContext(
  _request: NextRequest,
): Promise<UserContext | null> {
  try {
    // Determine auth provider from environment
    const authProvider = process.env.UTH_AUTH_PROVIDER || 'clerk';

    let userId: string | null = null;

    if (authProvider === 'clerk') {
      // Use Clerk's auth() helper to get current user
      const { auth } = await import('@clerk/nextjs/server');
      const authResult = await auth();
      userId = authResult.userId;
    } else {
      // For Firebase mode, extract from Authorization header
      const { getSessionFromRequest } = await import('@uth/auth-server');
      try {
        const session = await getSessionFromRequest(_request.headers);
        userId = session.user.uid;
      } catch {
        userId = null;
      }
    }

    if (!userId) {
      return null;
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

    // Check subscription status (dynamic import to avoid lazy-load violation)
    const { getSubscription } = await import('@uth/auth-server');
    const subscription = await getSubscription(userId);

    const hasActiveSubscription =
      subscription?.status === SubscriptionStatus.ACTIVE ||
      subscription?.status === SubscriptionStatus.TRIALING;

    const tier: TierId = hasActiveSubscription ? TIERS.PREMIUM : TIERS.FREE;

    return {
      userId,
      email: dbUser.email,
      tier,
      hasActiveSubscription,
    };
  } catch (error) {
    getLogger().error('[Feature Guards] Error extracting user context', error);
    return null;
  }
}

/**
 * Get feature policy from Edge Config or use default
 * This allows runtime control of feature behavior without redeployment
 *
 * @param featureId - The feature to check
 * @returns Feature policy
 */
async function getFeaturePolicy(
  featureId: FeatureId,
): Promise<FeaturePolicy> {
  try {
    // Check if feature is enabled via Edge Config
    const isEnabled = await isFeatureEnabled(featureId as any);

    // Get default policy
    const defaultPolicy = DEFAULT_FEATURE_POLICIES[featureId];

    // For now, we only override the 'enabled' flag from Edge Config
    // Future enhancement: Store complete policy in Edge Config
    return {
      ...defaultPolicy,
      enabled: isEnabled,
    };
  } catch (error) {
    getLogger().warn('[Feature Guards] Error fetching feature policy, using defaults', {
      extra: { featureId, error },
    });
    return DEFAULT_FEATURE_POLICIES[featureId];
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
 * @param featureId - The feature to check
 * @param userContext - User context (null if unauthenticated)
 * @returns Access result with decision and reason
 */
export async function checkFeatureAccess(
  featureId: FeatureId,
  userContext: UserContext | null,
): Promise<FeatureAccessResult> {
  // Get feature policy
  const policy = await getFeaturePolicy(featureId);

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
  if (userContext && policy.denylist?.includes(userContext.userId)) {
    return {
      allowed: false,
      reason: 'denylisted',
      statusCode: 403,
      message: 'Access denied',
    };
  }

  // 3. Check allowlist (bypasses tier requirements)
  if (userContext && policy.allowlist?.includes(userContext.userId)) {
    return { allowed: true };
  }

  // 4. Check if feature requires authentication
  if (policy.mode === 'paid' && !userContext) {
    return {
      allowed: false,
      reason: 'unauthenticated',
      statusCode: 401,
      message: 'Authentication required',
    };
  }

  // 5. For free mode, allow all authenticated users (or all users if auth not required)
  if (policy.mode === 'free') {
    // Check rollout percentage if configured
    if (
      userContext &&
      policy.rolloutPercentage !== undefined &&
      policy.rolloutPercentage < 100
    ) {
      const hash = hashUserIdForRollout(userContext.userId, featureId);
      if (hash >= policy.rolloutPercentage) {
        return {
          allowed: false,
          reason: 'rollout_not_eligible',
          statusCode: 404,
          message: 'Feature not available',
        };
      }
    }
    return { allowed: true };
  }

  // 6. For paid mode, check tier and subscription
  if (policy.mode === 'paid') {
    if (!userContext) {
      return {
        allowed: false,
        reason: 'unauthenticated',
        statusCode: 401,
        message: 'Authentication required',
      };
    }

    // Check if user's tier meets minimum requirement
    const userTierLevel = userContext.tier === TIERS.PREMIUM ? 1 : 0;
    const requiredTierLevel = policy.minTier === TIERS.PREMIUM ? 1 : 0;

    if (userTierLevel < requiredTierLevel) {
      return {
        allowed: false,
        reason: 'tier_restriction',
        statusCode: 403,
        message: 'Upgrade required to access this feature',
      };
    }

    // For premium features, verify active subscription
    if (policy.minTier === TIERS.PREMIUM && !userContext.hasActiveSubscription) {
      return {
        allowed: false,
        reason: 'no_active_subscription',
        statusCode: 403,
        message: 'Active subscription required',
      };
    }

    // Check rollout percentage if configured
    if (
      policy.rolloutPercentage !== undefined &&
      policy.rolloutPercentage < 100
    ) {
      const hash = hashUserIdForRollout(userContext.userId, featureId);
      if (hash >= policy.rolloutPercentage) {
        return {
          allowed: false,
          reason: 'rollout_not_eligible',
          statusCode: 404,
          message: 'Feature not available',
        };
      }
    }

    return { allowed: true };
  }

  // Shouldn't reach here, but fail closed for safety
  return {
    allowed: false,
    reason: 'feature_disabled',
    statusCode: 403,
    message: 'Feature not available',
  };
}

/**
 * Log feature access decision (for audit trail and security analysis)
 *
 * @param featureId - The feature being accessed
 * @param userContext - User context (null if unauthenticated)
 * @param result - Access check result
 * @param requestPath - API route path
 * @param requestMethod - HTTP method
 */
function logFeatureAccess(
  featureId: FeatureId,
  userContext: UserContext | null,
  result: FeatureAccessResult,
  requestPath: string,
  requestMethod: string,
) {
  const logData = {
    featureId,
    userId: userContext?.userId || 'anonymous',
    tier: userContext?.tier || 'none',
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
 * @param featureId - The feature to protect
 * @returns User context (or null for free features)
 * @throws NextResponse with appropriate error if access denied
 *
 * @example
 * // In API route
 * export async function POST(request: NextRequest) {
 *   const userContext = await assertFeatureAccess(request, FEATURES.EXCEL_EXPORT);
 *   // Continue with feature logic...
 * }
 */
export async function assertFeatureAccess(
  request: NextRequest,
  featureId: FeatureId,
): Promise<UserContext | null> {
  // Get user context
  const userContext = await getUserContext(request);

  // Check feature access
  const result = await checkFeatureAccess(featureId, userContext);

  // Log access decision
  logFeatureAccess(
    featureId,
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
 * @param featureId - The feature to protect
 * @param handler - Your route handler function
 * @returns Wrapped handler with feature access enforcement
 *
 * @example
 * export const POST = withFeatureAccess(
 *   FEATURES.EXCEL_EXPORT,
 *   async (request, userContext) => {
 *     // Your handler logic here
 *     // userContext is guaranteed to be valid
 *     return NextResponse.json({ success: true });
 *   }
 * );
 */
export function withFeatureAccess(
  featureId: FeatureId,
  handler: (
    request: NextRequest,
    userContext: UserContext | null,
  ) => Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const userContext = await assertFeatureAccess(request, featureId);
      return await handler(request, userContext);
    } catch (error) {
      // If error is a NextResponse (from assertFeatureAccess), return it
      if (error instanceof NextResponse) {
        return error;
      }
      // Otherwise, log and return generic error
      getLogger().error('[Feature Access] Unexpected error in route handler', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  };
}
