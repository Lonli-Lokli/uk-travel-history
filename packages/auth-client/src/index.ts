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

// DO NOT export:
// - Internal provider interfaces (AuthClientProvider)
// - Provider adapters (FirebaseAuthClientAdapter)
// - Provider resolver functions
// - Firebase/Clerk types or SDK instances
