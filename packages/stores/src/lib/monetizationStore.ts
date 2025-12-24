// Monetization Store
// Manages user subscription tier and feature access

import { makeAutoObservable, runInAction } from 'mobx';
import { authStore } from './authStore';
import { TIERS, TIER_CONFIG, type FeatureId, type TierId } from '@uth/features';
import { logger } from '@uth/utils';

class MonetizationStore {
  // Subscription state
  tier: TierId = TIERS.FREE;
  isLoading = false;
  error: string | null = null;
  lastFetched: Date | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Check if user has access to a specific feature
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
   * Fetch user's current subscription tier from backend
   */
  async fetchSubscription(): Promise<void> {
    // If not authenticated, set to FREE tier
    if (!this.isAuthenticated) {
      runInAction(() => {
        this.tier = TIERS.FREE;
        this.isLoading = false;
      });
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      const token = await authStore.getIdToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      const response = await fetch('/api/subscription/current', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // If endpoint doesn't exist or returns 404, default to FREE
        if (response.status === 404) {
          runInAction(() => {
            this.tier = TIERS.FREE;
            this.isLoading = false;
            this.lastFetched = new Date();
          });
          return;
        }

        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch subscription');
      }

      const data = await response.json();

      runInAction(() => {
        this.tier = (data.tier as TierId) || TIERS.FREE;
        this.isLoading = false;
        this.lastFetched = new Date();
      });
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : 'Failed to fetch subscription';
        this.isLoading = false;
        // Default to FREE tier on error
        this.tier = TIERS.FREE;
      });

      logger.error('Failed to fetch subscription', err, {
        tags: {
          service: 'monetization',
          operation: 'fetch_subscription',
        },
        contexts: {
          monetization: {
            isAuthenticated: this.isAuthenticated,
            userId: authStore.user?.uid,
          },
        },
      });
    }
  }

  /**
   * Refresh subscription if needed (cache for 5 minutes)
   */
  async refreshIfNeeded(): Promise<void> {
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    if (
      !this.lastFetched ||
      Date.now() - this.lastFetched.getTime() > CACHE_DURATION
    ) {
      await this.fetchSubscription();
    }
  }

  /**
   * Force refresh subscription
   */
  async refresh(): Promise<void> {
    await this.fetchSubscription();
  }

  /**
   * Reset to default state
   */
  reset(): void {
    this.tier = TIERS.FREE;
    this.isLoading = false;
    this.error = null;
    this.lastFetched = null;
  }
}

export const monetizationStore = new MonetizationStore();
