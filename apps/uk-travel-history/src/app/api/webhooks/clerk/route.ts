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
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { createAdminClient, SubscriptionTier, SubscriptionStatus } from '@uth/db';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Verify Clerk webhook signature
 */
async function verifyWebhook(request: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('CLERK_WEBHOOK_SECRET not configured');
  }

  const headersList = await headers();
  const svix_id = headersList.get('svix-id');
  const svix_timestamp = headersList.get('svix-timestamp');
  const svix_signature = headersList.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    throw new Error('Missing svix headers');
  }

  const body = await request.text();

  const wh = new Webhook(WEBHOOK_SECRET);

  return wh.verify(body, {
    'svix-id': svix_id,
    'svix-timestamp': svix_timestamp,
    'svix-signature': svix_signature,
  });
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    let event;
    try {
      event = await verifyWebhook(request);
    } catch (err) {
      logger.error('Clerk webhook verification failed', undefined, {
        extra: { error: (err as Error).message },
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { type, data } = event as any;

    logger.info(`Clerk webhook received: ${type}`, {
      extra: { userId: data.id },
    });

    const supabase = createAdminClient();

    switch (type) {
      case 'user.created': {
        // Provision new user in Supabase with free tier
        const email = data.email_addresses?.find((e: any) => e.id === data.primary_email_address_id)?.email_address;

        if (!email) {
          logger.error('No email found in user.created event', undefined, {
            extra: { userId: data.id },
          });
          return NextResponse.json({ error: 'No email found' }, { status: 400 });
        }

        // Check if user already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('clerk_user_id', data.id)
          .single();

        if (existingUser) {
          logger.info('User already exists, skipping creation', {
            extra: { userId: data.id },
          });
          return NextResponse.json({ received: true, skipped: true });
        }

        // Create user with free tier
        const { error: createError } = await (supabase.from('users') as any).insert({
          clerk_user_id: data.id,
          email: email,
          passkey_enrolled: false,
          subscription_tier: 'free',
          subscription_status: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          stripe_price_id: null,
          current_period_end: null,
        });

        if (createError) {
          logger.error('Failed to create user in Supabase', undefined, {
            extra: { userId: data.id, error: createError },
          });
          return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
        }

        logger.info('User provisioned successfully', {
          extra: { userId: data.id, email },
        });

        break;
      }

      case 'user.updated': {
        // Update user email if changed
        const email = data.email_addresses?.find((e: any) => e.id === data.primary_email_address_id)?.email_address;

        if (email) {
          const { error: updateError } = await (supabase.from('users') as any)
            .update({ email })
            .eq('clerk_user_id', data.id);

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
        const { error: deleteError } = await (supabase.from('users') as any)
          .delete()
          .eq('clerk_user_id', data.id);

        if (deleteError) {
          logger.error('Failed to delete user from Supabase', undefined, {
            extra: { userId: data.id, error: deleteError },
          });
          return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
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
      { status: 500 }
    );
  }
}
