// Subscription Store
// Manages user subscription state and feature access

import { makeAutoObservable, runInAction } from 'mobx';
import { authStore } from './authStore';
import { getFirestore, doc, onSnapshot, type Unsubscribe, type Firestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { FEATURES, TIER_CONFIG, type FeatureId, type TierId } from '@uth/features';
import * as Sentry from '@sentry/nextjs';

export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled';

class SubscriptionStore {
  tier: TierId = 'free';
  status: SubscriptionStatus = 'none';
  isLoading = true;

  private unsubscribe: Unsubscribe | null = null;

  constructor() {
    makeAutoObservable(this);
    this.initialize();
  }

  /**
   * Initialize subscription listener based on auth state
   */
  private initialize() {
    // Subscribe to auth state changes
    if (typeof window === 'undefined') {
      // Server-side - don't subscribe
      this.isLoading = false;
      return;
    }

    // Watch for auth state changes
    const checkAuth = () => {
      if (authStore.user) {
        this.subscribeToUserSubscription(authStore.user.uid);
      } else {
        this.resetToFree();
      }
    };

    // Initial check
    checkAuth();

    // Re-check when auth state changes
    // We use a reaction pattern by checking authStore.user periodically
    // This is a simple approach - could be improved with proper MobX reactions
    setInterval(() => {
      const currentUserId = this.unsubscribe ? 'subscribed' : null;
      const newUserId = authStore.user?.uid || null;

      if (currentUserId !== newUserId) {
        checkAuth();
      }
    }, 1000);
  }

  /**
   * Subscribe to user's subscription document in Firestore
   */
  private subscribeToUserSubscription(userId: string) {
    // Unsubscribe from previous listener if exists
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    runInAction(() => {
      this.isLoading = true;
    });

    try {
      // Get Firestore instance
      const app = getApp();
      const firestore = getFirestore(app);
      const subscriptionRef = doc(firestore, 'subscriptions', userId);

      this.unsubscribe = onSnapshot(
        subscriptionRef,
        (snapshot) => {
          runInAction(() => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              this.tier = (data.tier as TierId) || 'free';
              this.status = (data.status as SubscriptionStatus) || 'none';
            } else {
              // No subscription document = free tier
              this.tier = 'free';
              this.status = 'none';
            }
            this.isLoading = false;
          });
        },
        (error) => {
          console.error('[SubscriptionStore] Firestore listener error:', error);
          Sentry.captureException(error, {
            tags: {
              service: 'subscription',
              operation: 'firestore_listener',
            },
            contexts: {
              subscription: {
                userId,
              },
            },
          });

          // On error, default to free tier (fail-safe)
          runInAction(() => {
            this.tier = 'free';
            this.status = 'none';
            this.isLoading = false;
          });
        }
      );
    } catch (error) {
      console.error('[SubscriptionStore] Failed to subscribe:', error);
      Sentry.captureException(error, {
        tags: {
          service: 'subscription',
          operation: 'subscribe_to_firestore',
        },
      });

      runInAction(() => {
        this.tier = 'free';
        this.status = 'none';
        this.isLoading = false;
      });
    }
  }

  /**
   * Reset to free tier (when user signs out)
   */
  private resetToFree() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    runInAction(() => {
      this.tier = 'free';
      this.status = 'none';
      this.isLoading = false;
    });
  }

  /**
   * Check if user has access to a specific feature
   *
   * @param featureId - The feature to check access for
   * @returns true if user has access, false otherwise
   */
  hasAccess(featureId: FeatureId): boolean {
    // Get features available for user's tier
    const tierFeatures = TIER_CONFIG[this.tier] || [];
    const hasFeature = tierFeatures.includes(featureId);

    // Premium features require active subscription
    if (this.tier === 'premium') {
      return hasFeature && this.status === 'active';
    }

    // Free tier features
    return hasFeature;
  }

  /**
   * Check if user is authenticated
   */
  get isAuthenticated(): boolean {
    return authStore.user !== null;
  }

  /**
   * Check if user has premium subscription
   */
  get isPremium(): boolean {
    return this.tier === 'premium' && this.status === 'active';
  }

  /**
   * Check if user is on free tier
   */
  get isFree(): boolean {
    return this.tier === 'free';
  }

  /**
   * Cleanup when store is destroyed
   */
  dispose() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

export const subscriptionStore = new SubscriptionStore();
