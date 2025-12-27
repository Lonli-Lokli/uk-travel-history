import { redirect } from 'next/navigation';
import { getCurrentUser, type AuthUser } from '@uth/auth-server';
import { AccountPageClient } from './AccountPageClient';
import { getUserByAuthId, type User } from '@uth/db';
import { logger } from '@uth/utils';
import { appFlow } from '@/lib/appFlow';
import { call } from '@/lib/flow';

export default appFlow.page<void>(async function* AccountPage() {
  // Attempt to get current authenticated user with error policy
  const user = (yield call(getCurrentUser).orRedirect(
    '/sign-in?error=auth_error',
    'Auth failed'
  )) as AuthUser | null;

  // Handle null user case (value missing, not error)
  if (!user) {
    logger.info('Account page accessed without authentication, redirecting to sign-in');
    redirect('/sign-in?redirect_url=/account');
  }

  // Fetch user subscription data from Supabase with error policy
  const dbUser = (yield call(getUserByAuthId, user.uid).orRedirect(
    '/sign-in?error=database_error',
    'Failed to fetch user data from database'
  )) as User | null;

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
});
