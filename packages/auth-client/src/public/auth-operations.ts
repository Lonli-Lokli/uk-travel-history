/**
 * Public API for client-side authentication operations
 * Provider-agnostic interface for auth functionality
 */

import type {
  AuthUser,
  EmailPasswordCredentials,
  SignInResult,
  AuthStateChangeCallback,
} from '../types/domain';
import { getAuthProvider } from '../internal/provider-resolver';

/**
 * Get the current authenticated user
 * @returns Current user or null if not authenticated
 */
export function getCurrentUser(): AuthUser | null {
  const provider = getAuthProvider();
  return provider.getCurrentUser();
}

/**
 * Sign in with email and password
 * @param email - User's email address
 * @param password - User's password
 * @returns Sign-in result with user and token
 * @throws AuthError if sign-in fails
 */
export async function signIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  const provider = getAuthProvider();
  return provider.signInWithEmailPassword({ email, password });
}

/**
 * Sign out the current user
 * @throws AuthError if sign-out fails
 */
export async function signOut(): Promise<void> {
  const provider = getAuthProvider();
  return provider.signOut();
}

/**
 * Get the current user's ID token
 * This token can be sent to the server for authentication
 * @param forceRefresh - Whether to force refresh the token (default: false)
 * @returns ID token string
 * @throws AuthError if not authenticated or token retrieval fails
 */
export async function getIdToken(forceRefresh = false): Promise<string> {
  const provider = getAuthProvider();
  return provider.getIdToken(forceRefresh);
}

/**
 * Subscribe to authentication state changes
 * @param callback - Function to call when auth state changes
 * @returns Unsubscribe function to stop listening
 */
export function onAuthStateChanged(
  callback: AuthStateChangeCallback,
): () => void {
  const provider = getAuthProvider();
  return provider.onAuthStateChanged(callback);
}

/**
 * Create a new user account with email and password
 * @param email - User's email address
 * @param password - User's password
 * @returns Sign-in result with new user and token
 * @throws AuthError if account creation fails
 */
export async function createUser(
  email: string,
  password: string,
): Promise<SignInResult> {
  const provider = getAuthProvider();
  return provider.createUserWithEmailPassword({ email, password });
}

/**
 * Send a password reset email to the user
 * @param email - Email address to send reset link to
 * @throws AuthError if sending fails
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const provider = getAuthProvider();
  return provider.sendPasswordResetEmail(email);
}

/**
 * Update the current user's profile
 * @param profile - Profile data to update (displayName and/or photoURL)
 * @throws AuthError if update fails or user not authenticated
 */
export async function updateProfile(profile: {
  displayName?: string;
  photoURL?: string;
}): Promise<void> {
  const provider = getAuthProvider();
  return provider.updateProfile(profile);
}

/**
 * Check if auth is properly configured
 * @returns true if configured and ready to use
 */
export function isAuthConfigured(): boolean {
  try {
    const provider = getAuthProvider();
    return provider.isConfigured();
  } catch {
    return false;
  }
}

/**
 * Check if passkey/WebAuthn is supported in the browser
 * @returns true if passkeys are supported
 */
export function isPasskeySupported(): boolean {
  const provider = getAuthProvider();
  return provider.isPasskeySupported();
}

/**
 * Sign in with passkey
 * Uses WebAuthn/passkey authentication for secure, passwordless login
 * @returns Sign-in result with user and token
 * @throws AuthError if sign-in fails or passkeys not supported
 */
export async function signInWithPasskey(): Promise<SignInResult> {
  const provider = getAuthProvider();
  return provider.signInWithPasskey();
}

/**
 * Register a new passkey
 * Creates a new user account with passkey authentication
 * @param displayName - Display name for the passkey (shown in passkey manager)
 * @returns Sign-in result with new user and token
 * @throws AuthError if registration fails or passkeys not supported
 */
export async function registerPasskey(
  displayName: string,
): Promise<SignInResult> {
  const provider = getAuthProvider();
  return provider.registerPasskey(displayName);
}

/**
 * Register a new passkey anonymously (without email)
 * Creates a new user with passkey authentication, useful for post-payment flows
 * @param displayName - Optional display name for the passkey (defaults to generic name)
 * @returns Sign-in result with new user and token
 * @throws AuthError if registration fails or passkeys not supported
 */
export async function registerPasskeyAnonymous(
  displayName?: string,
): Promise<SignInResult> {
  const provider = getAuthProvider();
  return provider.registerPasskeyAnonymous(displayName);
}
