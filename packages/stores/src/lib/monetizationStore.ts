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
import { TIERS, TIER_CONFIG, type FeatureId, type TierId } from '@uth/features';

// Type guard to validate tier values
function isValidTier(value: unknown): value is TierId {
  return value === TIERS.FREE || value === TIERS.PREMIUM;
}

class MonetizationStore {
  // Subscription state
  // Always defaults to FREE for security (fail-closed)
  tier: TierId = TIERS.FREE;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Check if user has access to a specific feature
   *
   * NOTE: This is for UI/UX only! Server-side validation is the real security.
   * Client-side checks can be bypassed, so all API routes must use requirePaidFeature()
   */
  hasFeatureAccess(featureId: FeatureId): boolean {
    const tierFeatures = TIER_CONFIG[this.tier];
    return tierFeatures.includes(featureId);
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
      // Fail-closed: invalid tier defaults to FREE
      console.warn(`[MonetizationStore] Invalid tier value: ${tier}, defaulting to FREE`);
      this.tier = TIERS.FREE;
    }
  }

  /**
   * Reset to default state
   */
  reset(): void {
    this.tier = TIERS.FREE;
  }
}

export const monetizationStore = new MonetizationStore();
