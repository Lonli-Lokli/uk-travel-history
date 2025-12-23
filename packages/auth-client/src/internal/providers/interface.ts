/**
 * Provider interface for client-side authentication
 */

import type {
  AuthUser,
  EmailPasswordCredentials,
  SignInResult,
  AuthStateChangeCallback,
} from '../../types/domain';

/**
 * Configuration for the auth provider
 */
export interface AuthClientProviderConfig {
  /** Provider type (for future extensibility) */
  type?: 'firebase' | 'clerk' | 'custom';
  /** Provider-specific configuration */
  options?: Record<string, unknown>;
}

/**
 * Interface that all client-side auth providers must implement
 */
export interface AuthClientProvider {
  /**
   * Initialize the provider with configuration
   * @throws AuthError if initialization fails
   */
  initialize(config: AuthClientProviderConfig): Promise<void> | void;

  /**
   * Check if the provider is properly configured and ready to use
   */
  isConfigured(): boolean;

  /**
   * Get the current authenticated user
   * @returns Current user or null if not authenticated
   */
  getCurrentUser(): AuthUser | null;

  /**
   * Sign in with email and password
   * @param credentials - Email and password
   * @returns Sign-in result with user and token
   * @throws AuthError if sign-in fails
   */
  signInWithEmailPassword(
    credentials: EmailPasswordCredentials,
  ): Promise<SignInResult>;

  /**
   * Sign out the current user
   * @throws AuthError if sign-out fails
   */
  signOut(): Promise<void>;

  /**
   * Get the current user's ID token
   * @param forceRefresh - Whether to force refresh the token
   * @returns ID token string
   * @throws AuthError if not authenticated or token retrieval fails
   */
  getIdToken(forceRefresh?: boolean): Promise<string>;

  /**
   * Subscribe to auth state changes
   * @param callback - Function to call when auth state changes
   * @returns Unsubscribe function
   */
  onAuthStateChanged(callback: AuthStateChangeCallback): () => void;

  /**
   * Create a new user with email and password
   * @param credentials - Email and password
   * @returns Sign-in result with new user and token
   * @throws AuthError if account creation fails
   */
  createUserWithEmailPassword(
    credentials: EmailPasswordCredentials,
  ): Promise<SignInResult>;

  /**
   * Send password reset email
   * @param email - Email address
   * @throws AuthError if sending fails
   */
  sendPasswordResetEmail(email: string): Promise<void>;

  /**
   * Update user profile
   * @param profile - Profile data to update
   * @throws AuthError if update fails
   */
  updateProfile(profile: {
    displayName?: string;
    photoURL?: string;
  }): Promise<void>;

  /**
   * Check if passkey/WebAuthn is supported in the browser
   * @returns true if passkeys are supported
   */
  isPasskeySupported(): boolean;

  /**
   * Sign in with passkey
   * @throws AuthError if sign-in fails or passkeys not supported
   */
  signInWithPasskey(): Promise<SignInResult>;

  /**
   * Register a new passkey for the current user or create new user
   * @param displayName - Display name for the passkey
   * @throws AuthError if registration fails or passkeys not supported
   */
  registerPasskey(displayName: string): Promise<SignInResult>;

  /**
   * Register a new passkey anonymously (without email)
   * Creates a new user with passkey authentication
   * @param displayName - Display name for the passkey (optional, defaults to generic name)
   * @throws AuthError if registration fails or passkeys not supported
   */
  registerPasskeyAnonymous(displayName?: string): Promise<SignInResult>;
}
