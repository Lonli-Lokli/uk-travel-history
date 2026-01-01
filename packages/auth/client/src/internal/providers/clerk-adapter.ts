/**
 * Clerk implementation of AuthClientProvider
 */

import { logger } from '@uth/utils';
import type { AuthClientProvider, AuthClientProviderConfig } from './interface';
import type {
  AuthUser,
  EmailPasswordCredentials,
  SignInResult,
  AuthStateChangeCallback,
} from '../../types/domain';
import { AuthError, AuthErrorCode } from '../../types/domain';

/**
 * Clerk client adapter
 *
 * Uses the global Clerk instance (window.Clerk) which is initialized by ClerkProvider.
 * Provides methods to access Clerk functionality in a provider-agnostic way.
 *
 * Note: Some methods (like sign-in UI) are better handled through Clerk components
 * and hooks, so they throw errors directing users to the appropriate approach.
 */
export class ClerkAuthClientAdapter implements AuthClientProvider {
  private configured = false;

  // Used only to support onAuthStateChanged waiting for Clerk
  private clerkReadyPromise?: Promise<any>;

  initialize(_config: AuthClientProviderConfig): void {
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

  /**
   * Get the Clerk instance from window
   * @private
   */
  private getClerk(): any {
    if (typeof window === 'undefined') {
      throw new AuthError(
        AuthErrorCode.CONFIG_ERROR,
        'Clerk is only available in browser environment',
      );
    }

    const clerk = (window as any).Clerk;

    if (!clerk) {
      throw new AuthError(
        AuthErrorCode.CONFIG_ERROR,
        'Clerk is not initialized. Ensure ClerkProvider is mounted in your app.',
      );
    }

    return clerk;
  }

  /**
   * Wait for Clerk to be available and loaded.
   * Used ONLY by onAuthStateChanged to avoid false "logged out" states.
   */
  private getClerkReady(timeoutMs = 8000): Promise<any> {
    if (typeof window === 'undefined') {
      return Promise.reject(
        new AuthError(
          AuthErrorCode.CONFIG_ERROR,
          'Clerk is only available in browser environment',
        ),
      );
    }

    if (this.clerkReadyPromise) return this.clerkReadyPromise;

    this.clerkReadyPromise = (async () => {
      const start = Date.now();

      // Wait for window.Clerk to exist
      while (!(window as any).Clerk) {
        if (Date.now() - start > timeoutMs) {
          throw new AuthError(
            AuthErrorCode.CONFIG_ERROR,
            'Timed out waiting for window.Clerk. Ensure ClerkProvider is mounted.',
          );
        }
        await new Promise((r) => setTimeout(r, 25));
      }

      const clerk = (window as any).Clerk;

      // Ensure Clerk finishes booting (safe if already loaded)
      if (typeof clerk.load === 'function') {
        await clerk.load();
      }

      return clerk;
    })();

    return this.clerkReadyPromise;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Get current user from Clerk
   */
  getCurrentUser(): AuthUser | null {
    try {
      const clerk = this.getClerk();
      const clerkUser = clerk.user;

      if (!clerkUser) {
        return null;
      }

      return ClerkAuthClientAdapter.normalizeUser(clerkUser);
    } catch (error) {
      // If Clerk is not yet loaded, return null (not authenticated)
      if (
        error instanceof AuthError &&
        error.code === AuthErrorCode.CONFIG_ERROR
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Sign in with email/password - Note: In Clerk architecture, use Clerk UI components
   */
  async signInWithEmailPassword(
    _credentials: EmailPasswordCredentials,
  ): Promise<SignInResult> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'signInWithEmailPassword is not available with Clerk. Use Clerk UI components (<SignIn />) or Clerk hooks instead.',
    );
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      const clerk = this.getClerk();
      await clerk.signOut();
    } catch (error: any) {
      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Sign out failed: ${error.message || 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Get ID token from Clerk session
   */
  async getIdToken(forceRefresh = false): Promise<string> {
    try {
      const clerk = this.getClerk();

      if (!clerk.session) {
        throw new AuthError(
          AuthErrorCode.UNAUTHENTICATED,
          'No active session. User must be signed in to get token.',
        );
      }

      // Keep your original logic (even though forceRefresh isn't correctly implemented here),
      // because you asked for changes only in onAuthStateChanged.
      const token = await clerk.session.getToken({
        template: forceRefresh ? undefined : 'default',
      });

      if (!token) {
        throw new AuthError(
          AuthErrorCode.PROVIDER_ERROR,
          'Failed to retrieve session token',
        );
      }

      return token;
    } catch (error: any) {
      if (error instanceof AuthError) {
        throw error;
      }

      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to get ID token: ${error.message || 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Subscribe to auth state changes
   * Listens to Clerk's session changes and notifies callback
   *
   * IMPORTANT: This implementation waits for Clerk to be ready to avoid false "logged out"
   * on first page load. Other methods remain unchanged.
   */
  onAuthStateChanged(callback: AuthStateChangeCallback): () => void {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    // Immediately signal loading to avoid "not logged in" flicker
    callback({ user: null, loading: true });

    (async () => {
      try {
        const clerk = await this.getClerkReady();
        if (cancelled) return;

        const emit = (userLike: any) => {
          // When loading, Clerk can temporarily have user undefined
          const loading = clerk.status === 'loading' || userLike === undefined;
          const user =
            userLike && userLike !== undefined
              ? ClerkAuthClientAdapter.normalizeUser(userLike)
              : null;

          callback({ user, loading });
        };

        // Emit current state once Clerk is ready
        emit(clerk.user);

        // Subscribe; Clerk's addListener returns an unsubscribe function
        unsubscribe = clerk.addListener((emission: any) => {
          emit(emission.user);
        });
      } catch (error: any) {
        // If Clerk never becomes ready, stay in loading and log
        logger.warn(
          `Clerk not loaded, onAuthStateChanged will not work yet: ${
            error?.message || 'Unknown error'
          }`,
        );
        callback({ user: null, loading: true });
      }
    })();

    return () => {
      cancelled = true;
      try {
        unsubscribe?.();
      } catch {
        // ignore
      }
    };
  }

  /**
   * Create user with email/password - Note: Use Clerk UI components
   */
  async createUserWithEmailPassword(
    _credentials: EmailPasswordCredentials,
  ): Promise<SignInResult> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'createUserWithEmailPassword is not available with Clerk. Use Clerk UI components (<SignUp />) or payment flow which provisions users.',
    );
  }

  /**
   * Send password reset email - Note: Handled by Clerk UI
   */
  async sendPasswordResetEmail(_email: string): Promise<void> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      'sendPasswordResetEmail is not available with Clerk. Use Clerk UI components which handle password reset.',
    );
  }

  /**
   * Update profile - Note: Use Clerk's user.update() method
   */
  async updateProfile(_profile: {
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
      "signInWithPasskey is not available with Clerk adapter. Use Clerk's built-in passkey authentication flow.",
    );
  }

  /**
   * Register passkey - Note: Handled by Clerk's passkey enrollment
   */
  async registerPasskey(_displayName: string): Promise<SignInResult> {
    throw new AuthError(
      AuthErrorCode.CONFIG_ERROR,
      "registerPasskey is not available with Clerk adapter. Use Clerk's passkey enrollment flow in user settings.",
    );
  }

  /**
   * Register passkey anonymously - Note: Not supported, users must pay first
   */
  async registerPasskeyAnonymous(_displayName?: string): Promise<SignInResult> {
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
      emailVerified:
        clerkUser.emailAddresses?.[0]?.verification?.status === 'verified',
      displayName: clerkUser.fullName || clerkUser.username || undefined,
      photoURL: clerkUser.imageUrl || undefined,
      isAnonymous: false, // Clerk doesn't support anonymous users
    };
  }
}
