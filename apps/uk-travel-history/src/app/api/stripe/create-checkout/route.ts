import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, PaymentPlan } from '@uth/payments-server';
import { verifyToken } from '@uth/auth-server';
import { logger } from '@uth/utils';
import { isFeatureEnabled, FEATURE_KEYS } from '@uth/features';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface CheckoutRequest {
  priceId: string;
  billingPeriod: 'monthly' | 'annual' | 'once';
}

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe checkout is enabled via feature flags
    const stripeEnabled = await isFeatureEnabled(FEATURE_KEYS.PAYMENTS);
    if (!stripeEnabled) {
      logger.warn('Stripe checkout feature is disabled', undefined);
      return NextResponse.json(
        { error: 'Stripe checkout is not available' },
        { status: 403 },
      );
    }

    // Verify authentication using SDK
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];

    let tokenClaims;
    try {
      tokenClaims = await verifyToken(token);
    } catch (authError) {
      // Track auth failures
      logger.error('Token verification failed', authError, {
        tags: {
          service: 'auth',
          operation: 'verify_token',
          endpoint: 'create-checkout',
        },
        contexts: {
          auth: {
            hasAuthHeader: !!authHeader,
            tokenLength: token?.length,
          },
        },
      });
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 },
      );
    }

    const userId = tokenClaims.uid;
    const userEmail = tokenClaims.email;

    // Set Sentry user context for error tracking
    logger.setUser({ id: userId, email: userEmail ?? undefined });

    if (!userEmail) {
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
