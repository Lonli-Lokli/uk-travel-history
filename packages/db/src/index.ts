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
} from './types/domain';

export {
  DbError,
  DbErrorCode,
  PurchaseIntentStatus,
  SubscriptionTier,
  SubscriptionStatus,
} from './types/domain';

// Export client factory functions
export { createUserScopedClient, createAdminClient, checkUserHasPremiumAccess } from './lib/client-factory';

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
} from './public/db-operations';

// Export testing utilities (for internal use only - consumers should use public API)
export { injectDbProvider, resetDbProvider } from './internal/provider-resolver';
export { MockDbAdapter } from './internal/providers/mock-adapter';

// DO NOT export:
// - Internal provider interfaces (DbProvider)
// - Provider adapters (SupabaseDbAdapter)
// - Supabase types (Database)
// - Supabase client functions (these are now internal to the adapter)
