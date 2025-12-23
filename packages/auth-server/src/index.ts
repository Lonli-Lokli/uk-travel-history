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
} from './types/domain';
export { AuthError, AuthErrorCode } from './types/domain';

// Export public operations
export {
  verifyToken,
  getSessionFromRequest,
  requireAuth,
  getUser,
  deleteUser,
  setCustomClaims,
  getCustomClaims,
  createCustomToken,
  isAuthConfigured,
} from './public/auth-operations';

// DO NOT export:
// - Internal provider interfaces (AuthServerProvider)
// - Provider adapters (FirebaseAuthServerAdapter)
// - Provider resolver functions
// - Firebase/Stripe types or SDK instances
