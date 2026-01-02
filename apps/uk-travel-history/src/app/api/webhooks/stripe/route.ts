/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events for subscription lifecycle management
 *
 * SUBSCRIPTION LIFECYCLE DOCUMENTATION
 * ====================================
 *
 * SOURCE OF TRUTH: Stripe webhooks are the SINGLE source of truth for subscription state
 *
 * WEBHOOK EVENT COVERAGE
 * ----------------------
 * ✅ checkout.session.completed - Authenticated checkouts only
 * ✅ customer.subscription.created - New subscription provisioning
 * ✅ customer.subscription.updated - Tier changes, status changes, pauses, scheduled cancellations
 * ✅ customer.subscription.deleted - Final cancellation/expiration
 * ✅ invoice.payment_succeeded - Recovery from past_due/unpaid
 * ✅ invoice.payment_failed - Mark subscription as past_due
 *
 * SUBSCRIPTION STATE MAPPING (Provider → Domain)
 * -----------------------------------------------
 * | Provider Condition            | Domain Status | Access |
 * |-------------------------------|---------------|--------|
 * | status=active                 | active        | ✅     |
 * | cancel_at_period_end=true     | active        | ✅     |
 * | pause_collection != null      | paused        | ❌     |
 * | status=past_due               | past_due      | ❌     |
 * | status=canceled               | canceled      | ❌     |
 * | status=trialing               | trialing      | ✅     |
 * | status=incomplete             | incomplete    | ❌     |
 * | status=unpaid                 | unpaid        | ❌     |
 *
 * IDEMPOTENCY: Events tracked by event ID, duplicates skipped
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  hasWebhookEventBeenProcessed,
  recordWebhookEvent,
  createUser as createDbUser,
  updateUserByAuthId,
  getUserByAuthId,
  SubscriptionTier,
  SubscriptionStatus,
} from '@uth/db';
import {
  constructWebhookEvent,
  retrieveSubscription,
  ProviderSubscriptionStatus,
  type ParsedWebhookEvent,
  type SubscriptionDetails,
  type PauseCollectionInfo,
} from '@uth/payments-server';
import { getUsersByEmail } from '@uth/auth-server';
import { getRouteLogger } from '@uth/flow';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ============================================================================
// Status Mapping (Provider → Domain)
// ============================================================================

/**
 * Map provider subscription status to domain status
 * Handles pause_collection as a modifier on top of status
 */
function mapProviderStatusToDomain(
  status: ProviderSubscriptionStatus,
  pauseCollection: PauseCollectionInfo | null,
): SubscriptionStatus {
  // Paused takes precedence - it's an overlay on active status
  if (pauseCollection?.behavior) {
    return SubscriptionStatus.PAUSED;
  }

  switch (status) {
    case ProviderSubscriptionStatus.ACTIVE:
      return SubscriptionStatus.ACTIVE;
    case ProviderSubscriptionStatus.PAST_DUE:
      return SubscriptionStatus.PAST_DUE;
    case ProviderSubscriptionStatus.CANCELED:
      return SubscriptionStatus.CANCELED;
    case ProviderSubscriptionStatus.TRIALING:
      return SubscriptionStatus.TRIALING;
    case ProviderSubscriptionStatus.INCOMPLETE:
      return SubscriptionStatus.INCOMPLETE;
    case ProviderSubscriptionStatus.INCOMPLETE_EXPIRED:
      return SubscriptionStatus.CANCELED;
    case ProviderSubscriptionStatus.UNPAID:
      return SubscriptionStatus.UNPAID;
    case ProviderSubscriptionStatus.PAUSED:
      return SubscriptionStatus.PAUSED;
  }
}

/**
 * Map Stripe price ID to subscription tier
 */
