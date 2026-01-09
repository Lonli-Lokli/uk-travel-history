/**
 * @uth/db
 * Provider-agnostic database SDK
 *
 * This package provides a stable API for database operations that hides
 * provider implementation details (Supabase, etc.)
 */

// Export domain types
export type {
  User,
  CreateUserData,
  UpdateUserData,
  PurchaseIntent,
  CreatePurchaseIntentData,
  UpdatePurchaseIntentData,
  WebhookEvent,
  CreateWebhookEventData,
  FeaturePolicy,
  AccessContext,
  // New types for hydration
  FeaturePolicyData,
  PriceData,
  PricingData,
  // Goal types
  GoalType,
  GoalJurisdiction,
  TrackingGoalData,
  CreateTrackingGoalData,
  UpdateTrackingGoalData,
  GoalCalculationData,
  GoalMetricData,
  GoalWarningData,
  GoalTemplate,
  GoalTemplateWithAccess,
  // Trip types
  TripData,
  CreateTripData,
  UpdateTripData,
  BulkCreateTripsData,
  // Trip group types
  TripGroupData,
  CreateTripGroupData,
  UpdateTripGroupData,
} from './types/domain';

export {
  DbError,
  DbErrorCode,
  PurchaseIntentStatus,
  SubscriptionTier,
  SubscriptionStatus,
  UserRole,
} from './types/domain';

// Export public operations
export {
  isDbConfigured,
  keepalive,
  // User operations
  getUserByAuthId,
  getUserById,
  createUser,
  updateUserByAuthId,
  deleteUserByAuthId,
  // Purchase intent operations
  getPurchaseIntentById,
  getPurchaseIntentBySessionId,
  getPurchaseIntentsByAuthUserId,
  createPurchaseIntent,
  updatePurchaseIntent,
  // Webhook event operations
  hasWebhookEventBeenProcessed,
  recordWebhookEvent,
  // Feature policy operations
  getAllFeaturePolicies,
  getFeaturePolicyByKey,
  // Goal operations
  getUserGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  getGoalCount,
  // Goal template operations
  getGoalTemplates,
  // Trip operations
  getTrips,
  getTripsByGoal,
  getTripById,
  createTrip,
  bulkCreateTrips,
  updateTrip,
  deleteTrip,
  reorderTrips,
  // Trip group operations
  getTripGroups,
  getTripGroupById,
  createTripGroup,
  updateTripGroup,
  deleteTripGroup,
} from './public/db-operations';

// Export testing utilities (for internal use only - consumers should use public API)
export {
  injectDbProvider,
  resetDbProvider,
} from './internal/provider-resolver';
export { MockDbAdapter } from './internal/providers/mock-adapter';

// DO NOT export:
// - Internal provider interfaces (DbProvider)
// - Provider adapters (SupabaseDbAdapter)
// - Supabase types (Database)
// - Supabase client functions (these are now internal to the adapter)
