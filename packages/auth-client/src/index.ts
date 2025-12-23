/**
 * @uth/auth-client
 * Provider-agnostic client-side authentication SDK
 *
 * This package provides a stable API for authentication that hides
 * provider implementation details (Firebase, Clerk, etc.)
 */

// Export domain types
export type {
  AuthUser,
  EmailPasswordCredentials,
  SignInResult,
  AuthState,
  AuthStateChangeCallback,
} from './types/domain';
export { AuthError, AuthErrorCode } from './types/domain';

// Export public operations
export {
  getCurrentUser,
  signIn,
  signOut,
  getIdToken,
  onAuthStateChanged,
  createUser,
  sendPasswordResetEmail,
  updateProfile,
  isAuthConfigured,
} from './public/auth-operations';

// Export React hook
export { useAuth } from './public/use-auth';

// Export Firebase interop (escape hatches for direct Firebase access)
export {
  getAuthInstance,
  getFunctionsInstance,
  auth,
} from './public/firebase-interop';
export type { Auth, Functions } from './public/firebase-interop';

// DO NOT export:
// - Internal provider interfaces (AuthClientProvider)
// - Provider adapters (FirebaseAuthClientAdapter)
// - Provider resolver functions
