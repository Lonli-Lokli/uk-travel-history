// Monetization Store
// Manages user subscription tier and feature access
//
// SIMPLIFIED APPROACH:
// - Client-side tier is for UX only (showing/hiding UI elements)
// - Real security is server-side via requirePaidFeature() in API routes
// - Defaults to FREE tier to keep UI simple and safe
// - Server validates all premium feature access with Firebase tokens

import { makeAutoObservable } from 'mobx';
import { authStore } from './authStore';
import { TIERS, type TierId, DEFAULT_FEATURE_POLICIES, type FeatureFlagKey } from '@uth/features';

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

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Check if user has access to a specific feature
   *
   * NOTE: This is for UI/UX only! Server-side validation is the real security.
   * Client-side checks can be bypassed, so all API routes must use assertFeatureAccess()
   */
  hasFeatureAccess(featureKey: FeatureFlagKey): boolean {
    const policy = DEFAULT_FEATURE_POLICIES[featureKey];
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
   * Reset to default state (anonymous)
   */
  reset(): void {
    this.tier = TIERS.ANONYMOUS;
  }
}

export const monetizationStore = new MonetizationStore();
