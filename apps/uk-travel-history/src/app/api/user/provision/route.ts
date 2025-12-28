/**
 * POST /api/user/provision
 * Manually provisions a user in the database
 *
 * This endpoint is used as a fallback when webhook provisioning fails.
 * It requires the user to be authenticated via Clerk.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient, getUserByAuthId } from '@uth/db';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST() {
  try {
    // Get authenticated user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user already exists in database
    const existingUser = await getUserByAuthId(userId);

    if (existingUser) {
      logger.info('User already exists in database', {
        extra: { userId },
      });
      return NextResponse.json({
        success: true,
        message: 'User already exists',
      });
    }

    // Get user details from Clerk
    const { clerkClient } = await import('@clerk/nextjs/server');
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);

    if (!clerkUser) {
      logger.error('Failed to fetch user from Clerk', {
        extra: { userId },
      });
      return NextResponse.json(
        { error: 'Failed to fetch user details' },
        { status: 500 }
      );
    }

    const email = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (!email) {
      logger.error('No primary email found for user', {
        extra: { userId },
      });
      return NextResponse.json(
        { error: 'No email address found' },
        { status: 400 }
      );
    }

    // Provision user in Supabase
    const supabase = createAdminClient();

    // Use type assertion to match the pattern in the webhook handler
    // Supabase client types don't correctly infer the upsert operation
    const { error: upsertError } = await (supabase.from('users').upsert as any)(
      {
        clerk_user_id: userId,
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
      }
    );

    if (upsertError) {
      logger.error('Failed to provision user in Supabase', {
        extra: { userId, error: upsertError },
      });
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    logger.info('User manually provisioned successfully', {
      extra: { userId, email },
    });

    return NextResponse.json({
      success: true,
      message: 'User provisioned successfully',
    });
  } catch (error) {
    logger.error('User provisioning error', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
