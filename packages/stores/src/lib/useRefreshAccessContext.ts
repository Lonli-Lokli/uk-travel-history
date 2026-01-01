/**
 * Client-side hook to refresh access context after billing/auth changes
 *
 * This hook provides a mechanism to refresh the server-authoritative access context
 * when subscription tier changes (e.g., after Stripe checkout or billing portal return)
 *
 * HOW IT WORKS:
 * 1. Trigger router.refresh() to re-run server components
 * 2. Server re-computes access context via loadAccessContext()
 * 3. Updated context flows to Providers and hydrates stores
 * 4. UI updates with new tier/entitlements
 */

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Hook to refresh access context from server
 *
 * Usage:
 * ```tsx
 * const refreshAccess = useRefreshAccessContext();
 *
 * // After Stripe checkout success
 * refreshAccess(); // Triggers server component re-render (not awaitable)
 *
 * // After billing portal return
 * useEffect(() => {
 *   if (searchParams.get('session_id')) {
 *     refreshAccess();
 *   }
 * }, [searchParams]);
 * ```
 */
export function useRefreshAccessContext() {
  const router = useRouter();

  return useCallback(() => {
    // Refresh the current route to re-run server components
    // This will re-execute loadAccessContext() and update the access context
    // Note: router.refresh() is synchronous and triggers a re-render
    // It is NOT awaitable - the refresh happens asynchronously in the background
    router.refresh();
  }, [router]);
}
