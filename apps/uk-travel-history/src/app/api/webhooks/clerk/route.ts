/**
 * POST /api/webhooks/clerk
 * Handles Clerk webhook events for user lifecycle management
 *
 * Events handled:
 * - user.created: Provision user in Supabase with 'free' tier
 * - user.updated: Sync user data changes
 * - user.deleted: Clean up user data
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { verifyWebhook } from '@uth/auth-server';
import { createAdminClient } from '@uth/db';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature using SDK
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      logger.error('CLERK_WEBHOOK_SECRET not configured', undefined);
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 },
      );
    }

    const body = await request.text();
    const headersList = await headers();

    // Convert Headers to plain object for SDK
    const headersObj: Record<string, string> = {};
    headersList.forEach((value, key) => {
      headersObj[key] = value;
    });

    let event;
    try {
      event = await verifyWebhook(body, headersObj, WEBHOOK_SECRET);
    } catch (err) {
      logger.error('Clerk webhook verification failed', undefined, {
        extra: { error: (err as Error).message },
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { type, data } = event;

    logger.info(`Clerk webhook received: ${type}`, {
      extra: { userId: data.id },
    });

    const supabase = createAdminClient();

    switch (type) {
      case 'user.created': {
        // Provision new user in Supabase with free tier
        const email = data.email_addresses?.find(
          (e: any) => e.id === data.primary_email_address_id,
        )?.email_address;

        if (!email) {
          logger.error('No email found in user.created event', undefined, {
            extra: { userId: data.id },
          });
          return NextResponse.json(
            { error: 'No email found' },
            { status: 400 },
          );
        }

        // Use upsert to handle race conditions (Stripe webhook may create user first)
        // If user exists from Stripe webhook, preserve existing tier/status
        // Note: Using type assertion here because Supabase client types aren't inferring correctly
        const { error: upsertError } = await (
          supabase.from('users').upsert as any
        )(
          {
            clerk_user_id: data.id,
            email: email,
            passkey_enrolled: false,
            subscription_tier: 'free' as const,
            subscription_status: null,
            stripe_customer_id: null,
            stripe_subscription_id: null,
            stripe_price_id: null,
            current_period_end: null,
          },
          {
            onConflict: 'clerk_user_id',
            ignoreDuplicates: true, // Don't override if exists (preserves Stripe-provisioned users)
          },
        );

        if (upsertError) {
          logger.error('Failed to upsert user in Supabase', undefined, {
            extra: {
              userId: data.id,
              email,
              error: upsertError,
              errorCode: upsertError.code,
              errorMessage: upsertError.message,
              errorDetails: upsertError.details,
            },
          });
          return NextResponse.json(
            { error: 'Failed to create user' },
            { status: 500 },
          );
        }

        logger.info('User provisioned successfully via webhook', {
          extra: { userId: data.id, email, webhookEvent: 'user.created' },
        });

        break;
      }

      case 'user.updated': {
        // Update user email if changed
        const email = data.email_addresses?.find(
          (e: any) => e.id === data.primary_email_address_id,
        )?.email_address;

        if (email) {
          const { error: updateError } = await (
            supabase.from('users').update as any
          )({ email }).eq('clerk_user_id', data.id);

          if (updateError) {
            logger.error('Failed to update user in Supabase', undefined, {
              extra: { userId: data.id, error: updateError },
            });
          } else {
            logger.info('User updated successfully', {
              extra: { userId: data.id, email },
            });
          }
        }

        break;
      }

      case 'user.deleted': {
        // Delete user from Supabase
        const { error: deleteError } = await (
          supabase.from('users').delete as any
        )().eq('clerk_user_id', data.id);

        if (deleteError) {
          logger.error('Failed to delete user from Supabase', undefined, {
            extra: { userId: data.id, error: deleteError },
          });
          return NextResponse.json(
            { error: 'Failed to delete user' },
            { status: 500 },
          );
        }

        logger.info('User deleted successfully', {
          extra: { userId: data.id },
        });

        break;
      }

      default:
        logger.info(`Unhandled Clerk webhook event: ${type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Clerk webhook handler error', undefined, {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
