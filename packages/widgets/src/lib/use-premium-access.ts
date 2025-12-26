'use client';

import { useFeatureGateContext } from './feature-gate-context';
import { FEATURES } from '@uth/features';

/**
 * MobX-based hook for checking premium access
 *
 * This hook provides a reactive way to check if the current user has premium access.
 * It automatically updates when the monetization store changes.
 *
 * @returns Object with premium access state and utility functions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { hasPremiumAccess, isPremium, handleUpgrade } = usePremiumAccess();
 *
 *   if (!hasPremiumAccess) {
 *     return <button onClick={handleUpgrade}>Upgrade to Premium</button>;
 *   }
 *
 *   return <PremiumContent />;
 * }
 * ```
 */
export function usePremiumAccess() {
  const { monetizationStore, authStore, paymentStore } =
    useFeatureGateContext();

  // Check access to any premium feature (using EXCEL_EXPORT as representative)
  const hasPremiumAccess = monetizationStore.hasFeatureAccess(
    FEATURES.EXCEL_EXPORT,
  );

  const isLoading = monetizationStore.isLoading;
  const isAuthenticated = monetizationStore.isAuthenticated || !!authStore.user;

  /**
   * Handle upgrade action
   * - If not authenticated: redirect to sign-in
   * - If authenticated: open payment modal
   */
  const handleUpgrade = () => {
    if (!isAuthenticated) {
      // Redirect to Clerk sign-in page
      window.location.href = '/claim';
    } else {
      paymentStore.openPaymentModal();
    }
  };

  return {
    /**
     * Whether the user has premium access
     */
    hasPremiumAccess,

    /**
     * Alias for hasPremiumAccess
     */
    isPremium: hasPremiumAccess,

    /**
     * Whether the subscription check is loading
     */
    isLoading,

    /**
     * Whether the user is authenticated
     */
    isAuthenticated,

    /**
     * Function to trigger upgrade flow
     */
    handleUpgrade,

    /**
     * Direct access to monetization store (for advanced use cases)
     */
    monetizationStore,
  };
}
