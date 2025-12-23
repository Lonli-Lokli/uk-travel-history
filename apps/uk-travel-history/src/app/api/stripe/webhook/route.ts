import { NextRequest, NextResponse } from 'next/server';
import {
  constructWebhookEvent,
  retrieveSubscription,
} from '@uth/payments-server';
import {
  createSubscription,
  updateSubscription,
  SubscriptionStatus,
} from '@uth/auth-server';
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
    const stripeEnabled = await isFeatureEnabled(FEATURE_KEYS.STRIPE_CHECKOUT);
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
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
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
      // Verify webhook signature using SDK (CRITICAL for security)
      event = constructWebhookEvent(body, signature, webhookSecret);
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
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
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

  // PAYMENT-FIRST ARCHITECTURE:
  // If no userId, this is a pre-registration payment.
  // The subscription document will be created by /api/complete-registration
  // after the user creates their passkey account.
  if (!userId) {
    logger.log('Checkout completed for pre-registration payment', {
      sessionId: session.id,
      customerId: session.customer,
      isPreRegistration: session.metadata?.isPreRegistration === 'true',
    });

    // Track successful payment (but no user yet)
    Sentry.addBreadcrumb({
      category: 'payment',
      message: 'Pre-registration payment completed',
      level: 'info',
      data: {
        sessionId: session.id,
        customerId: session.customer,
      },
    });

    return; // Exit early - subscription will be linked later
  }

  // EXISTING USER FLOW:
  // If userId exists, this is an authenticated user upgrading/subscribing
  // Set Sentry user context
  Sentry.setUser({ id: userId });

  logger.log('Processing checkout completion for existing user', {
    userId,
    sessionId: session.id,
  });

  const subscriptionId = session.subscription as string;
  const subscription = await retrieveSubscription(subscriptionId);

  // Create/update subscription document using SDK
  await createSubscription({
    userId,
    stripeCustomerId: session.customer as string,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.priceId,
    status: subscription.status as SubscriptionStatus,
    currentPeriodStart: new Date(subscription.currentPeriodStart * 1000),
    currentPeriodEnd: new Date(subscription.currentPeriodEnd * 1000),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  });

  logger.log('Subscription created via SDK', {
    userId,
    subscriptionId: subscription.id,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
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

  // Update subscription using SDK
  await updateSubscription(userId, {
    status: subscription.status as SubscriptionStatus,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
  });

  logger.log('Subscription updated via SDK', {
    userId,
    status: subscription.status,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
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

  // Update subscription to canceled using SDK
  await updateSubscription(userId, {
    status: SubscriptionStatus.CANCELED,
    canceledAt: new Date(),
  });

  logger.log('Subscription canceled via SDK', { userId });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) {
    logger.warn('Payment failed for invoice without subscription', {
      invoiceId: invoice.id,
    });
    return;
  }

  const subscription = await retrieveSubscription(invoice.subscription as string);
  const userId = subscription.metadata?.userId;

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

  // Update subscription to past_due using SDK
  await updateSubscription(userId, {
    status: SubscriptionStatus.PAST_DUE,
    lastPaymentError: new Date(),
  });

  logger.log('Payment failure recorded via SDK', {
    userId,
    invoiceId: invoice.id,
  });

  // TODO: Send email notification to user about payment failure
}
