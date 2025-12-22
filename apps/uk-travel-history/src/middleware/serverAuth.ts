import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@uth/firebase-server';
import { get } from '@vercel/edge-config';
import { logger } from '@uth/utils';
import * as Sentry from '@sentry/nextjs';
import { FEATURE_KEYS, isFeatureEnabled } from '@uth/features';

export interface AuthContext {
  userId: string;
  email: string | null;
  emailVerified: boolean;
}

/**
 * Verifies Firebase authentication token and subscription status.
 *
 * SECURITY: This function runs on the server and CANNOT be bypassed by client.
 * All protected API routes MUST use this or requirePaidFeature().
 *
 * @throws {AuthError} If authentication fails or subscription is not active
 */
export async function verifyAuth(
  request: NextRequest,
): Promise<AuthContext | null> {
  const isAuthEnabled = await isFeatureEnabled(FEATURE_KEYS.FIREBASE_AUTH);
  if (isAuthEnabled === false) {
    return Promise.resolve(null);
  }

  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 401);
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token, true);

    // Check subscription status in Firestore
    const adminFirestore = getAdminFirestore();
    const subscriptionDoc = await adminFirestore
      .collection('subscriptions')
      .doc(decodedToken.uid)
      .get();

    if (!subscriptionDoc.exists) {
      logger.warn('[Auth] User has no subscription', {
        userId: decodedToken.uid,
      });
      throw new AuthError('No active subscription found', 403);
    }

    const subscriptionData = subscriptionDoc.data();
    const subscriptionStatus = subscriptionData?.status;

    // Only active subscriptions allowed
    if (subscriptionStatus !== 'active') {
      logger.warn('[Auth] Subscription not active', {
        userId: decodedToken.uid,
        status: subscriptionStatus,
      });
      throw new AuthError(
        'Subscription not active. Please update payment method.',
        403,
      );
    }

    return {
      userId: decodedToken.uid,
      email: decodedToken.email || null,
      emailVerified: decodedToken.email_verified || false,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    logger.error('[Auth] Token verification failed:', error);
    Sentry.captureException(error, {
      tags: {
        service: 'auth',
        operation: 'verify_token',
      },
    });

    throw new AuthError('Invalid or expired authentication token', 401);
  }
}

/**
 * Server-side check if a feature requires payment (via Vercel Edge Config).
 *
 * SECURITY: This MUST be called server-side for all protected routes.
 * Client-side checks are for UX only and can be bypassed.
 *
 * Edge Config format:
 * {
 *   "premium_features": ["excel_export", "pdf_export", "cloud_sync", ...]
 * }
 *
 * @param featureId - The feature ID to check (e.g., "excel_export")
 * @returns true if feature requires payment, false if free
 *
 * Fail-closed behavior:
 * - If Edge Config unavailable → assumes ALL features are premium (blocks access)
 * - If Edge Config returns empty → assumes ALL features are premium (blocks access)
 * - If error fetching Edge Config → assumes feature is premium (blocks access)
 */
export async function isFeaturePremium(featureId: string): Promise<boolean> {
  try {
    // Fetch from Edge Config (server-side only)
    const premiumFeatures = await get<string[]>('premium_features');

    // Fail-closed: if no config, assume all features are premium
    if (!premiumFeatures || premiumFeatures.length === 0) {
      logger.warn(
        '[Feature Check] Edge Config unavailable or empty - blocking all features',
        {
          featureId,
        },
      );
      return true; // Block access
    }

    const isPremium = premiumFeatures.includes(featureId);

    logger.log('[Feature Check] Feature checked', {
      featureId,
      isPremium,
      totalPremiumFeatures: premiumFeatures.length,
    });

    return isPremium;
  } catch (error) {
    logger.error('[Feature Check] Failed to fetch Edge Config:', error);

    Sentry.captureException(error, {
      tags: {
        service: 'edge-config',
        operation: 'fetch_premium_features',
      },
      contexts: {
        feature: {
          featureId,
        },
      },
    });

    // Fail-closed: assume premium on error
    return true;
  }
}

/**
 * Combined auth + feature check for protected API routes.
 *
 * SECURITY: Use this in ALL API routes that serve premium features.
 * This is the primary security control for feature gating.
 *
 * Flow:
 * 1. Checks if feature is enabled (via Edge Config feature flags)
 * 2. Verifies user is authenticated with active subscription
 * 3. Checks if feature requires payment (via Edge Config premium_features list)
 * 4. If feature is free, allows access
 * 5. If feature is premium, allows access (subscription already verified)
 *
 * @param request - Next.js request object
 * @param featureId - Feature ID to check (e.g., "excel_export")
 * @returns AuthContext if authorized
 * @throws {AuthError} If not authorized
 *
 * Example usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   try {
 *     const authContext = await requirePaidFeature(request, 'excel_export');
 *     // User is authorized - proceed with feature
 *   } catch (error) {
 *     if (error instanceof AuthError) {
 *       return NextResponse.json({ error: error.message }, { status: error.statusCode });
 *     }
 *   }
 * }
 * ```
 */
export async function requirePaidFeature(
  request: NextRequest,
  featureId: string,
): Promise<AuthContext | null> {
  // Step 1: Check if the feature is enabled via feature flags
  // This allows us to disable features at runtime without code changes
  const enabled = await isFeatureEnabled(featureId as any);

  if (!enabled) {
    logger.warn('[Paid Feature] Feature is disabled', {
      featureId,
    });
    throw new AuthError('This feature is currently disabled', 403);
  }

  // Step 2: Verify user is authenticated with active subscription
  const authContext = await verifyAuth(request);

  // Step 3: Check if this specific feature requires payment
  const isPremium = await isFeaturePremium(featureId);

  if (!isPremium) {
    // Feature is not premium - allow access without subscription check
    logger.log('[Paid Feature] Free feature accessed', {
      userId: authContext?.userId,
      featureId,
    });
    return authContext;
  }

  // Feature IS premium - subscription already verified in verifyAuth()
  // If we're here, user has active subscription, so they can access it
  logger.log('[Paid Feature] Premium feature accessed', {
    userId: authContext?.userId,
    featureId,
  });

  return authContext;
}

/**
 * Custom error class for authentication failures.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Helper to create standardized error responses.
 */
export function createAuthErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.name,
      },
      { status: error.statusCode },
    );
  }

  // Unexpected error - don't leak details
  logger.error('[Auth] Unexpected error:', error);
  Sentry.captureException(error, {
    tags: {
      service: 'auth',
      operation: 'error_response',
    },
  });

  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
