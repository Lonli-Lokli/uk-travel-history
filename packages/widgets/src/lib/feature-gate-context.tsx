'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { FeatureFlagKey } from '@uth/features';

/**
 * Store interfaces for feature gating
 */
export interface MonetizationStore {
  hasFeatureAccess: (featureId: FeatureFlagKey) => boolean;
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
    handleUpgrade,
  };
}
