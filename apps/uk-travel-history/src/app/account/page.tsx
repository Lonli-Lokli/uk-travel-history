import { redirect } from 'next/navigation';
import { getCurrentUser } from '@uth/auth-server';
import { AccountPageClient } from './AccountPageClient';
import { getUserByAuthId } from '@uth/db';

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/sign-in?redirect_url=/account');
  }

  // Fetch user subscription data from Supabase
  const dbUser = await getUserByAuthId(user.uid);

  // Handle race condition: user exists in Clerk but not yet in Supabase
  // This can happen during webhook processing delays
  if (!dbUser) {
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
}
