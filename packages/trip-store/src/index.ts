/**
 * @uth/trip-store
 * Generic entity storage abstraction that routes to appropriate backend
 *
 * - Paid users: Supabase (persistent)
 * - Free/anonymous users: Cache (ephemeral, TTL expires at end of day)
 *
 * Provides:
 * - Trip store (uses domain types)
 * - Goal store (uses domain types)
 * - Generic entity store factories (for custom entities)
 */

// ============================================================================
// DOMAIN TYPES (Business Logic)
// ============================================================================

// Trip domain types
export type {
  Trip,
  CreateTripInput,
  UpdateTripInput,
  BulkCreateTripsInput,
} from './types/trip-domain';

// Goal domain types
export type {
  TrackingGoal,
  CreateGoalInput,
  UpdateGoalInput,
  GoalType,
  GoalJurisdiction,
} from './types/goal-domain';

// ============================================================================
// TRIP STORE
// ============================================================================

// Export trip store operations
export {
  createTripStoreContext,
  getTrips,
  getTripById,
  createTripEntity,
  updateTripEntity,
  deleteTripEntity,
  bulkCreateTrips,
  tripStoreUsesPersistentStorage,
  migrateTripsFromCache,
  hasCachedTrips,
  getCachedTripCount,
  clearCachedTrips,
  TripStoreError,
  TripStoreErrorCode,
} from './stores/trip-store';
export type { TripStoreContext } from './stores/trip-store';

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
