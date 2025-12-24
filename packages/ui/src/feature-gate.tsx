'use client';

import { observer } from 'mobx-react-lite';
import { type ReactNode, type MouseEvent } from 'react';
import type { FeatureId } from '@uth/features';

export type RenderMode = 'hide' | 'disable' | 'blur' | 'paywall';

export interface FeatureGateProps {
  /**
   * Feature ID to check access for
   */
  feature: FeatureId;

  /**
   * Render mode when access is denied
   * - hide: Don't render children (return null)
   * - disable: Render but disable interaction (blur + click handler)
   * - blur: Render with CSS blur effect
   * - paywall: Show upgrade modal on click
   */
  mode?: RenderMode;

  /**
   * Custom fallback component when access is denied
   * Only used when mode is 'hide'
   */
  fallback?: ReactNode;

  /**
   * Children to render when access is granted
   */
  children: ReactNode;

  /**
   * Optional callback when user clicks on a disabled/gated feature
   */
  onUpgradeClick?: () => void;

  /**
   * MobX monetization store instance
   * Must be provided from parent
   */
  monetizationStore: {
    hasFeatureAccess: (featureId: FeatureId) => boolean;
    isLoading: boolean;
    isAuthenticated: boolean;
  };

  /**
   * Optional auth store for login modal
   */
  authStore?: {
    user: unknown;
  };

  /**
   * Optional payment store for upgrade modal
   */
  paymentStore?: {
    openPaymentModal: () => void;
  };

  /**
   * Optional custom login handler
   */
  onLoginClick?: () => void;
}

/**
 * FeatureGate Component
 *
 * Conditionally renders content based on user's subscription tier.
 * Provides consistent UX for feature gating throughout the application.
 *
 * @example
 * ```tsx
 * // Hide content if no access
 * <FeatureGate feature={FEATURES.EXCEL_EXPORT} mode="hide">
 *   <ExportButton />
 * </FeatureGate>
 *
 * // Disable interaction with blur
 * <FeatureGate feature={FEATURES.ADVANCED_ANALYTICS} mode="disable">
 *   <AnalyticsPanel />
 * </FeatureGate>
 *
 * // Show custom fallback
 * <FeatureGate
 *   feature={FEATURES.CLOUD_SYNC}
 *   mode="hide"
 *   fallback={<UpgradePrompt />}
 * >
 *   <SyncButton />
 * </FeatureGate>
 * ```
 */
const FeatureGateComponent = ({
  feature,
  mode = 'hide',
  fallback,
  children,
  onUpgradeClick,
  monetizationStore,
  authStore,
  paymentStore,
  onLoginClick,
}: FeatureGateProps) => {
  // Show loading state while checking subscription
  if (monetizationStore.isLoading) {
    if (mode === 'hide') {
      return fallback ? <>{fallback}</> : null;
    }
    // For other modes, show blurred content while loading
    return (
      <div className="relative opacity-50 pointer-events-none">
        {children}
      </div>
    );
  }

  // Check if user has access to this feature
  const hasAccess = monetizationStore.hasFeatureAccess(feature);

  // If user has access, render children normally
  if (hasAccess) {
    return <>{children}</>;
  }

  // Access denied - handle based on mode
  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if user is authenticated
    const isAuthenticated =
      monetizationStore.isAuthenticated || (authStore && !!authStore.user);

    if (!isAuthenticated) {
      // User not logged in - show login modal
      if (onLoginClick) {
        onLoginClick();
      }
      return;
    }

    // User is authenticated but doesn't have access - show upgrade modal
    if (mode === 'paywall' || mode === 'disable' || mode === 'blur') {
      if (onUpgradeClick) {
        onUpgradeClick();
      } else if (paymentStore) {
        paymentStore.openPaymentModal();
      }
    }
  };

  switch (mode) {
    case 'hide':
      return fallback ? <>{fallback}</> : null;

    case 'blur':
      return (
        <div className="relative">
          <div className="blur-sm select-none pointer-events-none" aria-hidden="true">
            {children}
          </div>
          <div
            className="absolute inset-0 cursor-pointer flex items-center justify-center"
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleClick(e as unknown as MouseEvent);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Upgrade to access this feature"
          >
            <div className="bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Premium Feature</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'disable':
      return (
        <div className="relative">
          <div className="blur-[2px] select-none pointer-events-none opacity-60" aria-hidden="true">
            {children}
          </div>
          <div
            className="absolute inset-0 cursor-pointer hover:bg-black/5 transition-colors rounded flex items-center justify-center"
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleClick(e as unknown as MouseEvent);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Upgrade to access this feature"
          >
            <div className="bg-amber-500/90 text-white px-3 py-1.5 rounded-md shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs font-semibold">Premium</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'paywall':
      return (
        <div
          className="cursor-pointer"
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleClick(e as unknown as MouseEvent);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Upgrade to access this feature"
        >
          {children}
        </div>
      );

    default:
      return null;
  }
};

// Export as observer to make it reactive to MobX changes
export const FeatureGate = observer(FeatureGateComponent);
