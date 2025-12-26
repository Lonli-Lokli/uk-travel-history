import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { AccountPageClient } from './AccountPageClient';
import { getUserByAuthId } from '@uth/db';

export default async function AccountPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in?redirect_url=/account');
  }

  // Fetch user subscription data from Supabase
  const dbUser = await getUserByAuthId(user.id);

  return (
    <AccountPageClient
      user={{
        email: user.emailAddresses[0]?.emailAddress || '',
        subscriptionTier: dbUser?.subscriptionTier || 'free',
        subscriptionStatus: dbUser?.subscriptionStatus || null,
        currentPeriodEnd: dbUser?.currentPeriodEnd
          ? dbUser.currentPeriodEnd.toISOString()
          : null,
        stripeCustomerId: dbUser?.stripeCustomerId || null,
      }}
    />
  );
}
