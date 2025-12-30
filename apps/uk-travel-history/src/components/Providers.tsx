'use client';

import { ReactNode, useEffect } from 'react';
import { FeatureGateProvider } from '@uth/widgets';
import { authStore, monetizationStore, paymentStore } from '@uth/stores';
import { type FeatureFlagKey } from '@uth/features';
import type { FeaturePolicy } from '@uth/features';

interface ProvidersProps {
  children: ReactNode;
  featurePolicies: Record<FeatureFlagKey, FeaturePolicy>;
}

/**
 * Unified providers component that initializes feature gate context.
 *
 * Initializes:
 * - Feature policies in monetization store (for tier-based access control)
 * - Feature gate context (provides stores to all child components)
 *
 * Note: Feature flags are no longer passed via provider. Instead, the useFeatureFlags
 * hook computes flags dynamically based on user tier and feature policies.
 */
export function Providers({ children, featurePolicies }: ProvidersProps) {
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

Providers.displayName = 'Providers';
