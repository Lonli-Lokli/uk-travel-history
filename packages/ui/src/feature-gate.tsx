/**
 * FeatureGate Component
 *
 * Wraps premium features and conditionally renders based on subscription tier.
 *
 * IMPORTANT: This is a UX component, NOT a security control.
 * Real security is enforced by server middleware.
 *
 * @example
 * // Hide button for free users
 * <FeatureGate feature={FEATURES.EXCEL_EXPORT} mode="hide">
 *   <ExportButton />
 * </FeatureGate>
 *
 * @example
 * // Show payment modal on click
 * <FeatureGate feature={FEATURES.EXCEL_EXPORT} mode="paywall">
 *   <ExportButton />
 * </FeatureGate>
 */

'use client';

import React, { ReactNode, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { FeatureId } from '@uth/features';

// We'll import stores dynamically to avoid circular dependencies
// and handle cases where they might not be available
let subscriptionStore: any;
let authStore: any;
let paymentStore: any;
let uiStore: any;

// Lazy load stores
const getStores = async () => {
  if (!subscriptionStore) {
    const stores = await import('@uth/stores');
    subscriptionStore = stores.subscriptionStore;
    authStore = stores.authStore;
    paymentStore = stores.paymentStore;
    uiStore = stores.uiStore;
  }
  return { subscriptionStore, authStore, paymentStore, uiStore };
};

// Initialize stores on client
if (typeof window !== 'undefined') {
  getStores();
}

export type FeatureGateMode = 'hide' | 'disable' | 'blur' | 'paywall';

export interface FeatureGateProps {
  /**
   * Feature ID from feature registry
   */
  feature: FeatureId;

  /**
   * How to render when access is denied
   * - hide: Don't render children (return null)
   * - disable: Render but disable interaction (blur + no-op click)
   * - blur: Apply CSS blur effect
   * - paywall: Show payment modal on interaction
   */
  mode?: FeatureGateMode;

  /**
   * Content to render when user has access
   */
  children: ReactNode;

  /**
   * Custom fallback to show when access denied (optional)
   * Only used in 'hide' mode
   */
  fallback?: ReactNode;

  /**
   * Additional CSS class for wrapper
   */
  className?: string;

  /**
   * Optional callback when user clicks to upgrade
   */
  onUpgradeClick?: () => void;
}

/**
 * Internal component (will be wrapped with observer)
 */
function FeatureGateInternal({
  feature,
  mode = 'hide',
  children,
  fallback,
  className = '',
  onUpgradeClick,
}: FeatureGateProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Initialize stores
  React.useEffect(() => {
    getStores().then(() => setIsLoading(false));
  }, []);

  // Show loading skeleton while stores load
  if (isLoading || !subscriptionStore) {
    return <div className="animate-pulse h-10 bg-gray-200 rounded" />;
  }

  // Check if user has access to this feature
  const hasAccess = subscriptionStore.hasAccess(feature);
  const isAuthenticated = authStore?.user !== null;
  const isSubscriptionLoading = subscriptionStore.isLoading;

  // Show loading state while subscription loads
  if (isSubscriptionLoading) {
    return <div className="animate-pulse h-10 bg-gray-200 rounded" />;
  }

  // User has access - render children normally
  if (hasAccess) {
    return <>{children}</>;
  }

  // Handle upgrade click
  const handleUpgradeClick = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else if (!isAuthenticated) {
      // Show login modal if available
      uiStore?.openLoginModal?.();
    } else {
      // Show payment modal
      paymentStore?.openPaymentModal?.();
    }
  };

  // User denied access - handle based on mode
  switch (mode) {
    case 'hide':
      // Don't render children, show fallback if provided
      return fallback ? <>{fallback}</> : null;

    case 'disable':
      // Render children but prevent interaction
      return (
        <div
          className={`relative ${className}`}
          style={{ pointerEvents: 'none', opacity: 0.5 }}
          aria-disabled="true"
        >
          {children}
        </div>
      );

    case 'blur':
      // Render with blur effect
      return (
        <div
          className={`relative ${className}`}
          style={{ filter: 'blur(4px)', pointerEvents: 'none' }}
          aria-disabled="true"
        >
          {children}
        </div>
      );

    case 'paywall':
      // Show upgrade prompt on interaction
      return (
        <div
          className={`relative cursor-pointer ${className}`}
          onClick={handleUpgradeClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleUpgradeClick();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={isAuthenticated ? 'Upgrade to premium' : 'Sign in to access'}
        >
          <div style={{ filter: 'blur(2px)', pointerEvents: 'none' }}>
            {children}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="bg-white px-4 py-2 rounded-lg shadow-lg">
              <p className="text-sm font-medium">
                {isAuthenticated ? 'Premium Feature' : 'Sign in to access'}
              </p>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// Export wrapped with observer
export const FeatureGate = observer(FeatureGateInternal);

FeatureGate.displayName = 'FeatureGate';
