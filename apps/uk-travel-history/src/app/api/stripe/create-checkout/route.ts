import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, PaymentPlan } from '@uth/payments-server';
import { logger } from '@uth/utils';
import { assertFeatureAccess, FEATURE_KEYS } from '@uth/features/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface CheckoutRequest {
  priceId: string;
  billingPeriod: 'monthly' | 'annual' | 'once';
}

/**
 * POST /api/stripe/create-checkout
 * Creates a Stripe checkout session for authenticated users
 *
 * FEATURE: PAYMENTS (requires authentication when enabled)
 * Enforces feature access via assertFeatureAccess with full validation
 */
export async function POST(request: NextRequest) {
  try {
    // Enforce feature access - Payments feature
    // This validates: feature enabled, tier requirement, rollout percentage, allowlist/denylist
    // Also extracts and validates user context (authentication, subscription tier)
    const userContext = await assertFeatureAccess(request, FEATURE_KEYS.PAYMENTS);

    const userId = userContext.userId;
    const userEmail = userContext.email;

    // Set Sentry user context for error tracking
    logger.setUser({ id: userId ?? undefined, email: userEmail ?? undefined });

    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 },
      );
    }

    const body = (await request.json()) as CheckoutRequest;
    const { billingPeriod } = body;

    // Map billing period to PaymentPlan
    let plan: PaymentPlan;
    if (billingPeriod === 'monthly') {
      plan = PaymentPlan.PREMIUM_MONTHLY;
    } else if (billingPeriod === 'annual') {
      plan = PaymentPlan.PREMIUM_ANNUAL;
    } else if (billingPeriod === 'once') {
      plan = PaymentPlan.PREMIUM_ONCE;
    } else {
      return NextResponse.json(
        { error: 'Invalid billing period' },
        { status: 400 },
      );
    }

    // Get the app URL for success/cancel redirects
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Create checkout session using SDK
    const session = await createCheckoutSession({
      plan,
      userId,
      customerEmail: userEmail,
      successUrl: `${appUrl}/travel?checkout=success`,
      cancelUrl: `${appUrl}/travel?checkout=canceled`,
      metadata: {
        billingPeriod,
      },
    });

    logger.info('Stripe checkout session created', {
      extra: {
        userId,
        sessionId: session.id,
        billingPeriod,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    // Track error with context
    logger.error('Stripe checkout error', error, {
      tags: {
        service: 'stripe',
        operation: 'create_checkout',
      },
      contexts: {
        stripe: {
          endpoint: 'create-checkout',
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
