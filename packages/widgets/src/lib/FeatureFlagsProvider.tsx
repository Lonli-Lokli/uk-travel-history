'use client';

import React, { ReactNode, useMemo } from 'react';
import {
  type FeatureFlagKey,
  FEATURE_KEYS,
} from '@uth/features';
import { useFeatureGateContext } from './feature-gate-context';

/**
 * Feature flags context value
 */
interface FeatureFlagsContextValue {
  isFeatureEnabled: (key: FeatureFlagKey) => boolean;
  flags: Record<FeatureFlagKey, boolean>;
}

/**
 * @deprecated FeatureFlagsProvider is no longer needed. Flags are now computed from user tier.
 * This component is kept for backward compatibility but does nothing.
 */
export function FeatureFlagsProvider({
  children,
}: {
  flags?: Record<FeatureFlagKey, boolean>;
  children: ReactNode;
}) {
  return <>{children}</>;
}

/**
 * Hook to access feature flags in client components
 * This hook computes flags based on the user's tier and feature policies
 * from the monetizationStore, rather than using a context provider.
 *
 * @returns FeatureFlagsContextValue with isFeatureEnabled function and flags object
 *
 * @example
 * function MyComponent() {
 *   const { isFeatureEnabled } = useFeatureFlags();
 *
 *   if (isFeatureEnabled('firebase_auth_enabled')) {
 *     return <LoginButton />;
 *   }
 *
 *   return null;
 * }
 */
export function useFeatureFlags(): FeatureFlagsContextValue {
  const { monetizationStore } = useFeatureGateContext();

  // Compute flags based on user tier and feature policies
  const flags = useMemo(() => {
    const result = {} as Record<FeatureFlagKey, boolean>;

    // Iterate through all feature keys and compute access
    for (const key of Object.values(FEATURE_KEYS)) {
      result[key] = monetizationStore.hasFeatureAccess(key);
    }

    return result;
  }, [monetizationStore]);

  return {
    isFeatureEnabled: (key: FeatureFlagKey) => {
      return monetizationStore.hasFeatureAccess(key);
    },
    flags,
  };
}

/**
 * Higher-order component to wrap components with feature flag check
 *
 * @param featureKey - The feature flag to check
 * @param Component - The component to render if feature is enabled
 * @param Fallback - Optional fallback component if feature is disabled
 *
 * @example
 * const PremiumFeature = withFeatureFlag(
 *   'excel_export_premium',
 *   ExcelExportButton,
 *   () => <div>Coming soon!</div>
 * );
 */
export function withFeatureFlag<P extends object>(
  featureKey: FeatureFlagKey,
  Component: React.ComponentType<P>,
  Fallback?: React.ComponentType<P>,
) {
  return function FeatureFlaggedComponent(props: P) {
    const { isFeatureEnabled } = useFeatureFlags();

    if (!isFeatureEnabled(featureKey)) {
      return Fallback ? <Fallback {...props} /> : null;
    }

    return <Component {...props} />;
  };
}
