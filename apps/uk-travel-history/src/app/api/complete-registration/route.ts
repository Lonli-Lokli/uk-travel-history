import { NextRequest, NextResponse } from 'next/server';
import { StripeAPI } from '@uth/stripe-server';
import { getAdminAuth, getAdminFirestore } from '@uth/firebase-server';
import { logger } from '@uth/utils';
import * as Sentry from '@sentry/nextjs';
import type Stripe from 'stripe';

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
    // SECURITY: Verify Firebase authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = getAdminAuth();

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (authError) {
      Sentry.captureException(authError, {
        tags: {
          service: 'firebase',
          operation: 'verify_token',
          endpoint: 'complete-registration',
        },
      });
      logger.error('[Complete Registration] Token verification failed:', authError);
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 },
      );
    }

    const authenticatedUserId = decodedToken.uid;

    // Parse request body
    const body = (await request.json()) as CompleteRegistrationRequest;
    const { session_id, userId } = body;

    // SECURITY: Verify userId in request matches authenticated user
    if (userId !== authenticatedUserId) {
      logger.warn('[Complete Registration] User ID mismatch', {
        providedUserId: userId,
        authenticatedUserId,
      });
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 },
      );
    }

    // Validate session_id format
    if (!session_id || !session_id.startsWith('cs_')) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 },
      );
    }

    // Retrieve session from Stripe
    const session = await StripeAPI.checkout.sessions.retrieve(session_id);

    // Verify payment was completed
    if (session.payment_status !== 'paid') {
      logger.warn('[Complete Registration] Payment not completed', {
        sessionId: session_id,
        paymentStatus: session.payment_status,
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

    const adminFirestore = getAdminFirestore();

    // Check if session already used (prevent duplicate registrations)
    const existingSubscription = await adminFirestore
      .collection('subscriptions')
      .where('stripeSessionId', '==', session_id)
      .limit(1)
      .get();

    if (!existingSubscription.empty) {
      logger.warn('[Complete Registration] Session already used', {
        sessionId: session_id,
      });
      return NextResponse.json(
        { error: 'Session already used' },
        { status: 400 },
      );
    }

    // Retrieve subscription details from Stripe
    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    if (!subscriptionId || !customerId) {
      logger.error('[Complete Registration] Missing subscription or customer ID', {
        sessionId: session_id,
        subscriptionId,
        customerId,
      });
      return NextResponse.json(
        { error: 'Invalid session data' },
        { status: 400 },
      );
    }

    // Fetch subscription details
    const subscriptionResponse = await StripeAPI.subscriptions.retrieve(
      subscriptionId,
    );

    // Extract subscription data from Response wrapper
    // Using any here because Stripe SDK types can vary between versions
    const subscription =
      'data' in subscriptionResponse
        ? (subscriptionResponse as any).data
        : (subscriptionResponse as any);

    // Create subscription document in Firestore
    const subscriptionData = {
      userId,
      status: subscription.status, // 'active' | 'past_due' | 'canceled', etc.
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeSessionId: session_id, // Mark session as consumed
      currentPeriodStart: new Date(
        (subscription.current_period_start ?? 0) * 1000,
      ),
      currentPeriodEnd: new Date((subscription.current_period_end ?? 0) * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await adminFirestore
      .collection('subscriptions')
      .doc(userId)
      .set(subscriptionData);

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
