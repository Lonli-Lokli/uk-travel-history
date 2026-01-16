/**
 * @uth/trip-store
 * Trip storage abstraction that routes to appropriate backend
 *
 * - Paid users: Supabase (persistent)
 * - Free/anonymous users: Cache (ephemeral, TTL expires at end of day)
 */

// Export error types
export { TripStoreError, TripStoreErrorCode } from './types/domain';
export type { TripStoreContext } from './types/domain';

// Export public trip operations
export {
  createTripStoreContext,
  getTrips,
  getTripById,
  createTrip,
  updateTrip,
  deleteTrip,
  bulkCreateTrips,
  usesPersistentStorage,
  // Session management (re-exported for API routes)
  getSessionId,
  createSessionId,
  setSessionCookie,
  clearSessionCookie,
} from './public/trip-operations';

// Export migration utilities
export {
  migrateTripsFromCache,
  hasCachedTrips,
  getCachedTripCount,
  clearCachedTrips,
  type MigrationResult,
} from './public/migration';

// Export session utilities directly
export { getEndOfDayTTLSeconds, getSessionIdFromHeaders } from './internal/session-manager';

// NOTE: Server-only exports (getSessionIdFromHeaders) are in './server'
// Import from '@uth/trip-store/server' for server-side code
// This prevents accidental imports in client components

// DO NOT export:
// - Internal provider interfaces (TripStoreProvider)
// - Provider adapters directly (SupabaseTripAdapter, CacheTripAdapter)
// - Provider resolver internals
