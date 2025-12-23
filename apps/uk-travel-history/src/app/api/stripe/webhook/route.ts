/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events
 * Provisions users after successful one-time payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@uth/utils';
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
      logger.error('Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 },
      );
    }

    const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured');
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
      logger.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    // Check if event already processed (idempotency)
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single();

    if (existingEvent) {
      logger.log(`Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, skipped: true });
    }

    // Record webhook event
    await supabase.from('webhook_events').insert({
      stripe_event_id: event.id,
      type: event.type,
      payload: event.data.object as any,
    });

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      logger.log('Processing checkout.session.completed', { sessionId: session.id });

      // Get purchase intent via client_reference_id or metadata
      const purchaseIntentId =
        session.client_reference_id || session.metadata?.purchase_intent_id;

      if (!purchaseIntentId) {
        logger.error('No purchase_intent_id in session', {
          sessionId: session.id,
        });
        return NextResponse.json(
          { error: 'Missing purchase intent ID' },
          { status: 400 },
        );
      }

      // Fetch purchase intent
      const { data: purchaseIntent, error: fetchError } = await supabase
        .from('purchase_intents')
        .select('*')
        .eq('id', purchaseIntentId)
        .single();

      if (fetchError || !purchaseIntent) {
        logger.error('Purchase intent not found:', purchaseIntentId);
        return NextResponse.json(
          { error: 'Purchase intent not found' },
          { status: 404 },
        );
      }

      // If already provisioned, skip (idempotency)
      if (purchaseIntent.status === 'provisioned') {
        logger.log(`Purchase intent ${purchaseIntentId} already provisioned`);
        return NextResponse.json({ received: true, alreadyProvisioned: true });
      }

      // Mark as paid
      await supabase
        .from('purchase_intents')
        .update({
          status: 'paid',
          stripe_payment_intent_id: session.payment_intent as string,
        })
        .eq('id', purchaseIntentId);

      // Extract customer email
      const customerEmail = session.customer_email || purchaseIntent.email;

      // Validate email format
      if (!customerEmail || !isValidEmail(customerEmail)) {
        logger.error('Invalid customer email', { email: customerEmail });
        return NextResponse.json(
          { error: 'Invalid customer email' },
          { status: 400 },
        );
      }

      // Create Clerk user (idempotent - check if user already exists)
      let clerkUserId: string;

      try {
        const client = await clerkClient();

        // Check if user with this email already exists
        const existingUsers = await client.users.getUserList({
          emailAddress: [customerEmail],
        });

        if (existingUsers.data.length > 0) {
          clerkUserId = existingUsers.data[0].id;
          logger.log(`Clerk user already exists: ${clerkUserId}`);
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
              logger.log(`Created Clerk user: ${clerkUserId}`);
              break;
            } catch (createError: any) {
              retryCount++;

              // Don't retry for permanent errors
              if (createError.status === 400 || createError.status === 422) {
                logger.error('Clerk user creation failed (permanent error):', {
                  email: customerEmail,
                  error: createError.message,
                  clerkErrors: createError.errors,
                });
                throw createError;
              }

              // Retry for transient errors
              if (retryCount < maxRetries) {
                logger.warn(`Clerk user creation failed, retrying (${retryCount}/${maxRetries})`, {
                  error: createError.message,
                });
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              } else {
                throw createError;
              }
            }
          }
        }

        // Update purchase intent with Clerk user ID
        await supabase
          .from('purchase_intents')
          .update({
            clerk_user_id: clerkUserId,
          })
          .eq('id', purchaseIntentId);

        // Insert into users table (idempotent)
        const { error: userInsertError } = await supabase
          .from('users')
          .insert({
            clerk_user_id: clerkUserId,
            email: customerEmail,
            passkey_enrolled: false,
          })
          .select()
          .single();

        // Ignore duplicate key error (user already exists)
        if (userInsertError && userInsertError.code !== '23505') {
          throw userInsertError;
        }

        // Mark purchase intent as provisioned
        await supabase
          .from('purchase_intents')
          .update({
            status: 'provisioned',
          })
          .eq('id', purchaseIntentId);

        logger.log(`Successfully provisioned user for ${customerEmail}`);
      } catch (error: any) {
        logger.error('Failed to provision Clerk user:', error);
        // Don't mark as failed - retry can happen
        return NextResponse.json(
          { error: 'Failed to provision user' },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler error' },
      { status: 500 },
    );
  }
}
