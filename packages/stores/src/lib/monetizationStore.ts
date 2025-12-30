// Monetization Store
// Manages user subscription tier and feature access
//
// SIMPLIFIED APPROACH:
// - Client-side tier is for UX only (showing/hiding UI elements)
// - Real security is server-side via requirePaidFeature() in API routes
// - Defaults to FREE tier to keep UI simple and safe
// - Server validates all premium feature access with Firebase tokens

import { makeAutoObservable, reaction } from 'mobx';
import { authStore } from './authStore';
import { TIERS, type TierId, DEFAULT_FEATURE_POLICIES, type FeatureFlagKey, type FeaturePolicy } from '@uth/features';

// Type guard to validate tier values
function isValidTier(value: unknown): value is TierId {
  return (
    value === TIERS.ANONYMOUS ||
    value === TIERS.FREE ||
    value === TIERS.PREMIUM
  );
}

class MonetizationStore {
  // Subscription state
  // Defaults to ANONYMOUS for unauthenticated users (fail-closed)
  tier: TierId = TIERS.ANONYMOUS;

  // Server-loaded feature policies
  // These are passed from the server to ensure consistency
  featurePolicies: Record<FeatureFlagKey, FeaturePolicy> = DEFAULT_FEATURE_POLICIES;

  constructor() {
    makeAutoObservable(this);

    // Auto-update tier when auth state changes
    // This ensures registered users automatically get FREE tier
    if (typeof window !== 'undefined') {
      reaction(
        () => authStore.user,
        (user) => {
          this.updateTierFromAuth();
        }
      );
    }
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
   * Manually set tier (for testing or future subscription integration)
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
   * Update tier based on authentication status
   * If user is authenticated but no explicit tier is set, default to FREE
   */
  updateTierFromAuth(): void {
    if (this.isAuthenticated && this.tier === TIERS.ANONYMOUS) {
      this.tier = TIERS.FREE;
    } else if (!this.isAuthenticated && this.tier !== TIERS.ANONYMOUS) {
      this.tier = TIERS.ANONYMOUS;
    }
  }

  /**
   * Reset to default state (anonymous)
   */
  reset(): void {
    this.tier = TIERS.ANONYMOUS;
  }
}

export const monetizationStore = new MonetizationStore();
