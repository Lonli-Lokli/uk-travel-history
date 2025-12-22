import { NextRequest, NextResponse } from 'next/server';
import { StripeAPI, STRIPE_PRICES } from '@uth/stripe-server';
import { getAdminAuth } from '@uth/firebase-server';
import { logger } from '@uth/utils';
import { isFeatureEnabled, FEATURE_KEYS } from '@uth/features';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface CheckoutRequest {
  priceId: string;
  billingPeriod: 'monthly' | 'annual' | 'once';
}

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe checkout is enabled via feature flags
    const stripeEnabled = await isFeatureEnabled(
      FEATURE_KEYS.STRIPE_CHECKOUT,
    );
    if (!stripeEnabled) {
      logger.warn('Stripe checkout feature is disabled');
      return NextResponse.json(
        { error: 'Stripe checkout is not available' },
        { status: 403 },
      );
    }

    // Verify Firebase authentication
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
      // Track Firebase auth failures in Sentry
      Sentry.captureException(authError, {
        tags: {
          service: 'firebase',
          operation: 'verify_token',
          endpoint: 'create-checkout',
        },
        contexts: {
          auth: {
            hasAuthHeader: !!authHeader,
            tokenLength: token?.length,
          },
        },
        level: 'error',
      });
      logger.error('Firebase token verification failed:', authError);
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 },
      );
    }

    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;

    // Set Sentry user context for error tracking
    Sentry.setUser({ id: userId, email: userEmail ?? undefined });

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 },
      );
    }

    const body = (await request.json()) as CheckoutRequest;
    const { priceId, billingPeriod } = body;

    // Validate price ID
    if (
      priceId !== STRIPE_PRICES.PREMIUM_MONTHLY &&
      priceId !== STRIPE_PRICES.PREMIUM_ANNUAL
    ) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
    }

    // Validate billing period
    if (
      billingPeriod !== 'monthly' &&
      billingPeriod !== 'annual' &&
      billingPeriod !== 'once'
    ) {
      return NextResponse.json(
        { error: 'Invalid billing period' },
        { status: 400 },
      );
    }

    // Get the app URL for success/cancel redirects
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Create Stripe Checkout session
    const session = await StripeAPI.checkout.sessions.create({
      customer_email: userEmail,
      client_reference_id: userId, // Link to Firebase user
      metadata: {
        userId,
        billingPeriod,
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/travel?checkout=success`,
      cancel_url: `${appUrl}/travel?checkout=canceled`,
      subscription_data: {
        metadata: {
          userId,
        },
      },
    });

    logger.log('Stripe checkout session created', {
      userId,
      sessionId: session.id,
      billingPeriod,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    logger.error('Stripe checkout error:', error);

    // Track error in Sentry with context
    Sentry.captureException(error, {
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
