/**
 * Provider resolver for trip storage
 * Routes to appropriate storage backend based on user context
 */

import type { TripStoreProvider } from './providers/interface';
import { SupabaseTripAdapter } from './providers/supabase-adapter';
import { CacheTripAdapter } from './providers/cache-adapter';
import type { TripStoreContext } from '../types/domain';
import { TripStoreError, TripStoreErrorCode } from '../types/domain';

// Singleton instances (lazy initialization)
let supabaseAdapter: SupabaseTripAdapter | null = null;
let cacheAdapter: CacheTripAdapter | null = null;

/**
 * Get the Supabase trip adapter (singleton)
 */
function getSupabaseAdapter(): SupabaseTripAdapter {
  if (!supabaseAdapter) {
    supabaseAdapter = new SupabaseTripAdapter();
  }
  return supabaseAdapter;
}

/**
 * Get the cache trip adapter (singleton)
 */
function getCacheAdapter(): CacheTripAdapter {
  if (!cacheAdapter) {
    cacheAdapter = new CacheTripAdapter();
  }
  return cacheAdapter;
}

/**
 * Determine whether to use persistent storage based on context
 * @param context Trip store context
 * @returns true if persistent storage should be used
 */
export function shouldUsePersistentStorage(context: TripStoreContext): boolean {
  return context.isPaidUser && context.userId !== null;
}

/**
 * Get the appropriate trip store provider based on context
 * @param context Trip store context
 * @returns Trip store provider instance
 */
export function getTripStoreProvider(context: TripStoreContext): TripStoreProvider {
  if (shouldUsePersistentStorage(context)) {
    return getSupabaseAdapter();
  }
  return getCacheAdapter();
}

/**
 * Get the identifier to use for trip operations
 * For paid users, this is the user ID
 * For free/anonymous users, this is the session ID
 * @param context Trip store context
 * @returns Identifier string
 * @throws TripStoreError if no valid identifier is available
 */
export function getIdentifier(context: TripStoreContext): string {
  if (shouldUsePersistentStorage(context)) {
    if (!context.userId) {
      throw new TripStoreError(
        TripStoreErrorCode.CONFIG_ERROR,
        'User ID required for persistent storage',
      );
    }
    return context.userId;
  }

  if (!context.sessionId) {
    throw new TripStoreError(
      TripStoreErrorCode.SESSION_ERROR,
      'Session ID required for cache storage',
    );
  }
  return context.sessionId;
}

/**
 * Get the cache adapter directly (for migration operations)
 */
export function getCacheAdapterDirect(): CacheTripAdapter {
  return getCacheAdapter();
}

/**
 * Reset provider instances (for testing)
 */
export function resetProviders(): void {
  supabaseAdapter = null;
  cacheAdapter = null;
}
