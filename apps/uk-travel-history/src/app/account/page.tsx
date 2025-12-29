import { redirect } from 'next/navigation';
import { getCurrentUser, type AuthUser } from '@uth/auth-server';
import { AccountPageClient } from './AccountPageClient';
import { AccountErrorFallback } from '@/components/AccountErrorFallback';
import { getUserByAuthId, type User } from '@uth/db';
import { logger } from '@uth/utils';
import { call, appFlow } from '@uth/flow';

// Force dynamic rendering for flow-based pages
// This prevents Next.js from attempting static generation which causes timeout
// due to the while(true) generator pattern in flow.tsx
export const dynamic = 'force-dynamic';

export default appFlow.page(async function* AccountPage() {
  // Attempt to get current authenticated user with error policy
  // Using yield* for automatic type inference
  const user = yield* call(getCurrentUser).orRedirect(
    '/sign-in?error=auth_error',
    'Auth failed',
  );

  // Handle null user case (value missing, not error)
  if (!user) {
    logger.info(
      'Account page accessed without authentication, redirecting to sign-in',
    );
    redirect('/sign-in?redirect_url=/account');
  }

  // Fetch user subscription data from Supabase
  // Use optional policy to handle missing user gracefully
  const dbUser = yield* call(getUserByAuthId, user.uid).optional(null);

  // Handle missing database user: show error UI instead of redirecting
  // This can happen if webhook failed or database record was deleted
  if (!dbUser) {
    logger.error('User exists in Clerk but not in database', undefined, {
      extra: {
        userId: user.uid,
        email: user.email,
        message: 'Webhook may have failed or database record was deleted',
      },
    });

    // Return error fallback UI instead of redirecting
    // This allows the user to retry provisioning
    return (
      <AccountErrorFallback userId={user.uid} email={user.email || 'Unknown'} />
    );
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
