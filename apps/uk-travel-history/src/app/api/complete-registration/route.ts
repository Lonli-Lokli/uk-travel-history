import { NextRequest, NextResponse } from 'next/server';
import {
  retrieveCheckoutSession,
  retrieveSubscription,
} from '@uth/payments-server';
import {
  verifyToken,
  createSubscription,
  getSubscriptionBySessionId,
  SubscriptionStatus,
} from '@uth/auth-server';
import { logger } from '@uth/utils';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface CompleteRegistrationRequest {
  session_id: string;
  userId: string;
}

/**
 * Complete registration by linking Firebase user to Stripe subscription.
 *
 * SECURITY: This endpoint REQUIRES authentication.
 * User must have just created passkey account and has valid Firebase token.
 *
 * Flow:
 * 1. User paid via Stripe (session_id provided)
 * 2. User created passkey → Firebase user created
 * 3. This endpoint links Firebase UID to Stripe subscription
 * 4. Creates /subscriptions/{userId} document in Firestore
 * 5. Marks session as "consumed" to prevent reuse
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify Firebase authentication using SDK
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];

    let tokenClaims;
    try {
      tokenClaims = await verifyToken(token);
    } catch (authError) {
      Sentry.captureException(authError, {
        tags: {
          service: 'auth',
          operation: 'verify_token',
          endpoint: 'complete-registration',
        },
      });
      logger.error(
        '[Complete Registration] Token verification failed:',
        authError,
      );
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 },
      );
    }

    const authenticatedUserId = tokenClaims.uid;

    // Parse request body
    const body = (await request.json()) as CompleteRegistrationRequest;
    const { session_id, userId } = body;

    // SECURITY: Verify userId in request matches authenticated user
    if (userId !== authenticatedUserId) {
      logger.warn('[Complete Registration] User ID mismatch', {
        providedUserId: userId,
        authenticatedUserId,
      });
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    }

    // Validate session_id format
    if (!session_id || !session_id.startsWith('cs_')) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 },
      );
    }

    // Retrieve session from Stripe using SDK
    const session = await retrieveCheckoutSession(session_id);

    // Verify payment was completed
    if (session.paymentStatus !== 'paid') {
      logger.warn('[Complete Registration] Payment not completed', {
        sessionId: session_id,
        paymentStatus: session.paymentStatus,
      });
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 },
      );
    }

    // Verify session is for new subscription
    if (session.metadata?.checkoutType !== 'new_subscription') {
      return NextResponse.json(
        { error: 'Invalid session type' },
        { status: 400 },
      );
    }

    // Check if session already used using SDK (prevent duplicate registrations)
    const existingSubscription = await getSubscriptionBySessionId(session_id);

    if (existingSubscription) {
      logger.warn('[Complete Registration] Session already used', {
        sessionId: session_id,
      });
      return NextResponse.json(
        { error: 'Session already used' },
        { status: 400 },
      );
    }

    // Retrieve subscription details from Stripe
    const subscriptionId = session.subscriptionId;
    const customerId = session.customerId;

    if (!subscriptionId || !customerId) {
      logger.error(
        '[Complete Registration] Missing subscription or customer ID',
        {
          sessionId: session_id,
          subscriptionId,
          customerId,
        },
      );
      return NextResponse.json(
        { error: 'Invalid session data' },
        { status: 400 },
      );
    }

    // Fetch subscription details from Stripe using SDK
    const subscription = await retrieveSubscription(subscriptionId);

    // Create subscription document using SDK
    await createSubscription({
      userId,
      status: subscription.status as SubscriptionStatus,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeSessionId: session_id, // Mark session as consumed
      stripePriceId: subscription.priceId,
      currentPeriodStart: new Date(subscription.currentPeriodStart * 1000),
      currentPeriodEnd: new Date(subscription.currentPeriodEnd * 1000),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    });

    logger.log('[Complete Registration] Subscription linked successfully', {
      userId,
      subscriptionId,
      customerId,
    });

    // Track successful registration in Sentry
    Sentry.addBreadcrumb({
      category: 'registration',
      message: 'User registration completed',
      level: 'info',
      data: {
        userId,
        subscriptionId,
      },
    });

    return NextResponse.json({
      success: true,
      userId,
      subscriptionId,
    });
  } catch (error) {
    logger.error('[Complete Registration] Error:', error);

    Sentry.captureException(error, {
      tags: {
        service: 'registration',
        operation: 'complete_registration',
      },
    });

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Failed to complete registration' },
      { status: 500 },
    );
  }
}
