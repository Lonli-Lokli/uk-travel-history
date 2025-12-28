/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events
 * Provisions users after successful one-time payment
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  hasWebhookEventBeenProcessed,
  recordWebhookEvent,
  getPurchaseIntentById,
  updatePurchaseIntent,
  createUser as createDbUser,
  updateUserByAuthId,
  getUserByAuthId,
  PurchaseIntentStatus,
  SubscriptionTier,
  SubscriptionStatus,
} from '@uth/db';
import type { WebhookEvent } from '@uth/payments-server';
import { constructWebhookEvent } from '@uth/payments-server';
import { createUser as createAuthUser, getUsersByEmail } from '@uth/auth-server';
import { getRouteLogger } from '@/lib/routeLogger';

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      getRouteLogger().error('Missing stripe-signature header', undefined);
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      getRouteLogger().error('STRIPE_WEBHOOK_SECRET not configured', undefined);
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 },
      );
    }

    // Verify webhook signature
    let event: any;
    try {
      event = constructWebhookEvent(body, signature, WEBHOOK_SECRET);
    } catch (err: any) {
      getRouteLogger().error('Webhook signature verification failed', undefined, {
        extra: { message: err.message },
      });
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 },
      );
    }

    // Check if event already processed (idempotency)
    const alreadyProcessed = await hasWebhookEventBeenProcessed(event.id);

    if (alreadyProcessed) {
      getRouteLogger().info(`Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, skipped: true });
    }

    // Record webhook event
    await recordWebhookEvent({
      stripeEventId: event.id,
      type: event.type,
      payload: event.data.object as any,
    });

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;

      getRouteLogger().info('Processing checkout.session.completed', {
        extra: { sessionId: session.id },
      });

      // Get purchase intent via client_reference_id or metadata
      const purchaseIntentId =
        session.client_reference_id || session.metadata?.purchase_intent_id;

      if (!purchaseIntentId) {
        getRouteLogger().error('No purchase_intent_id in session', undefined, {
          extra: {
            sessionId: session.id,
          },
        });
        return NextResponse.json(
          { error: 'Missing purchase intent ID' },
          { status: 400 },
        );
      }

      // Fetch purchase intent
      const purchaseIntent = await getPurchaseIntentById(purchaseIntentId);

      if (!purchaseIntent) {
        getRouteLogger().error('Purchase intent not found', undefined, {
          extra: { purchaseIntentId },
        });
        return NextResponse.json(
          { error: 'Purchase intent not found' },
          { status: 404 },
        );
      }

      // If already provisioned, skip (idempotency)
      if (purchaseIntent.status === PurchaseIntentStatus.PROVISIONED) {
        getRouteLogger().info(`Purchase intent ${purchaseIntentId} already provisioned`);
        return NextResponse.json({ received: true, alreadyProvisioned: true });
      }

      // Mark as paid
      await updatePurchaseIntent(purchaseIntentId, {
        status: PurchaseIntentStatus.PAID,
        stripePaymentIntentId: session.payment_intent as string,
      });

      // Extract customer email
      const customerEmail = session.customer_email || purchaseIntent.email;

      // Validate email format
      if (!customerEmail || !isValidEmail(customerEmail)) {
        getRouteLogger().error('Invalid customer email', undefined, {
          extra: { email: customerEmail },
        });
        return NextResponse.json(
          { error: 'Invalid customer email' },
          { status: 400 },
        );
      }

      // Create or find auth user (idempotent - check if user already exists)
      let authUserId: string | undefined;

      try {
        // Check if user with this email already exists
        const existingUsersResult = await getUsersByEmail(customerEmail);

        if (existingUsersResult.users.length > 0) {
          authUserId = existingUsersResult.users[0].uid;
          getRouteLogger().info(`Auth user already exists: ${authUserId}`);
        } else {
          // Create new user with retry logic
          let retryCount = 0;
          const maxRetries = 3;

          while (retryCount < maxRetries) {
            try {
              const authUser = await createAuthUser({
                email: customerEmail,
                skipPasswordRequirement: true,
                skipPasswordChecks: true,
              });
              authUserId = authUser.uid;
              getRouteLogger().info(`Created auth user: ${authUserId}`);
              break;
            } catch (createError: any) {
              retryCount++;

              // Don't retry for permanent errors
              if (createError.code === 'INVALID_INPUT') {
                getRouteLogger().error(
                  'Auth user creation failed (permanent error)',
                  createError,
                  {
                    extra: {
                      email: customerEmail,
                      error: createError.message,
                    },
                  },
                );
                throw createError;
              }

              // Retry for transient errors
              if (retryCount < maxRetries) {
                getRouteLogger().warn(
                  `Auth user creation failed, retrying (${retryCount}/${maxRetries})`,
                  {
                    extra: {
                      error: createError.message,
                    },
                  },
                );
                await new Promise((resolve) =>
                  setTimeout(resolve, 1000 * retryCount),
                );
              } else {
                throw createError;
              }
            }
          }
        }

        // Ensure authUserId was assigned
        if (!authUserId) {
          throw new Error('Failed to create or retrieve auth user ID');
        }

        // Update purchase intent with auth user ID
        await updatePurchaseIntent(purchaseIntentId, {
          authUserId: authUserId,
        });

        // Insert into users table (idempotent)
        try {
          await createDbUser({
            authUserId: authUserId,
            email: customerEmail,
            passkeyEnrolled: false,
          });
        } catch (error: any) {
          // Ignore if user already exists (duplicate auth user ID)
          if (error.code !== 'UNIQUE_VIOLATION') {
            throw error;
          }
        }

        // Mark purchase intent as provisioned
        await updatePurchaseIntent(purchaseIntentId, {
          status: PurchaseIntentStatus.PROVISIONED,
        });

        getRouteLogger().info(`Successfully provisioned user for ${customerEmail}`);
      } catch (error: any) {
        getRouteLogger().error('Failed to provision auth user', error);
        // Don't mark as failed - retry can happen
        return NextResponse.json(
          { error: 'Failed to provision user' },
          { status: 500 },
        );
      }
    }

    // Handle customer.subscription.created event
    if (event.type === 'customer.subscription.created') {
      const subscription = event.data.object as any;

      getRouteLogger().info('Processing customer.subscription.created', {
        extra: { subscriptionId: subscription.id },
      });

      try {
        await handleSubscriptionChange(subscription, 'created');
      } catch (error: any) {
        getRouteLogger().error('Failed to handle subscription.created', error);
        // Don't return error - event was recorded, can be retried
      }
    }

    // Handle customer.subscription.updated event
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as any;

      getRouteLogger().info('Processing customer.subscription.updated', {
        extra: { subscriptionId: subscription.id },
      });

      try {
        await handleSubscriptionChange(subscription, 'updated');
      } catch (error: any) {
        getRouteLogger().error('Failed to handle subscription.updated', error);
        // Don't return error - event was recorded, can be retried
      }
    }

    // Handle customer.subscription.deleted event
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as any;

      getRouteLogger().info('Processing customer.subscription.deleted', {
        extra: { subscriptionId: subscription.id },
      });

      try {
        await handleSubscriptionCancellation(subscription);
      } catch (error: any) {
        getRouteLogger().error('Failed to handle subscription.deleted', error);
        // Don't return error - event was recorded, can be retried
      }
    }

    // Handle invoice.payment_succeeded event
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as any;

      getRouteLogger().info('Processing invoice.payment_succeeded', {
        extra: { invoiceId: invoice.id, subscriptionId: invoice.subscription },
      });

      if (invoice.subscription) {
        try {
          await handleInvoicePaymentSucceeded(invoice);
        } catch (error: any) {
          getRouteLogger().error('Failed to handle invoice.payment_succeeded', error);
          // Don't return error - event was recorded, can be retried
        }
      }
    }

    // Handle invoice.payment_failed event
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as any;

      getRouteLogger().info('Processing invoice.payment_failed', {
        extra: { invoiceId: invoice.id, subscriptionId: invoice.subscription },
      });

      if (invoice.subscription) {
        try {
          await handleInvoicePaymentFailed(invoice);
        } catch (error: any) {
          getRouteLogger().error('Failed to handle invoice.payment_failed', error);
          // Don't return error - event was recorded, can be retried
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    getRouteLogger().error('Webhook handler error', error);
    return NextResponse.json(
      { error: 'Webhook handler error' },
      { status: 500 },
    );
  }
}

/**
 * Map Stripe price ID to subscription tier
 */
function mapPriceToTier(priceId: string): SubscriptionTier {
  // Check environment variables for price IDs
  const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID;
  const yearlyPriceId = process.env.STRIPE_YEARLY_PRICE_ID;
  const lifetimePriceId = process.env.STRIPE_LIFETIME_PRICE_ID;

  if (priceId === monthlyPriceId) {
    return SubscriptionTier.MONTHLY;
  }
  if (priceId === yearlyPriceId) {
    return SubscriptionTier.YEARLY;
  }
  if (priceId === lifetimePriceId) {
    return SubscriptionTier.LIFETIME;
  }

  // Default to monthly if unknown
  getRouteLogger().warn('Unknown price ID, defaulting to monthly', {
    extra: { priceId },
  });
  return SubscriptionTier.MONTHLY;
}

/**
 * Map Stripe subscription status to domain status
 */
function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return SubscriptionStatus.ACTIVE;
    case 'past_due':
      return SubscriptionStatus.PAST_DUE;
    case 'canceled':
      return SubscriptionStatus.CANCELED;
    case 'trialing':
      return SubscriptionStatus.TRIALING;
    case 'incomplete':
      return SubscriptionStatus.INCOMPLETE;
    case 'unpaid':
      return SubscriptionStatus.UNPAID;
    default:
      getRouteLogger().warn('Unknown Stripe status, defaulting to active', {
        extra: { stripeStatus },
      });
      return SubscriptionStatus.ACTIVE;
  }
}

/**
 * Handle subscription creation or update
 */
async function handleSubscriptionChange(
  subscription: any,
  action: 'created' | 'updated',
): Promise<void> {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const priceId = subscription.items?.data[0]?.price?.id;
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

  if (!priceId) {
    getRouteLogger().error('No price ID in subscription', undefined, {
      extra: { subscriptionId },
    });
    return;
  }

  const tier = mapPriceToTier(priceId);
  const subscriptionStatus = mapStripeStatus(status);

  // Get customer email from subscription metadata or customer object
  const customerEmail = subscription.metadata?.email;

  if (!customerEmail) {
    getRouteLogger().error('No customer email in subscription metadata', undefined, {
      extra: { subscriptionId, customerId },
    });
    return;
  }

  try {
    // Find user by email
    const existingUsersResult = await getUsersByEmail(customerEmail);

    if (existingUsersResult.users.length === 0) {
      getRouteLogger().error('No auth user found for subscription', undefined, {
        extra: { email: customerEmail, subscriptionId },
      });
      return;
    }

    const authUserId = existingUsersResult.users[0].uid;

    // Check if user exists in database
    const dbUser = await getUserByAuthId(authUserId);

    if (!dbUser) {
      // Create user with subscription entitlements
      await createDbUser({
        authUserId,
        email: customerEmail,
        passkeyEnrolled: false,
        subscriptionTier: tier,
        subscriptionStatus,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        currentPeriodEnd,
      });

      getRouteLogger().info(`Created user with ${tier} subscription`, {
        extra: { authUserId, subscriptionId },
      });
    } else {
      // Update user with subscription entitlements
      await updateUserByAuthId(authUserId, {
        subscriptionTier: tier,
        subscriptionStatus,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        currentPeriodEnd,
      });

      getRouteLogger().info(`Updated user subscription to ${tier}`, {
        extra: { authUserId, subscriptionId, action },
      });
    }
  } catch (error: any) {
    getRouteLogger().error('Failed to handle subscription change', error, {
      extra: { subscriptionId, action },
    });
    // Don't throw - let webhook succeed even if handler fails (idempotency handles retries)
  }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancellation(subscription: any): Promise<void> {
  const subscriptionId = subscription.id;
  const customerEmail = subscription.metadata?.email;

  if (!customerEmail) {
    getRouteLogger().error('No customer email in subscription metadata', undefined, {
      extra: { subscriptionId },
    });
    return;
  }

  try {
    // Find user by email
    const existingUsersResult = await getUsersByEmail(customerEmail);

    if (existingUsersResult.users.length === 0) {
      getRouteLogger().warn('No auth user found for cancelled subscription', {
        extra: { email: customerEmail, subscriptionId },
      });
      return;
    }

    const authUserId = existingUsersResult.users[0].uid;

    // Update user to free tier with canceled status
    await updateUserByAuthId(authUserId, {
      subscriptionTier: SubscriptionTier.FREE,
      subscriptionStatus: SubscriptionStatus.CANCELED,
      stripeSubscriptionId: null, // Clear subscription ID
      currentPeriodEnd: null,
    });

    getRouteLogger().info('Downgraded user to free tier after cancellation', {
      extra: { authUserId, subscriptionId },
    });
  } catch (error: any) {
    getRouteLogger().error('Failed to handle subscription cancellation', error, {
      extra: { subscriptionId },
    });
    // Don't throw - let webhook succeed even if handler fails (idempotency handles retries)
  }
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
  const subscriptionId = invoice.subscription;
  const customerEmail = invoice.customer_email;

  if (!customerEmail) {
    getRouteLogger().error('No customer email in invoice', undefined, {
      extra: { invoiceId: invoice.id },
    });
    return;
  }

  try {
    // Find user by email
    const existingUsersResult = await getUsersByEmail(customerEmail);

    if (existingUsersResult.users.length === 0) {
      getRouteLogger().warn('No auth user found for invoice payment', {
        extra: { email: customerEmail, subscriptionId },
      });
      return;
    }

    const authUserId = existingUsersResult.users[0].uid;
    const dbUser = await getUserByAuthId(authUserId);

    if (!dbUser) {
      getRouteLogger().warn('No database user found for invoice payment', {
        extra: { authUserId, subscriptionId },
      });
      return;
    }

    // If user was past_due or unpaid, reactivate them
    if (
      dbUser.subscriptionStatus === SubscriptionStatus.PAST_DUE ||
      dbUser.subscriptionStatus === SubscriptionStatus.UNPAID
    ) {
      await updateUserByAuthId(authUserId, {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      });

      getRouteLogger().info('Reactivated user subscription after payment', {
        extra: { authUserId, subscriptionId },
      });
    }
  } catch (error: any) {
    getRouteLogger().error('Failed to handle invoice payment succeeded', error, {
      extra: { invoiceId: invoice.id, subscriptionId },
    });
    // Don't throw - let webhook succeed even if handler fails (idempotency handles retries)
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: any): Promise<void> {
  const subscriptionId = invoice.subscription;
  const customerEmail = invoice.customer_email;

  if (!customerEmail) {
    getRouteLogger().error('No customer email in invoice', undefined, {
      extra: { invoiceId: invoice.id },
    });
    return;
  }

  try {
    // Find user by email
    const existingUsersResult = await getUsersByEmail(customerEmail);

    if (existingUsersResult.users.length === 0) {
      getRouteLogger().warn('No auth user found for failed invoice', {
        extra: { email: customerEmail, subscriptionId },
      });
      return;
    }

    const authUserId = existingUsersResult.users[0].uid;

    // Mark user as past_due (Stripe will retry payment)
    await updateUserByAuthId(authUserId, {
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
    });

    getRouteLogger().info('Marked user subscription as past_due after payment failure', {
      extra: { authUserId, subscriptionId },
    });
  } catch (error: any) {
    getRouteLogger().error('Failed to handle invoice payment failed', error, {
      extra: { invoiceId: invoice.id, subscriptionId },
    });
    // Don't throw - let webhook succeed even if handler fails (idempotency handles retries)
  }
}
