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

// Export Firebase interop (escape hatches for direct Firebase access)
export { getAdminAuth, getAdminFirestore } from './public/firebase-interop';
export type { Auth, Firestore } from './public/firebase-interop';

// DO NOT export:
// - Internal provider interfaces (AuthServerProvider)
// - Provider adapters (FirebaseAuthServerAdapter)
// - Provider resolver functions
