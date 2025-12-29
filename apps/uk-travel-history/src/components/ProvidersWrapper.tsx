'use client';

import { ReactNode } from 'react';
import { FeatureGateProvider } from '@uth/widgets';
import { authStore, monetizationStore, paymentStore } from '@uth/stores';

interface ProvidersWrapperProps {
  children: ReactNode;
}

/**
 * Common providers wrapper component that wraps children with all necessary providers.
 * Prevents repetition of provider setup across different client components.
 */
export function ProvidersWrapper({ children }: ProvidersWrapperProps) {
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
