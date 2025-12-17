'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import {
  setCachedFlags,
  isFeatureEnabledClient,
  type FeatureFlagKey,
} from '@uth/features';

/**
 * Feature flags context
 */
interface FeatureFlagsContextValue {
  isFeatureEnabled: (key: FeatureFlagKey) => boolean;
  flags: Record<FeatureFlagKey, boolean>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(
  null
);

/**
 * Feature flags provider component
 * This should wrap your app at the root level
 *
 * @param flags - Feature flags from server (fetched via getAllFeatureFlags)
 * @param children - React children
 *
 * @example
 * // In layout.tsx (server component)
 * const flags = await getAllFeatureFlags(userId);
 *
 * return (
 *   <FeatureFlagsProvider flags={flags}>
 *     {children}
 *   </FeatureFlagsProvider>
 * );
 */
export function FeatureFlagsProvider({
  flags,
  children,
}: {
  flags: Record<FeatureFlagKey, boolean>;
  children: ReactNode;
}) {
  // Cache flags on mount
  React.useEffect(() => {
    setCachedFlags(flags);
  }, [flags]);

  const contextValue: FeatureFlagsContextValue = {
    isFeatureEnabled: isFeatureEnabledClient,
    flags,
  };

  return (
    <FeatureFlagsContext.Provider value={contextValue}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Hook to access feature flags in client components
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
  const context = useContext(FeatureFlagsContext);

  if (!context) {
    // Fallback: return a safe default that disables all features
    console.warn(
      'useFeatureFlags called outside FeatureFlagsProvider, defaulting all flags to false'
    );
    return {
      isFeatureEnabled: () => false,
      flags: {} as Record<FeatureFlagKey, boolean>,
    };
  }

  return context;
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
  Fallback?: React.ComponentType<P>
) {
  return function FeatureFlaggedComponent(props: P) {
    const { isFeatureEnabled } = useFeatureFlags();

    if (!isFeatureEnabled(featureKey)) {
      return Fallback ? <Fallback {...props} /> : null;
    }

    return <Component {...props} />;
  };
}
