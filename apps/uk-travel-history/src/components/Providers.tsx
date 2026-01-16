'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { FeatureGateProvider, PaymentModal } from '@uth/widgets';
import {
  authStore,
  monetizationStore,
  paymentStore,
  goalsStore,
  tripsStore,
  useRefreshAccessContext,
} from '@uth/stores';
import { type FeatureFlagKey, FEATURE_KEYS } from '@uth/features';
import type { FeaturePolicy } from '@uth/features';
import type { DataContext, IdentityContext, SubscriptionTier, UserRole } from '@uth/db';
import type { AuthUser } from '@uth/auth-client';
import { reaction } from 'mobx';
import { RoleId, ROLES, TIERS } from '@uth/domain';
import { useToast } from '@uth/ui';

interface ProvidersProps {
  children: ReactNode;
  identityContext: IdentityContext;
  dataContext: DataContext;
}

/**
 * Map SubscriptionTier (from DB) to TierId (used by monetization store)
 * Also considers whether user is authenticated (null user = anonymous)
 *
 * @param tier - Subscription tier from DB
 * @param isAuthenticated - Whether user is logged in
 */
function mapSubscriptionTierToTierId(
  tier: SubscriptionTier,
  isAuthenticated: boolean,
): (typeof TIERS)[keyof typeof TIERS] {
  // Anonymous users always get ANONYMOUS tier regardless of DB tier
  if (!isAuthenticated) {
    return TIERS.ANONYMOUS;
  }

  switch (tier) {
    case 'free':
    case 'anonymous': // Handle case where DB returns anonymous for some reason
      return TIERS.FREE;
    case 'monthly':
    case 'yearly':
    case 'lifetime':
      return TIERS.PREMIUM;
    default:
      return TIERS.FREE; // Authenticated but unknown tier defaults to FREE
  }
}

/**
 * Map UserRole (from DB) to RoleId (used by monetization store)
 *
 * @param role - User role from DB
 */
function mapUserRoleToRoleId(role: UserRole): RoleId {
  switch (role) {
    case 'admin':
      return ROLES.ADMIN;
    case 'standard':
    default:
      return ROLES.STANDARD;
  }
}

/**
 * Convert AccessContext user to AuthUser
 * The AccessContext contains a minimal subset of AuthUser fields
 */
function mapAccessContextUserToAuthUser(
  contextUser: IdentityContext['user'],
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
 * - Server-authoritative access context (auth + tier + entitlements + policies + pricing)
 * - All stores hydrated from accessContext for consistency
 * - Feature gate context (provides stores to all child components)
 * - Payment modal (global subscription modal)
 *
 * HYDRATION STRATEGY:
 * - AccessContext contains ALL data needed for hydration (no separate fetches)
 * - Stores are hydrated immediately to prevent flicker
 * - Client-side auth listeners will update state on subsequent changes
 */
export function Providers({ children, identityContext, dataContext }: ProvidersProps) {
  const refreshAccessContext = useRefreshAccessContext();
  const previousUserRef = useRef<AuthUser | null>(null);
  const hasShownExpirationToast = useRef(false);
  const { toast } = useToast();

  // Hydrate all stores with server-side access context on mount
  useEffect(() => {
    // Hydrate auth store with user data
    const authUser = mapAccessContextUserToAuthUser(identityContext.user);
    authStore.hydrate(authUser);
    previousUserRef.current = authUser;

    // Hydrate monetization store with tier, role, and policies
    // Pass isAuthenticated to correctly map anonymous vs free tier
    const isAuthenticated = identityContext.user !== null;
    const tierId = mapSubscriptionTierToTierId(
      identityContext.tier,
      isAuthenticated,
    );
    const roleId = mapUserRoleToRoleId(identityContext.role);
    const policies = identityContext.policies as Record<
      FeatureFlagKey,
      FeaturePolicy
    >;
    monetizationStore.hydrate(tierId, roleId, policies);

    // Hydrate payment store with pricing data
    if (identityContext.pricing) {
      paymentStore.hydrate(identityContext.pricing);
    }

    // Hydrate goals store with goals data and templates
    // Check if multi_goal_tracking feature is enabled via entitlements
    const isGoalsFeatureEnabled =
      identityContext.entitlements[FEATURE_KEYS.MULTI_GOAL_TRACKING] ?? false;
    goalsStore.hydrate(
      dataContext.goals ?? null,
      dataContext.goalCalculations ?? null,
      isGoalsFeatureEnabled,
      dataContext.goalTemplates ?? null,
    );

    // Hydrate trips store with trips data
    tripsStore.hydrate(dataContext.trips ?? null);

    // NOTE: Client-side trip reactions for goal recalculation have been removed.
    // All calculations now happen server-side in loadDataContext().
    // After trip/goal mutations, components should call router.refresh() to re-hydrate.

    // Initialize auth state subscription AFTER hydration
    // This prevents hydration mismatches by ensuring the subscription
    // doesn't fire before React has finished hydrating
    authStore.initializeAuthSubscription();

    // Show toast if ephemeral data expired (anonymous user's cached data expired)
    if (dataContext.ephemeralDataExpired && !hasShownExpirationToast.current) {
      hasShownExpirationToast.current = true;
      // Use setTimeout to ensure toast is shown after hydration completes
      setTimeout(() => {
        toast({
          title: 'Session expired',
          description: 'Your previously saved data has expired. Sign up to save your data permanently.',
          variant: 'default',
        });
      }, 100);
    }
  }, [dataContext, identityContext, toast]);

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
      },
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
