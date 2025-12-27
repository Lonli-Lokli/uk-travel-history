import { redirect } from 'next/navigation';
import { getCurrentUser } from '@uth/auth-server';
import { AccountPageClient } from './AccountPageClient';
import { getUserByAuthId } from '@uth/db';
import { logger } from '@uth/utils';

export default async function AccountPage() {
  try {
    // Attempt to get current authenticated user
    const user = await getCurrentUser();

    if (!user) {
      logger.info('Account page accessed without authentication, redirecting to sign-in');
      redirect('/sign-in?redirect_url=/account');
    }

    // Fetch user subscription data from Supabase
    let dbUser;
    try {
      dbUser = await getUserByAuthId(user.uid);
    } catch (error) {
      logger.error('Failed to fetch user data from database', {
        extra: {
          userId: user.uid,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      // Redirect to sign-in with error message
      redirect('/sign-in?error=database_error');
    }

    // Handle race condition: user exists in Clerk but not yet in Supabase
    // This can happen during webhook processing delays
    if (!dbUser) {
      logger.warn('User exists in Clerk but not in database - webhook race condition', {
        extra: {
          userId: user.uid,
          email: user.email,
        },
      });
      redirect('/sign-in?error=account_not_ready');
    }

    return (
      <AccountPageClient
        user={{
          email: user.email || '',
          subscriptionTier: dbUser.subscriptionTier || 'free',
          subscriptionStatus: dbUser.subscriptionStatus || null,
          currentPeriodEnd: dbUser.currentPeriodEnd
            ? dbUser.currentPeriodEnd.toISOString()
            : null,
          stripeCustomerId: dbUser.stripeCustomerId || null,
        }}
      />
    );
  } catch (error) {
    // Catch any authentication errors and log them properly
    logger.error('Account page error', {
      extra: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    // If it's a redirect, re-throw it (redirects throw internally in Next.js)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }

    // For all other errors, redirect to sign-in with generic error
    redirect('/sign-in?error=auth_error');
  }
}
