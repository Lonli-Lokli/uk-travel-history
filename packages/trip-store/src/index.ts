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
export { getEndOfDayTTLSeconds } from './internal/session-manager';

// DO NOT export:
// - Internal provider interfaces (TripStoreProvider)
// - Provider adapters directly (SupabaseTripAdapter, CacheTripAdapter)
// - Provider resolver internals
