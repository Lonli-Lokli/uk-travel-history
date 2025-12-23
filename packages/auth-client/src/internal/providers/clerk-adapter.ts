/**
 * Clerk implementation of AuthClientProvider
 */

import { useUser, useAuth, useClerk } from '@clerk/nextjs';
import { logger } from '@uth/utils';
import type { AuthClientProvider, AuthClientProviderConfig } from './interface';
import type {
  AuthUser,
  EmailPasswordCredentials,
  SignInResult,
  AuthState,
  AuthStateChangeCallback,
} from '../../types/domain';
import { AuthError, AuthErrorCode } from '../../types/domain';

/**
 * Clerk client adapter
 *
 * Note: Clerk uses a React hook-based architecture, so some methods
 * are implemented as stubs that throw errors directing users to use hooks.
 * This adapter primarily serves to:
 * 1. Provide passkey support check
 * 2. Normalize Clerk user data to our domain types
 * 3. Provide error mapping
 */
export class ClerkAuthClientAdapter implements AuthClientProvider {
  private configured = false;

  initialize(config: AuthClientProviderConfig): void {
    // Clerk is initialized via ClerkProvider at app level
    // This is just a configuration check
    if (typeof window === 'undefined') {
      return;
    }

    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (!publishableKey) {
      logger.warn(
        'Clerk publishable key missing. ' +
          'Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable.',
      );
      return;
    }

    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Get current user - Note: In Clerk architecture, use useUser() hook instead
   */
  getCurrentUser(): AuthUser | null {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'getCurrentUser is not available with Clerk. Use the useAuth() hook from @uth/auth-client instead.',
    );
  }

  /**
   * Sign in with email/password - Note: In Clerk architecture, use Clerk UI components
   */
  async signInWithEmailPassword(
    credentials: EmailPasswordCredentials,
  ): Promise<SignInResult> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'signInWithEmailPassword is not available with Clerk. Use Clerk UI components (<SignIn />) or Clerk hooks instead.',
    );
  }

  /**
   * Sign out - Note: In Clerk architecture, use signOut from useClerk() hook
   */
  async signOut(): Promise<void> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'signOut is not available with Clerk. Use the signOut method from useClerk() hook instead.',
    );
  }

  /**
   * Get ID token - Note: In Clerk architecture, use getToken from useAuth() hook
   */
  async getIdToken(forceRefresh = false): Promise<string> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'getIdToken is not available with Clerk. Use the getToken method from useAuth() hook instead.',
    );
  }

  /**
   * Subscribe to auth state changes - Note: Clerk handles this via React hooks
   */
  onAuthStateChanged(callback: AuthStateChangeCallback): () => void {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'onAuthStateChanged is not available with Clerk. Use the useAuth() hook which provides reactive state.',
    );
  }

  /**
   * Create user with email/password - Note: Use Clerk UI components
   */
  async createUserWithEmailPassword(
    credentials: EmailPasswordCredentials,
  ): Promise<SignInResult> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'createUserWithEmailPassword is not available with Clerk. Use Clerk UI components (<SignUp />) or payment flow which provisions users.',
    );
  }

  /**
   * Send password reset email - Note: Handled by Clerk UI
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'sendPasswordResetEmail is not available with Clerk. Use Clerk UI components which handle password reset.',
    );
  }

  /**
   * Update profile - Note: Use Clerk's user.update() method
   */
  async updateProfile(profile: {
    displayName?: string;
    photoURL?: string;
  }): Promise<void> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'updateProfile is not available with Clerk. Use user.update() from useUser() hook instead.',
    );
  }

  /**
   * Check if passkeys are supported
   * This is one of the few methods that works with Clerk
   */
  isPasskeySupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === 'function'
    );
  }

  /**
   * Sign in with passkey - Note: Handled by Clerk's passkey flow
   */
  async signInWithPasskey(): Promise<SignInResult> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'signInWithPasskey is not available with Clerk adapter. Use Clerk\'s built-in passkey authentication flow.',
    );
  }

  /**
   * Register passkey - Note: Handled by Clerk's passkey enrollment
   */
  async registerPasskey(displayName: string): Promise<SignInResult> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'registerPasskey is not available with Clerk adapter. Use Clerk\'s passkey enrollment flow in user settings.',
    );
  }

  /**
   * Register passkey anonymously - Note: Not supported, users must pay first
   */
  async registerPasskeyAnonymous(displayName?: string): Promise<SignInResult> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'registerPasskeyAnonymous is not available with Clerk. Users must complete payment before account creation.',
    );
  }

  /**
   * Helper: Normalize Clerk user to domain AuthUser
   * This can be used by components that have access to Clerk user object
   */
  static normalizeUser(clerkUser: any): AuthUser {
    return {
      uid: clerkUser.id,
      email: clerkUser.emailAddresses?.[0]?.emailAddress,
      emailVerified: clerkUser.emailAddresses?.[0]?.verification?.status === 'verified',
      displayName: clerkUser.fullName || clerkUser.username || undefined,
      photoURL: clerkUser.imageUrl || undefined,
      isAnonymous: false, // Clerk doesn't support anonymous users
    };
  }
}
