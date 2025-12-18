import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@uth/stripe-server';
import { getAdminFirestore } from '@uth/firebase-server';
import { logger } from '@uth/utils';
import { isFeatureEnabled, FEATURE_KEYS } from '@uth/features';
import * as Sentry from '@sentry/nextjs';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const maxDuration = 30;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  logger.warn(
    'STRIPE_WEBHOOK_SECRET is not defined. Webhook signature verification will fail.',
  );
}

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe checkout is enabled via feature flags
    const stripeEnabled = await isFeatureEnabled(
      FEATURE_KEYS.STRIPE_CHECKOUT_ENABLED,
    );
    if (!stripeEnabled) {
      logger.warn('Stripe webhook received but feature is disabled');
      return NextResponse.json(
        { error: 'Stripe webhooks are not available' },
        { status: 403 },
      );
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      logger.error('Missing stripe-signature header');
      Sentry.captureMessage('Stripe webhook missing signature', {
        level: 'warning',
        tags: { service: 'stripe', operation: 'webhook' },
      });
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 },
      );
    }

    if (!webhookSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured');
      Sentry.captureMessage('STRIPE_WEBHOOK_SECRET not configured', {
        level: 'error',
        tags: { service: 'stripe', operation: 'webhook' },
      });
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 },
      );
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature (CRITICAL for security)
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Webhook signature verification failed', {
        error: errorMessage,
      });
      Sentry.captureException(err, {
        tags: {
          service: 'stripe',
          operation: 'webhook_verification',
        },
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle webhook events
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.log('Unhandled webhook event type', { type: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Webhook handler error', {
      error: errorMessage,
    });

    // Track webhook handler errors in Sentry
    Sentry.captureException(error, {
      tags: {
        service: 'stripe',
        operation: 'webhook_handler',
      },
      contexts: {
        stripe: {
          endpoint: 'webhook',
        },
      },
    });

    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId || session.client_reference_id;
  if (!userId) {
    const error = new Error('No userId found in checkout session');
    Sentry.captureException(error, {
      tags: { service: 'stripe', operation: 'checkout_completed' },
      contexts: { stripe: { sessionId: session.id } },
    });
    throw error;
  }

  // Set Sentry user context
  Sentry.setUser({ id: userId });

  logger.log('Processing checkout completion', { userId, sessionId: session.id });

  const subscriptionId = session.subscription as string;
  const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);

  // Extract subscription data from Response wrapper
  // Using any here because Stripe SDK types can vary between versions
  const subscription = ('data' in subscriptionResponse ? subscriptionResponse.data : subscriptionResponse) as any;

  const firestore = getAdminFirestore();

  // Create subscription document in Firestore
  await firestore
    .collection('subscriptions')
    .doc(userId)
    .set({
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      tier: 'premium',
      status: subscription.status,
      currentPeriodStart: new Date((subscription.current_period_start ?? 0) * 1000),
      currentPeriodEnd: new Date((subscription.current_period_end ?? 0) * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  logger.log('Subscription created in Firestore', {
    userId,
    subscriptionId: subscription.id,
  });
}

async function handleSubscriptionUpdated(subscription: any) {
  const userId = subscription.metadata.userId;
  if (!userId) {
    logger.warn('No userId in subscription metadata', {
      subscriptionId: subscription.id,
    });
    return;
  }

  logger.log('Processing subscription update', {
    userId,
    subscriptionId: subscription.id,
    status: subscription.status,
  });

  const firestore = getAdminFirestore();

  await firestore
    .collection('subscriptions')
    .doc(userId)
    .update({
      status: subscription.status,
      currentPeriodEnd: new Date((subscription.current_period_end || 0) * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      updatedAt: new Date(),
    });

  logger.log('Subscription updated in Firestore', {
    userId,
    status: subscription.status,
  });
}

async function handleSubscriptionDeleted(subscription: any) {
  const userId = subscription.metadata.userId;
  if (!userId) {
    logger.warn('No userId in subscription metadata', {
      subscriptionId: subscription.id,
    });
    return;
  }

  logger.log('Processing subscription deletion', {
    userId,
    subscriptionId: subscription.id,
  });

  const firestore = getAdminFirestore();

  await firestore
    .collection('subscriptions')
    .doc(userId)
    .update({
      tier: 'free',
      status: 'canceled',
      canceledAt: new Date(),
      updatedAt: new Date(),
    });

  logger.log('Subscription canceled in Firestore', { userId });
}

async function handlePaymentFailed(invoice: any) {
  if (!invoice.subscription) {
    logger.warn('Payment failed for invoice without subscription', {
      invoiceId: invoice.id,
    });
    return;
  }

  const subscriptionResponse = await stripe.subscriptions.retrieve(
    invoice.subscription as string,
  );
  // Extract subscription data from Response wrapper
  // Using any here because Stripe SDK types can vary between versions
  const subscription = (
    'data' in subscriptionResponse
      ? subscriptionResponse.data
      : subscriptionResponse
  ) as any;
  const userId = subscription.metadata.userId;

  if (!userId) {
    logger.warn('No userId in subscription metadata', {
      subscriptionId: subscription.id,
    });
    return;
  }

  // Set Sentry user context and track payment failure
  Sentry.setUser({ id: userId });
  Sentry.captureMessage('Stripe payment failed', {
    level: 'warning',
    tags: {
      service: 'stripe',
      operation: 'payment_failed',
    },
    contexts: {
      stripe: {
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
      },
    },
  });

  logger.log('Processing payment failure', {
    userId,
    invoiceId: invoice.id,
    subscriptionId: subscription.id,
  });

  const firestore = getAdminFirestore();

  await firestore
    .collection('subscriptions')
    .doc(userId)
    .update({
      status: 'past_due',
      lastPaymentError: new Date(),
      updatedAt: new Date(),
    });

  logger.log('Payment failure recorded in Firestore', {
    userId,
    invoiceId: invoice.id,
  });

  // TODO: Send email notification to user about payment failure
}
