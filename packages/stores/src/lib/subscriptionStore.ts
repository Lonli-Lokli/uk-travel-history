// Subscription Store
// Manages user subscription state and tier access using auth-server SDK

import { makeAutoObservable, runInAction } from 'mobx';
import { authStore } from './authStore';
import { logger } from '@uth/utils';
import type { Subscription, SubscriptionStatus } from '@uth/auth-server';

class SubscriptionStore {
  subscription: Subscription | null = null;
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Get current subscription tier ('free' or 'premium')
   */
  get tier(): 'free' | 'premium' {
    if (!this.subscription) {
      return 'free';
    }

    // Only active and trialing subscriptions count as premium
    if (
      this.subscription.status === 'active' ||
      this.subscription.status === 'trialing'
    ) {
      return 'premium';
    }

    return 'free';
  }

  /**
   * Check if user has premium access
   */
  get isPremium(): boolean {
    return this.tier === 'premium';
  }

  /**
   * Check if subscription is active
   */
  get isActive(): boolean {
    return (
      this.subscription !== null &&
      (this.subscription.status === 'active' ||
        this.subscription.status === 'trialing')
    );
  }

  /**
   * Fetch subscription data from the server
   * Uses auth-server SDK via API endpoint
   */
  async fetchSubscription(): Promise<void> {
    // Don't fetch if no user is authenticated
    if (!authStore.user) {
      this.subscription = null;
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      const token = await authStore.getIdToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('/api/user/subscription', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No subscription found - this is OK, user is on free tier
          runInAction(() => {
            this.subscription = null;
            this.isLoading = false;
          });
          return;
        }

        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch subscription');
      }

      const data = await response.json();

      runInAction(() => {
        this.subscription = data.subscription
          ? {
              ...data.subscription,
              currentPeriodStart: new Date(data.subscription.currentPeriodStart),
              currentPeriodEnd: new Date(data.subscription.currentPeriodEnd),
              createdAt: new Date(data.subscription.createdAt),
              updatedAt: new Date(data.subscription.updatedAt),
              canceledAt: data.subscription.canceledAt
                ? new Date(data.subscription.canceledAt)
                : undefined,
              lastPaymentError: data.subscription.lastPaymentError
                ? new Date(data.subscription.lastPaymentError)
                : undefined,
            }
          : null;
        this.isLoading = false;
      });

      logger.addBreadcrumb('Subscription fetched', 'subscription', {
        tier: this.tier,
        status: this.subscription?.status,
      });
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : 'Failed to fetch subscription';
        this.isLoading = false;
      });

      logger.error('Failed to fetch subscription', err, {
        tags: {
          service: 'subscription',
          operation: 'fetch_subscription',
        },
        contexts: {
          subscription: {
            userId: authStore.user?.uid,
          },
        },
      });
    }
  }

  /**
   * Initialize subscription tracking when user logs in
   * Call this from the app initialization or when auth state changes
   */
  async initialize(): Promise<void> {
    if (authStore.user) {
      await this.fetchSubscription();
    }
  }

  /**
   * Clear subscription data (e.g., on logout)
   */
  clear(): void {
    this.subscription = null;
    this.error = null;
    this.isLoading = false;
  }
}

export const subscriptionStore = new SubscriptionStore();
