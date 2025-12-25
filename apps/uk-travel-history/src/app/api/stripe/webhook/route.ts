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
  createUser,
  PurchaseIntentStatus,
} from '@uth/db';
import Stripe from 'stripe';
import { logger } from '@uth/utils';
import { clerkClient } from '@clerk/nextjs/server';

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover',
  });
}

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
      logger.error('Missing stripe-signature header', undefined);
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured', undefined);
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 },
      );
    }

    // Verify webhook signature
    const stripe = getStripeClient();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
    } catch (err: any) {
      logger.error('Webhook signature verification failed', undefined, {
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
      logger.info(`Event ${event.id} already processed, skipping`);
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
      const session = event.data.object as Stripe.Checkout.Session;

      logger.info('Processing checkout.session.completed', {
        extra: { sessionId: session.id },
      });

      // Get purchase intent via client_reference_id or metadata
      const purchaseIntentId =
        session.client_reference_id || session.metadata?.purchase_intent_id;

      if (!purchaseIntentId) {
        logger.error('No purchase_intent_id in session', undefined, {
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
        logger.error('Purchase intent not found', undefined, {
          extra: { purchaseIntentId },
        });
        return NextResponse.json(
          { error: 'Purchase intent not found' },
          { status: 404 },
        );
      }

      // If already provisioned, skip (idempotency)
      if (purchaseIntent.status === PurchaseIntentStatus.PROVISIONED) {
        logger.info(`Purchase intent ${purchaseIntentId} already provisioned`);
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
        logger.error('Invalid customer email', undefined, {
          extra: { email: customerEmail },
        });
        return NextResponse.json(
          { error: 'Invalid customer email' },
          { status: 400 },
        );
      }

      // Create Clerk user (idempotent - check if user already exists)
      let clerkUserId: string | undefined;

      try {
        const client = await clerkClient();

        // Check if user with this email already exists
        const existingUsers = await client.users.getUserList({
          emailAddress: [customerEmail],
        });

        if (existingUsers.data.length > 0) {
          clerkUserId = existingUsers.data[0].id;
          logger.info(`Clerk user already exists: ${clerkUserId}`);
        } else {
          // Create new Clerk user with retry logic
          let retryCount = 0;
          const maxRetries = 3;

          while (retryCount < maxRetries) {
            try {
              const clerkUser = await client.users.createUser({
                emailAddress: [customerEmail],
                skipPasswordRequirement: true,
                skipPasswordChecks: true,
              });
              clerkUserId = clerkUser.id;
              logger.info(`Created Clerk user: ${clerkUserId}`);
              break;
            } catch (createError: any) {
              retryCount++;

              // Don't retry for permanent errors
              if (createError.status === 400 || createError.status === 422) {
                logger.error(
                  'Clerk user creation failed (permanent error)',
                  createError,
                  {
                    extra: {
                      email: customerEmail,
                      error: createError.message,
                      clerkErrors: createError.errors,
                    },
                  },
                );
                throw createError;
              }

              // Retry for transient errors
              if (retryCount < maxRetries) {
                logger.warn(
                  `Clerk user creation failed, retrying (${retryCount}/${maxRetries})`,
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

        // Ensure clerkUserId was assigned
        if (!clerkUserId) {
          throw new Error('Failed to create or retrieve Clerk user ID');
        }

        // Update purchase intent with Clerk user ID
        await updatePurchaseIntent(purchaseIntentId, {
          authUserId: clerkUserId,
        });

        // Insert into users table (idempotent)
        try {
          await createUser({
            authUserId: clerkUserId,
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

        logger.info(`Successfully provisioned user for ${customerEmail}`);
      } catch (error: any) {
        logger.error('Failed to provision Clerk user', error);
        // Don't mark as failed - retry can happen
        return NextResponse.json(
          { error: 'Failed to provision user' },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Webhook handler error', error);
    return NextResponse.json(
      { error: 'Webhook handler error' },
      { status: 500 },
    );
  }
}
