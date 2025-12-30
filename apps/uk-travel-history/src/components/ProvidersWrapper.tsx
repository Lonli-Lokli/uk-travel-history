'use client';

import { ReactNode, useEffect } from 'react';
import { FeatureGateProvider } from '@uth/widgets';
import { authStore, monetizationStore, paymentStore } from '@uth/stores';
import type { FeaturePolicy, FeatureFlagKey } from '@uth/features';

interface ProvidersWrapperProps {
  children: ReactNode;
  featurePolicies?: Record<FeatureFlagKey, FeaturePolicy>;
}

/**
 * Common providers wrapper component that wraps children with all necessary providers.
 * Prevents repetition of provider setup across different client components.
 */
export function ProvidersWrapper({ children, featurePolicies }: ProvidersWrapperProps) {
  // Initialize monetization store with server-loaded feature policies
  useEffect(() => {
    if (featurePolicies) {
      monetizationStore.setFeaturePolicies(featurePolicies);
    }
  }, [featurePolicies]);

  return (
    <FeatureGateProvider
      monetizationStore={monetizationStore}
      authStore={authStore}
      paymentStore={paymentStore}
    >
      {children}
    </FeatureGateProvider>
  );
}

ProvidersWrapper.displayName = 'ProvidersWrapper';