function mapPriceIdToTier(priceId: string | undefined): SubscriptionTier {
  if (!priceId) {
    getRouteLogger().warn('No price ID provided, defaulting to monthly');
    return SubscriptionTier.MONTHLY;
  }

  const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID;
  const yearlyPriceId = process.env.STRIPE_YEARLY_PRICE_ID;
  const lifetimePriceId = process.env.STRIPE_LIFETIME_PRICE_ID;

  if (priceId === monthlyPriceId) return SubscriptionTier.MONTHLY;
  if (priceId === yearlyPriceId) return SubscriptionTier.YEARLY;
  if (priceId === lifetimePriceId) return SubscriptionTier.LIFETIME;

  getRouteLogger().warn('Unknown price ID, defaulting to monthly', {
    extra: { priceId },
  });
  return SubscriptionTier.MONTHLY;
}

// ============================================================================
// Main Webhook Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
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

    // Verify signature and parse event to domain type
    let event: ParsedWebhookEvent;
    try {
      event = constructWebhookEvent(body, signature, WEBHOOK_SECRET);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      getRouteLogger().error('Webhook signature verification failed', undefined, {
        extra: { message },
      });
      return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
    }

    // Idempotency check
    const alreadyProcessed = await hasWebhookEventBeenProcessed(event.id);
    if (alreadyProcessed) {
      getRouteLogger().info(`Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, skipped: true });
    }

    // Record event for idempotency
    await recordWebhookEvent({
      stripeEventId: event.id,
      type: event.type,
      payload: event.data as Record<string, unknown>,
    });

    // Handle events with discriminated union pattern for full type safety
    switch (event.type) {
      // ========================================================================
      // Checkout Events
      // ========================================================================
      case 'checkout.session.completed': {
        const session = event.data;
        const userId = session.userId;

        getRouteLogger().info('Processing checkout.session.completed', {
          extra: {
            sessionId: session.id,
            userId,
            mode: session.mode,
            paymentStatus: session.paymentStatus,
          },
        });

        // For subscription mode, the subscription.created event handles provisioning
        // For one-time payments, handle here if needed
        return NextResponse.json({ received: true, authenticated: !!userId });
      }

      // ========================================================================
      // Subscription Events
      // ========================================================================
      case 'customer.subscription.created': {
        const subscription = event.data;
        getRouteLogger().info('Processing customer.subscription.created', {
          extra: {
            subscriptionId: subscription.id,
            status: subscription.status,
          },
        });

        await handleSubscriptionCreatedOrUpdated(subscription, 'created');
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data;
        getRouteLogger().info('Processing customer.subscription.updated', {
          extra: {
            subscriptionId: subscription.id,
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            pauseCollection: !!subscription.pauseCollection,
          },
        });

        await handleSubscriptionCreatedOrUpdated(subscription, 'updated');
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data;
        getRouteLogger().info('Processing customer.subscription.deleted', {
          extra: {
            subscriptionId: subscription.id,
          },
        });

        await handleSubscriptionDeleted(subscription);
        break;
      }

      // ========================================================================
      // Invoice Events
      // ========================================================================
      case 'invoice.payment_succeeded': {
        const invoice = event.data;
        const subscriptionId = invoice.subscriptionId;

        getRouteLogger().info('Processing invoice.payment_succeeded', {
          extra: {
            invoiceId: invoice.id,
            subscriptionId,
            billingReason: invoice.billingReason,
          },
        });

        if (subscriptionId) {
          await handleInvoicePaymentSucceeded(invoice.customerEmail, subscriptionId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data;
        const subscriptionId = invoice.subscriptionId;

        getRouteLogger().info('Processing invoice.payment_failed', {
          extra: {
            invoiceId: invoice.id,
            subscriptionId,
            attemptCount: invoice.attemptCount,
          },
        });

        if (subscriptionId) {
          await handleInvoicePaymentFailed(invoice.customerEmail, subscriptionId, invoice.id, invoice.attemptCount);
        }
        break;
      }

      // ========================================================================
      // Unhandled Events
      // ========================================================================
      default: {
        // Log for monitoring - helps identify events we might want to handle
        getRouteLogger().debug('Received unhandled webhook event', {
          extra: {
            eventType: event._type,
            eventId: event.id,
            data: event.data
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    getRouteLogger().error(
      'Webhook handler error',
      error instanceof Error ? error : undefined,
    );
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
  }
}

// ============================================================================
// Subscription Handlers
// ============================================================================

/**
 * Handle subscription created or updated events
 *
 * Both events have the same shape and similar handling logic:
 * - Extract user identity from metadata
 * - Map provider status to domain status
 * - Update or create user record
 */
async function handleSubscriptionCreatedOrUpdated(
  subscription: SubscriptionDetails,
  action: 'created' | 'updated',
): Promise<void> {
  const subscriptionId = subscription.id;
  const customerId = subscription.customerId;
  const priceId = subscription.priceId;

  // Validate required data
  if (!priceId) {
    getRouteLogger().error('No price ID in subscription', undefined, {
      extra: { subscriptionId },
    });
    return;
  }

  // Map to domain types
  const tier = mapPriceIdToTier(priceId);
  const domainStatus = mapProviderStatusToDomain(
    subscription.status,
    subscription.pauseCollection,
  );

  // Extract dates
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd * 1000)
    : null;
  const cancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
  const pauseResumesAt = subscription.pauseCollection?.resumesAt
    ? new Date(subscription.pauseCollection.resumesAt * 1000)
    : null;

  // Get user identity from metadata
  let authUserId = subscription.metadata.userId;
  const customerEmail = subscription.metadata.email;

  if (!authUserId && !customerEmail) {
    getRouteLogger().error('No userId or email in subscription metadata', undefined, {
      extra: { subscriptionId, customerId },
    });
    return;
  }

  try {
    // Resolve user ID from email if not in metadata
    if (!authUserId && customerEmail) {
      const result = await getUsersByEmail(customerEmail);
      if (result.users.length === 0) {
        getRouteLogger().error('No auth user found for subscription', undefined, {
          extra: { email: customerEmail, subscriptionId },
        });
        return;
      }
      authUserId = result.users[0].uid;
    }

    if (!authUserId) {
      getRouteLogger().error('Could not resolve auth user ID', undefined, {
        extra: { subscriptionId, customerEmail },
      });
      return;
    }

    // Check if user exists in database
    const existingUser = await getUserByAuthId(authUserId);

    if (!existingUser) {
      // User should exist (created by Clerk webhook), but handle race condition
      if (!customerEmail) {
        getRouteLogger().error('User not found and no email to create', undefined, {
          extra: { authUserId, subscriptionId },
        });
        return;
      }

      await createDbUser({
        authUserId,
        email: customerEmail,
        passkeyEnrolled: false,
        subscriptionTier: tier,
        subscriptionStatus: domainStatus,
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd,
        pauseResumesAt,
      });

      getRouteLogger().info(`Created user with ${tier} subscription`, {
        extra: { authUserId, subscriptionId, action },
      });
    } else {
      // Update existing user
      await updateUserByAuthId(authUserId, {
        subscriptionTier: tier,
        subscriptionStatus: domainStatus,
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd,
        pauseResumesAt,
      });

      getRouteLogger().info(`Updated user subscription to ${tier}`, {
        extra: {
          authUserId,
          subscriptionId,
          action,
          status: domainStatus,
          cancelAtPeriodEnd,
          paused: !!pauseResumesAt,
        },
      });
    }
  } catch (error) {
    getRouteLogger().error(
      'Failed to handle subscription change',
      error instanceof Error ? error : undefined,
      { extra: { subscriptionId, action } },
    );
    // Don't throw - webhook should succeed for idempotency retry handling
  }
}

/**
 * Handle subscription deleted event
 *
 * When a subscription is deleted (cancelled, expired, or terminated):
 * - Downgrade user to free tier
 * - Clear subscription-related fields
 * - Preserve currentPeriodEnd for grace period access logic
 */
async function handleSubscriptionDeleted(
  subscription: SubscriptionDetails,
): Promise<void> {
  const subscriptionId = subscription.id;
  const currentPeriodEnd = subscription.currentPeriodEnd;

  // Get user identity
  let authUserId = subscription.metadata.userId;
  const customerEmail = subscription.metadata.email;

  if (!authUserId && !customerEmail) {
    getRouteLogger().error('No userId or email in subscription metadata', undefined, {
      extra: { subscriptionId },
    });
    return;
  }

  try {
    // Resolve user ID from email if needed
    if (!authUserId && customerEmail) {
      const result = await getUsersByEmail(customerEmail);
      if (result.users.length === 0) {
        getRouteLogger().warn('No auth user found for deleted subscription', {
          extra: { email: customerEmail, subscriptionId },
        });
        return;
      }
      authUserId = result.users[0].uid;
    }

    if (!authUserId) {
      getRouteLogger().error('Could not resolve auth user ID', undefined, {
        extra: { subscriptionId, customerEmail },
      });
      return;
    }

    // Downgrade to free tier
    await updateUserByAuthId(authUserId, {
      subscriptionTier: SubscriptionTier.FREE,
      subscriptionStatus: null, // Free tier has NULL status (DB constraint)
      stripeSubscriptionId: null, // Clear subscription reference
      // Preserve period end for grace period access decisions
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      cancelAtPeriodEnd: false,
      pauseResumesAt: null,
    });

    getRouteLogger().info('Downgraded user to free tier', {
      extra: { authUserId, subscriptionId },
    });
  } catch (error) {
    getRouteLogger().error(
      'Failed to handle subscription deletion',
      error instanceof Error ? error : undefined,
      { extra: { subscriptionId } },
    );
  }
}

// ============================================================================
// Invoice Handlers
// ============================================================================

/**
 * Handle successful invoice payment
 *
 * This is important for:
 * - Recovering from past_due status after successful retry
 * - Handling 3D Secure completions where subscription.updated may arrive out of order
 * - Ensuring status is synced after any successful payment
 *
 * We fetch the current subscription state to ensure accuracy.
 */
async function handleInvoicePaymentSucceeded(
  customerEmail: string | null,
  subscriptionId: string,
): Promise<void> {
  if (!customerEmail) {
    getRouteLogger().error('No customer email in invoice', undefined, {
      extra: { subscriptionId },
    });
    return;
  }

  try {
    // Fetch current subscription state - more reliable than event data
    // This handles race conditions and out-of-order event delivery
    const subscription = await retrieveSubscription(subscriptionId);

    // Use the same handler as subscription.updated for consistency
    await handleSubscriptionCreatedOrUpdated(subscription, 'updated');

    getRouteLogger().info('Synced subscription after successful payment', {
      extra: {
        subscriptionId,
        status: subscription.status,
      },
    });
  } catch (error) {
    getRouteLogger().error(
      'Failed to handle invoice payment success',
      error instanceof Error ? error : undefined,
      { extra: { subscriptionId } },
    );
  }
}

/**
 * Handle failed invoice payment
 *
 * Mark the user's subscription as past_due so the UI can:
 * - Show payment failure messaging
 * - Prompt for payment method update
 * - Potentially restrict access based on business rules
 *
 * The payment provider will retry the payment according to retry settings.
 */
async function handleInvoicePaymentFailed(
  customerEmail: string | null,
  subscriptionId: string,
  invoiceId: string,
  attemptCount: number,
): Promise<void> {
  if (!customerEmail) {
    getRouteLogger().error('No customer email in invoice', undefined, {
      extra: { invoiceId },
    });
    return;
  }

  try {
    // Find user by email
    const result = await getUsersByEmail(customerEmail);

    if (result.users.length === 0) {
      getRouteLogger().warn('No auth user found for failed invoice', {
        extra: { email: customerEmail, subscriptionId },
      });
      return;
    }

    const authUserId = result.users[0].uid;

    // Mark as past_due - payment provider will handle retries
    await updateUserByAuthId(authUserId, {
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
    });

    getRouteLogger().info('Marked subscription as past_due', {
      extra: {
        authUserId,
        subscriptionId,
        invoiceId,
        attemptCount,
      },
    });
  } catch (error) {
    getRouteLogger().error(
      'Failed to handle invoice payment failure',
      error instanceof Error ? error : undefined,
      { extra: { invoiceId, subscriptionId } },
    );
  }
}