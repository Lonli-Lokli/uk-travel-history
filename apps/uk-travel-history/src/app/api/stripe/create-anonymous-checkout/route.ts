import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, PaymentPlan } from '@uth/payments-server';
import { logger } from '@uth/utils';
import { isFeatureEnabled, FEATURE_KEYS } from '@uth/features';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface AnonymousCheckoutRequest {
  priceId: string;
  billingPeriod: 'monthly' | 'annual';
}

/**
 * Create Stripe Checkout session for anonymous users (payment before registration).
 *
 * SECURITY: This endpoint does NOT require authentication.
 * Users pay first, then create account on return from Stripe.
 *
 * Flow:
 * 1. Anonymous user clicks "Subscribe"
 * 2. This creates Stripe Checkout session
 * 3. User completes payment on Stripe
 * 4. Stripe redirects to /registration?session_id=xxx
 * 5. User creates passkey account
 * 6. Account linked to payment via session_id
 */
export async function POST(request: NextRequest) {
  try {
    // Check if Stripe checkout is enabled via feature flags
    const stripeEnabled = await isFeatureEnabled(FEATURE_KEYS.PAYMENTS);
    if (!stripeEnabled) {
      logger.warn('[Anonymous Checkout] Stripe checkout feature is disabled');
      return NextResponse.json(
        { error: 'Stripe checkout is not available' },
        { status: 403 },
      );
    }

    const body = (await request.json()) as AnonymousCheckoutRequest;
    const { billingPeriod } = body;

    // Map billing period to PaymentPlan
    const plan =
      billingPeriod === 'monthly'
        ? PaymentPlan.PREMIUM_MONTHLY
        : billingPeriod === 'annual'
          ? PaymentPlan.PREMIUM_ANNUAL
          : null;

    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid billing period' },
        { status: 400 },
      );
    }

    // Get the app URL for success/cancel redirects
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Create anonymous checkout session using SDK
    // Note: No userId - this is pre-registration flow
    const session = await createCheckoutSession({
      plan,
      // CRITICAL: Redirect to registration page with session_id
      // {CHECKOUT_SESSION_ID} is Stripe template variable
      successUrl: `${appUrl}/registration?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/?checkout=canceled`,
      metadata: {
        billingPeriod,
        checkoutType: 'new_subscription',
        isPreRegistration: 'true',
      },
    });

    logger.log('[Anonymous Checkout] Session created', {
      sessionId: session.id,
      billingPeriod,
    });

    // Track in Sentry for monitoring
    Sentry.addBreadcrumb({
      category: 'stripe',
      message: 'Anonymous checkout session created',
      level: 'info',
      data: {
        sessionId: session.id,
        billingPeriod,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    logger.error('[Anonymous Checkout] Error:', error);

    // Track error in Sentry with context
    Sentry.captureException(error, {
      tags: {
        service: 'stripe',
        operation: 'create_anonymous_checkout',
      },
      contexts: {
        stripe: {
          endpoint: 'create-anonymous-checkout',
        },
      },
    });

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
