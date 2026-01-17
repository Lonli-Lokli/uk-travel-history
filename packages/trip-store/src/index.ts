/**
 * @uth/trip-store
 * Generic entity storage abstraction that routes to appropriate backend
 *
 * - Paid users: Supabase (persistent)
 * - Free/anonymous users: Cache (ephemeral, TTL expires at end of day)
 *
 * Provides:
 * - Trip store (backward compatible)
 * - Goal store (new)
 * - Generic entity store factories (for custom entities)
 */

// ============================================================================
// TRIP STORE (Backward Compatible)
// ============================================================================

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
} from './public/trip-operations';

// Export migration utilities
export {
  migrateTripsFromCache,
  hasCachedTrips,
  getCachedTripCount,
  clearCachedTrips,
  type MigrationResult,
} from './public/migration';

// ============================================================================
// GOAL STORE
// ============================================================================

// Export goal-specific operations
export {
  createGoalStoreContext,
  getGoals,
  getGoalById,
  createGoalEntity,
  updateGoalEntity,
  deleteGoalEntity,
  bulkCreateGoals,
  goalStoreUsesPersistentStorage,
  migrateGoalsFromCache,
  hasCachedGoals,
  getCachedGoalCount,
  clearCachedGoals,
  GoalStoreError,
  GoalStoreErrorCode,
} from './stores/goal-store';
export type { GoalStoreContext } from './stores/goal-store';

// ============================================================================
// GENERIC ENTITY STORE (Advanced Usage)
// ============================================================================

// Export generic factories for custom entity types
export { createEntityStoreOperations } from './public/generic-operations';
export { createMigrationFunctions } from './public/generic-migration';
export { createCacheAdapter } from './internal/providers/generic-cache-adapter';
export { createSupabaseAdapter } from './internal/providers/generic-supabase-adapter';

// Export generic types
export type {
  BaseEntityData,
  CreateEntityData,
  UpdateEntityData,
  EntityStoreProvider,
  EntityStoreContext,
  EntityStoreConfig,
  MigrationResult as GenericMigrationResult,
} from './types/generic';
export { EntityStoreError, EntityStoreErrorCode } from './types/generic';

// ============================================================================
// SESSION UTILITIES (Shared)
// ============================================================================

// Session management (re-exported for API routes)
export {
  getSessionId,
  createSessionId,
  setSessionCookie,
  clearSessionCookie,
  getEndOfDayTTLSeconds,
  getSessionIdFromHeaders,
} from './internal/session-manager';

// NOTE: Server-only exports are also available in './server'
// Import from '@uth/trip-store/server' for server-side code
// This prevents accidental imports in client components

// DO NOT export:
// - Internal provider interfaces (TripStoreProvider)
// - Provider adapters directly (SupabaseTripAdapter, CacheTripAdapter)
// - Provider resolver internals
