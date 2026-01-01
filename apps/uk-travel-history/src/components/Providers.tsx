'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { FeatureGateProvider, PaymentModal } from '@uth/widgets';
import { authStore, monetizationStore, paymentStore, useRefreshAccessContext } from '@uth/stores';
import { type FeatureFlagKey, TIERS } from '@uth/features';
import type { FeaturePolicy } from '@uth/features';
import type { AccessContext, SubscriptionTier } from '@uth/db';
import type { AuthUser } from '@uth/auth-client';
import { reaction } from 'mobx';

interface ProvidersProps {
  children: ReactNode;
  featurePolicies: Record<FeatureFlagKey, FeaturePolicy>;
  accessContext?: AccessContext;
}

/**
 * Map SubscriptionTier (from DB) to TierId (used by monetization store)
 */
function mapSubscriptionTierToTierId(tier: SubscriptionTier): typeof TIERS[keyof typeof TIERS] {
  switch (tier) {
    case 'free':
      return TIERS.FREE;
    case 'monthly':
    case 'yearly':
    case 'lifetime':
      return TIERS.PREMIUM;
    default:
      return TIERS.ANONYMOUS;
  }
}

/**
 * Convert AccessContext user to AuthUser
 * The AccessContext contains a minimal subset of AuthUser fields
 */
function mapAccessContextUserToAuthUser(
  contextUser: AccessContext['user']
): AuthUser | null {
  if (!contextUser) return null;

  return {
    uid: contextUser.uid,
    email: contextUser.email,
    emailVerified: contextUser.emailVerified,
    isAnonymous: false, // Users from AccessContext are never anonymous
  };
}

/**
 * Unified providers component that initializes feature gate context.
 *
 * Initializes:
 * - Server-authoritative access context (auth + tier + entitlements)
 * - Feature policies in monetization store (for tier-based access control)
 * - Feature gate context (provides stores to all child components)
 * - Payment modal (global subscription modal)
 *
 * HYDRATION STRATEGY:
 * - If `accessContext` is provided (from server), hydrate stores immediately
 * - This prevents flicker by ensuring stores start with correct server state
 * - Client-side auth listeners will update state on subsequent changes
 */
export function Providers({ children, featurePolicies, accessContext }: ProvidersProps) {
  const refreshAccessContext = useRefreshAccessContext();
  const previousUserRef = useRef<AuthUser | null>(null);

  // Hydrate stores with server-side access context on mount
  useEffect(() => {
    if (accessContext) {
      // Hydrate auth store with user data
      const authUser = mapAccessContextUserToAuthUser(accessContext.user);
      authStore.hydrate(authUser);
      previousUserRef.current = authUser;

      // Hydrate monetization store with tier and policies
      const tierId = mapSubscriptionTierToTierId(accessContext.tier);
      monetizationStore.hydrate(tierId, featurePolicies);
    } else if (featurePolicies) {
      // Fallback: if no access context, just set policies
      monetizationStore.setFeaturePolicies(featurePolicies);
    }
  }, [accessContext, featurePolicies]);

  // Refresh access context when user signs in or out
  useEffect(() => {
    const disposer = reaction(
      () => authStore.user,
      (currentUser) => {
        const previousUser = previousUserRef.current;

        // Trigger refresh when user signs in (null -> user)
        if (!previousUser && currentUser) {
          refreshAccessContext();
        }

        // Trigger refresh when user signs out (user -> null)
        if (previousUser && !currentUser) {
          refreshAccessContext();
        }

        // Update ref for next comparison
        previousUserRef.current = currentUser;
      }
    );

    return () => disposer();
  }, [refreshAccessContext]);

  return (
    <FeatureGateProvider
      monetizationStore={monetizationStore}
      authStore={authStore}
      paymentStore={paymentStore}
    >
      {children}
      <PaymentModal />
    </FeatureGateProvider>
  );
}

Providers.displayName = 'Providers';
