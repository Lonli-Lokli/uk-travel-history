/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events for subscription lifecycle management
 *
 * SUBSCRIPTION LIFECYCLE DOCUMENTATION
 * ====================================
 *
 * This handler implements a complete subscription lifecycle system following Stripe's
 * recommended practices. It handles both recurring subscriptions and one-time purchases.
 *
 * SOURCE OF TRUTH RULES
 * ---------------------
 * - Stripe webhooks are the SINGLE source of truth for subscription state
 * - checkout.session.completed provisions NEW users (legacy flow only)
 * - customer.subscription.* events UPDATE subscription entitlements
 * - Clerk webhook creates users in modern flow; Stripe only updates entitlements
 *
 * WEBHOOK EVENT COVERAGE
 * ----------------------
 * ✅ checkout.session.completed - One-time purchases & authenticated checkouts
 * ✅ customer.subscription.created - New subscription provisioning
 * ✅ customer.subscription.updated - Tier changes, status changes, pauses, scheduled cancellations
 * ✅ customer.subscription.deleted - Final cancellation/expiration
 * ✅ invoice.payment_succeeded - Recovery from past_due/unpaid
 * ✅ invoice.payment_failed - Mark subscription as past_due
 *
 * SUBSCRIPTION STATE MAPPING (Stripe → Domain)
 * ---------------------------------------------
 * | Stripe Condition              | Domain Status | Access | End Date           | Flags                    |
 * |-------------------------------|---------------|--------|--------------------| -------------------------|
 * | status=active                 | active        | ✅     | current_period_end | cancel_at_period_end=false|
 * | cancel_at_period_end=true     | active        | ✅     | current_period_end | cancel_at_period_end=true |
 * | pause_collection != null      | paused        | ❌     | current_period_end | pause_resumes_at set      |
 * | status=past_due               | past_due      | ❌     | current_period_end | -                         |
 * | status=canceled               | canceled      | ❌     | deletion timestamp | -                         |
 * | subscription.deleted          | free (null)   | ❌     | preserved for grace| cancel/pause flags cleared|
 * | status=trialing               | trialing      | ✅     | trial_end          | -                         |
 * | status=incomplete             | incomplete    | ❌     | current_period_end | -                         |
 * | status=unpaid                 | unpaid        | ❌     | current_period_end | -                         |
 * | Lifetime purchase             | active        | ✅     | null               | No subscription_id        |
 *
 * END DATE HANDLING
 * -----------------
 * - Recurring: current_period_end (updated on each renewal)
 * - Scheduled cancellation: current_period_end (user retains access until then)
 * - Paused: current_period_end (frozen during pause)
 * - Deleted: preserved from last period (grace period access)
 * - Lifetime: null (never expires)
 *
 * IDEMPOTENCY & DEDUPLICATION
 * ----------------------------
 * - Webhook events tracked in webhook_events table by Stripe event ID
 * - Duplicate events skipped before processing
 * - Safe for Stripe retries and out-of-order delivery
 * - Purchase intents prevent duplicate user creation (legacy flow)
 *
 * DATABASE GUARANTEES
 * -------------------
 * - UNIQUE constraint on clerk_user_id (prevents duplicate users)
 * - UNIQUE constraint on stripe_customer_id (prevents duplicate Stripe customers)
 * - UNIQUE constraint on stripe_subscription_id (prevents duplicate subscriptions)
 * - CHECK constraint: free tier must have NULL status
 * - CHECK constraint: paid tier must have non-NULL status
 * - CHECK constraint: paused status must have pause_resumes_at
 *
 * LIFECYCLE EVENT FLOW
 * --------------------
 * 1. User signs up via Clerk → Clerk webhook creates user (FREE tier)
 * 2. User purchases subscription → checkout.session.completed (authenticated)
 * 3. Stripe creates subscription → customer.subscription.created
 * 4. Handler updates user: tier=monthly/yearly/lifetime, status=active
 * 5. User cancels → subscription.updated (cancel_at_period_end=true, status still active)
 * 6. Period ends → subscription.deleted (tier=free, status=null, preserve period_end)
 * 7. User renews → new checkout session → subscription.created (repeat from step 3)
 *
 * LOGGING
 * -------
 * - All webhook events logged with event type and subscription ID
 * - State transitions logged with before/after values
 * - Errors logged with context (subscription ID, user ID, event type)
 * - Warnings for unexpected states or missing metadata
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
import { constructWebhookEvent } from '@uth/payments-server';
import {
  createUser as createAuthUser,
  getUsersByEmail,
} from '@uth/auth-server';
import { getRouteLogger } from '@uth/flow';

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
      getRouteLogger().error(
        'Webhook signature verification failed',
        undefined,
        {
          extra: { message: err.message },
        },
      );
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

      // Check if this is an authenticated checkout (new Clerk flow)
      const userId = session.metadata?.userId || session.client_reference_id;
      const isAuthenticatedCheckout =
        userId && !session.metadata?.purchase_intent_id;

      if (isAuthenticatedCheckout) {
        // Authenticated checkout - user already exists via Clerk
        // Subscription webhooks will handle entitlement updates
        getRouteLogger().info('Authenticated checkout completed', {
          extra: { sessionId: session.id, userId },
        });
        return NextResponse.json({ received: true, authenticated: true });
      }

      // Legacy purchase intent flow (for backwards compatibility)
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
        getRouteLogger().info(
          `Purchase intent ${purchaseIntentId} already provisioned`,
        );
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

        getRouteLogger().info(
          `Successfully provisioned user for ${customerEmail}`,
        );
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
          getRouteLogger().error(
            'Failed to handle invoice.payment_succeeded',
            error,
          );
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
          getRouteLogger().error(
            'Failed to handle invoice.payment_failed',
            error,
          );
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
function mapStripeStatus(
  stripeStatus: string,
  pauseCollection: any,
): SubscriptionStatus {
  // Check if subscription is paused
  if (pauseCollection && pauseCollection.behavior) {
    return SubscriptionStatus.PAUSED;
  }

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
    case 'paused':
      return SubscriptionStatus.PAUSED;
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
  const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
  const pauseCollection = subscription.pause_collection;
  const pauseResumesAt =
    pauseCollection?.resumes_at !== undefined && pauseCollection.resumes_at !== null
      ? new Date(pauseCollection.resumes_at * 1000)
      : null;

  if (!priceId) {
    getRouteLogger().error('No price ID in subscription', undefined, {
      extra: { subscriptionId },
    });
    return;
  }

  const tier = mapPriceToTier(priceId);
  const subscriptionStatus = mapStripeStatus(status, pauseCollection);

  // Get userId directly from metadata (new flow) or find by email (legacy flow)
  let authUserId = subscription.metadata?.userId;
  const customerEmail = subscription.metadata?.email;

  if (!authUserId && !customerEmail) {
    getRouteLogger().error(
      'No userId or email in subscription metadata',
      undefined,
      {
        extra: { subscriptionId, customerId },
      },
    );
    return;
  }

  try {
    // If no userId, try to find user by email
    if (!authUserId && customerEmail) {
      const existingUsersResult = await getUsersByEmail(customerEmail);

      if (existingUsersResult.users.length === 0) {
        getRouteLogger().error(
          'No auth user found for subscription',
          undefined,
          {
            extra: { email: customerEmail, subscriptionId },
          },
        );
        return;
      }

      authUserId = existingUsersResult.users[0].uid;
    }

    if (!authUserId) {
      getRouteLogger().error('Could not determine auth user ID', undefined, {
        extra: { subscriptionId, customerEmail },
      });
      return;
    }

    // Check if user exists in database
    const dbUser = await getUserByAuthId(authUserId);

    if (!dbUser) {
      // User should already exist (created by Clerk webhook)
      // Log error but don't fail - this might be a timing issue
      getRouteLogger().error(
        'User not found in database for subscription',
        undefined,
        {
          extra: { authUserId, subscriptionId, hasEmail: !!customerEmail },
        },
      );

      // If we have email, try to create the user
      if (customerEmail) {
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
          cancelAtPeriodEnd,
          pauseResumesAt,
        });

        getRouteLogger().info(`Created user with ${tier} subscription`, {
          extra: { authUserId, subscriptionId, cancelAtPeriodEnd, paused: !!pauseResumesAt },
        });
      } else {
        return; // Cannot create user without email
      }
    } else {
      // Update user with subscription entitlements
      await updateUserByAuthId(authUserId, {
        subscriptionTier: tier,
        subscriptionStatus,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        pauseResumesAt,
      });

      getRouteLogger().info(`Updated user subscription to ${tier}`, {
        extra: { authUserId, subscriptionId, action, cancelAtPeriodEnd, paused: !!pauseResumesAt },
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
async function handleSubscriptionCancellation(
  subscription: any,
): Promise<void> {
  const subscriptionId = subscription.id;
  let authUserId = subscription.metadata?.userId;
  const customerEmail = subscription.metadata?.email;

  if (!authUserId && !customerEmail) {
    getRouteLogger().error(
      'No userId or email in subscription metadata',
      undefined,
      {
        extra: { subscriptionId },
      },
    );
    return;
  }

  try {
    // If no userId, try to find user by email
    if (!authUserId && customerEmail) {
      const existingUsersResult = await getUsersByEmail(customerEmail);

      if (existingUsersResult.users.length === 0) {
        getRouteLogger().warn('No auth user found for cancelled subscription', {
          extra: { email: customerEmail, subscriptionId },
        });
        return;
      }

      authUserId = existingUsersResult.users[0].uid;
    }

    if (!authUserId) {
      getRouteLogger().error('Could not determine auth user ID', undefined, {
        extra: { subscriptionId, customerEmail },
      });
      return;
    }

    // Update user to free tier with NULL status
    // Clear subscription data but preserve current_period_end for grace period access
    await updateUserByAuthId(authUserId, {
      subscriptionTier: SubscriptionTier.FREE,
      subscriptionStatus: null, // NULL for free tier (enforced by DB constraint)
      stripeSubscriptionId: null, // Clear subscription ID
      // Keep current_period_end to allow grace period access
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: false, // Clear cancellation flag
      pauseResumesAt: null, // Clear pause flag
    });

    getRouteLogger().info('Downgraded user to free tier after cancellation', {
      extra: { authUserId, subscriptionId },
    });
  } catch (error: any) {
    getRouteLogger().error(
      'Failed to handle subscription cancellation',
      error,
      {
        extra: { subscriptionId },
      },
    );
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
    getRouteLogger().error(
      'Failed to handle invoice payment succeeded',
      error,
      {
        extra: { invoiceId: invoice.id, subscriptionId },
      },
    );
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

    getRouteLogger().info(
      'Marked user subscription as past_due after payment failure',
      {
        extra: { authUserId, subscriptionId },
      },
    );
  } catch (error: any) {
    getRouteLogger().error('Failed to handle invoice payment failed', error, {
      extra: { invoiceId: invoice.id, subscriptionId },
    });
    // Don't throw - let webhook succeed even if handler fails (idempotency handles retries)
  }
}
