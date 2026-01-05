// Monetization Store
// Manages user subscription tier, role, and feature access
//
// HYDRATION STRATEGY:
// - All state is hydrated from server-side AccessContext
// - Client-side state is for UX only (showing/hiding UI elements)
// - Real security is server-side via assertFeatureAccess() in API routes
// - When auth state changes, Providers triggers router.refresh() to re-fetch from server
//
// IMPORTANT: This store does NOT fetch data itself. All data comes from:
// 1. Initial hydration via AccessContext (from loadAccessContext())
// 2. Re-hydration after router.refresh() when auth state changes

import { makeAutoObservable } from 'mobx';
import { authStore } from './authStore';
import {
  DEFAULT_FEATURE_POLICIES,
  type FeatureFlagKey,
  type FeaturePolicy,
} from '@uth/features';
import { ROLES, TIERS, type RoleId, type TierId } from '@uth/domain';

// Type guard to validate tier values
function isValidTier(value: unknown): value is TierId {
  return (
    value === TIERS.ANONYMOUS || value === TIERS.FREE || value === TIERS.PREMIUM
  );
}

class MonetizationStore {
  // Subscription state
  // Defaults to ANONYMOUS for unauthenticated users (fail-closed)
  tier: TierId = TIERS.ANONYMOUS;

  // User role (standard or admin)
  // Defaults to STANDARD for all users
  role: RoleId = ROLES.STANDARD;

  // Server-loaded feature policies
  // These are passed from the server to ensure consistency
  featurePolicies: Record<FeatureFlagKey, FeaturePolicy> =
    DEFAULT_FEATURE_POLICIES;

  constructor() {
    makeAutoObservable(this);
    // NOTE: No reaction for auth state changes here.
    // Providers component handles auth changes via router.refresh()
    // which re-fetches the access context from server and calls hydrate()
  }

  /**
   * Check if user has access to a specific feature
   *
   * NOTE: This is for UI/UX only! Server-side validation is the real security.
   * Client-side checks can be bypassed, so all API routes must use assertFeatureAccess()
   */
  hasFeatureAccess(featureKey: FeatureFlagKey): boolean {
    const policy = this.featurePolicies[featureKey];
    if (!policy || !policy.enabled) {
      return false;
    }

    // Check tier level
    const tierLevels: Record<TierId, number> = {
      [TIERS.ANONYMOUS]: 0,
      [TIERS.FREE]: 1,
      [TIERS.PREMIUM]: 2,
    };

    const userLevel = tierLevels[this.tier];
    const requiredLevel = tierLevels[policy.minTier];

    return userLevel >= requiredLevel;
  }

  /**
   * Get the minimum tier required for a feature
   * Used by feature gate components to show appropriate badges
   */
  getMinimumTier(featureKey: FeatureFlagKey): TierId | null {
    const policy = this.featurePolicies[featureKey];
    if (!policy) {
      return null;
    }
    return policy.minTier;
  }

  /**
   * Check if user is premium
   */
  get isPremium(): boolean {
    return this.tier === TIERS.PREMIUM;
  }

  /**
   * Check if user is authenticated
   */
  get isAuthenticated(): boolean {
    return !!authStore.user;
  }

  /**
   * Check if user is anonymous (not authenticated)
   */
  get isAnonymous(): boolean {
    return this.tier === TIERS.ANONYMOUS;
  }

  /**
   * Check if user is admin
   */
  get isAdmin(): boolean {
    return this.role === ROLES.ADMIN;
  }

  /**
   * Check if loading (always false in simplified version)
   * Kept for backward compatibility with FeatureGate component
   */
  get isLoading(): boolean {
    return false;
  }

  /**
   * Set feature policies from server
   * Should be called when loading the app with server-provided policies
   *
   * @param policies - Feature policies loaded from server
   */
  setFeaturePolicies(policies: Record<FeatureFlagKey, FeaturePolicy>): void {
    this.featurePolicies = policies;
  }

  /**
   * Manually set tier (for testing or admin override)
   *
   * @param tier - The tier to set (must be valid TierId)
   */
  setTier(tier: unknown): void {
    if (isValidTier(tier)) {
      this.tier = tier;
    } else {
      // Fail-closed: invalid tier defaults to ANONYMOUS
      console.warn(
        `[MonetizationStore] Invalid tier value: ${tier}, defaulting to ANONYMOUS`,
      );
      this.tier = TIERS.ANONYMOUS;
    }
  }

  /**
   * Manually set role (for testing or admin override)
   *
   * @param role - The role to set
   */
  setRole(role: RoleId): void {
    this.role = role;
  }

  /**
   * Hydrate store with server-side access context
   * Called from Providers with data from loadAccessContext()
   *
   * This is the ONLY way tier/role/policies should be set from server data.
   * The server is the source of truth for subscription status.
   *
   * @param tier - User's subscription tier from server
   * @param role - User's role from server
   * @param policies - Feature policies from server
   */
  hydrate(
    tier: TierId,
    role: RoleId,
    policies: Record<FeatureFlagKey, FeaturePolicy>,
  ): void {
    this.tier = tier;
    this.role = role;
    this.featurePolicies = policies;
  }

  /**
   * Reset to default state (anonymous, standard role)
   */
  reset(): void {
    this.tier = TIERS.ANONYMOUS;
    this.role = ROLES.STANDARD;
    this.featurePolicies = DEFAULT_FEATURE_POLICIES;
  }
}

export const monetizationStore = new MonetizationStore();
