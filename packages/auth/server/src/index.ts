/**
 * @uth/auth-server
 * Provider-agnostic server-side authentication SDK
 *
 * This package provides a stable API for authentication that hides
 * provider implementation details (Firebase, Clerk, etc.)
 */

// Export domain types
export type {
  AuthUser,
  AuthSession,
  AuthTokenClaims,
  AuthResult,
  Subscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
  CreateUserData,
  UpdateUserMetadataData,
  UserListResult,
  UserWebhookEventData,
  WebhookVerificationResult,
} from './types/domain';
export { AuthError, AuthErrorCode, SubscriptionStatus } from './types/domain';

// Export public operations
export {
  verifyToken,
  getSessionFromRequest,
  requireAuth,
  requireAdmin,
  getUser,
  deleteUser,
  setCustomClaims,
  getCustomClaims,
  createCustomToken,
  isAuthConfigured,
  // Subscription operations
  getSubscription,
  hasSubscription,
  createSubscription,
  updateSubscription,
  // User management operations
  createUser,
  getUsersByEmail,
  updateUserMetadata,
  // Webhook operations
  verifyWebhook,
  // Current user operations
  getCurrentUser,
} from './public/auth-operations';

// DO NOT export:
// - Internal provider interfaces (AuthServerProvider)
// - Provider adapters (FirebaseAuthServerAdapter)
// - Provider resolver functions
// - Firebase interop (removed - use SDK operations instead)
