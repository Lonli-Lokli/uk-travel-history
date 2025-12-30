'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { FeatureFlagKey } from '@uth/features';

/**
 * Store interfaces for feature gating
 */
export interface MonetizationStore {
  hasFeatureAccess: (featureId: FeatureFlagKey) => boolean;
  getMinimumTier: (featureId: FeatureFlagKey) => 'anonymous' | 'free' | 'premium' | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthStore {
  user: unknown;
}

export interface PaymentStore {
  openPaymentModal: () => void;
}

/**
 * Feature gate context value
 */
export interface FeatureGateContextValue {
  monetizationStore: MonetizationStore;
  authStore: AuthStore;
  paymentStore: PaymentStore;
}

const FeatureGateContext = createContext<FeatureGateContextValue | null>(null);

/**
 * Provider component for feature gating stores
 */
export interface FeatureGateProviderProps {
  monetizationStore: MonetizationStore;
  authStore: AuthStore;
  paymentStore: PaymentStore;
  children: ReactNode;
}

export function FeatureGateProvider({
  monetizationStore,
  authStore,
  paymentStore,
  children,
}: FeatureGateProviderProps) {
  return (
    <FeatureGateContext.Provider
      value={{ monetizationStore, authStore, paymentStore }}
    >
      {children}
    </FeatureGateContext.Provider>
  );
}

/**
 * Hook to access feature gate stores
 */
export function useFeatureGateContext() {
  const context = useContext(FeatureGateContext);
  if (!context) {
    throw new Error(
      'useFeatureGateContext must be used within FeatureGateProvider',
    );
  }
  return context;
}

/**
 * Hook for feature access logic
 */
export function useFeatureGate(feature: FeatureFlagKey) {
  const { monetizationStore, authStore, paymentStore } =
    useFeatureGateContext();

  const hasAccess = monetizationStore.hasFeatureAccess(feature);
  const isLoading = monetizationStore.isLoading;
  const isAuthenticated = monetizationStore.isAuthenticated || !!authStore.user;
  const minTier = monetizationStore.getMinimumTier(feature);

  // Determine what action is needed
  // Premium features always show Premium badge (whether anonymous or authenticated)
  // Free tier features show "Sign up" badge only for anonymous users
  const requiresSignUp = !isAuthenticated && minTier === 'free' && !hasAccess;
  const requiresUpgrade = minTier === 'premium' && !hasAccess;

  const handleUpgrade = () => {
    if (!isAuthenticated) {
      // Redirect to Clerk sign-up page
      window.location.href = '/sign-up';
    } else {
      paymentStore.openPaymentModal();
    }
  };

  return {
    hasAccess,
    isLoading,
    isAuthenticated,
    minTier,
    requiresSignUp,
    requiresUpgrade,
    handleUpgrade,
  };
}
