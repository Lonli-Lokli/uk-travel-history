// Authentication Store with Passkey Support
// Manages user authentication state using the auth SDK

import { makeAutoObservable, runInAction } from 'mobx';
import {
  signOut,
  isPasskeySupported,
  signInWithPasskey,
  registerPasskey,
  registerPasskeyAnonymous,
  getIdToken,
  onAuthStateChanged,
  AuthError,
  AuthErrorCode,
  type AuthUser,
  type AuthState,
} from '@uth/auth-client';
import { logger } from '@uth/utils';



class AuthStore {
  user: AuthUser | null = null;
  // Start with isLoading = false to match server-side rendering
  // This prevents hydration errors since Clerk auth runs client-side only
  isLoading = false;
  isAuthenticating = false;
  error: string | null = null;
  // Track whether we've initialized auth state subscription
  private authSubscriptionInitialized = false;

  constructor() {
    makeAutoObservable(this);
    // NOTE: Auth subscription is NOT started in constructor to prevent hydration mismatches.
    // Instead, call initializeAuthSubscription() after hydration is complete.
  }

  /**
   * Initialize auth state subscription
   * MUST be called after React hydration to prevent hydration mismatches.
   * Safe to call multiple times - will only subscribe once.
   */
  initializeAuthSubscription(): void {
    if (this.authSubscriptionInitialized || typeof window === 'undefined') {
      return;
    }

    this.authSubscriptionInitialized = true;

    try {
      onAuthStateChanged((authState: AuthState) => {
        runInAction(() => {
          this.user = authState.user;
          this.isLoading = authState.loading;
          if (authState.error) {
            this.error = authState.error.message;
          }
        });
      });
    } catch {
      // If auth is not available, keep loading as false
    }
  }

  /**
   * Check if passkey/WebAuthn is supported in the browser
   */
  get isPasskeySupported(): boolean {
    return isPasskeySupported();
  }

  /**
   * Sign in with passkey
   * Uses the auth SDK passkey operations
   */
  async signInWithPasskey(): Promise<void> {
    this.isAuthenticating = true;
    this.error = null;

    try {
      await signInWithPasskey();

      runInAction(() => {
        this.isAuthenticating = false;
      });
    } catch (error) {
      // Track auth failures
      logger.error('Failed to sign in with passkey', error, {
        tags: {
          service: 'auth',
          operation: 'sign_in_with_passkey',
        },
        contexts: {
          auth: {
            isPasskeySupported: this.isPasskeySupported,
            errorType: error instanceof AuthError ? 'AuthError' : 'Error',
            errorCode: error instanceof AuthError ? error.code : undefined,
          },
        },
      });

      runInAction(() => {
        this.error =
          error instanceof Error
            ? error.message
            : 'Failed to sign in with passkey';
        this.isAuthenticating = false;
      });
      throw error;
    }
  }

  /**
   * Register a new passkey
   * Uses the auth SDK passkey operations
   */
  async registerPasskey(displayName: string): Promise<void> {
    this.isAuthenticating = true;
    this.error = null;

    try {
      await registerPasskey(displayName);

      runInAction(() => {
        this.isAuthenticating = false;
      });
    } catch (error) {
      // Track auth failures
      logger.error('Failed to register passkey', error, {
        tags: {
          service: 'auth',
          operation: 'register_passkey',
        },
        contexts: {
          auth: {
            isPasskeySupported: this.isPasskeySupported,
            errorType: error instanceof AuthError ? 'AuthError' : 'Error',
            errorCode: error instanceof AuthError ? error.code : undefined,
            hasDisplayName: !!displayName,
          },
        },
      });

      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : 'Failed to register passkey';
        this.isAuthenticating = false;
      });
      throw error;
    }
  }

  /**
   * Register a new passkey WITHOUT email (anonymous registration)
   * Used for post-payment registration flow
   * Uses the auth SDK passkey operations
   */
  async registerPasskeyAnonymous(): Promise<void> {
    this.isAuthenticating = true;
    this.error = null;

    try {
      await registerPasskeyAnonymous();

      runInAction(() => {
        this.isAuthenticating = false;
      });
    } catch (error) {
      // Track auth failures
      logger.error('Failed to register anonymous passkey', error, {
        tags: {
          service: 'auth',
          operation: 'register_passkey_anonymous',
        },
        contexts: {
          auth: {
            isPasskeySupported: this.isPasskeySupported,
            errorType: error instanceof AuthError ? 'AuthError' : 'Error',
            errorCode: error instanceof AuthError ? error.code : undefined,
          },
        },
      });

      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : 'Failed to register passkey';
        this.isAuthenticating = false;
      });
      throw error;
    }
  }

  /**
   * Hydrate store with initial server-side user data
   * Used during SSR/RSC to prevent flicker on initial render
   *
   * @param initialUser - User data from server-side access context
   */
  hydrate(initialUser: AuthUser | null): void {
    this.user = initialUser;
    this.isLoading = false;
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      await signOut();
    } catch (error) {
      // Track signout failures
      logger.error('Failed to sign out', error, {
        tags: {
          service: 'auth',
          operation: 'sign_out',
        },
      });
      throw error;
    }
  }

  /**
   * Get the current user's ID token
   * Used for authenticated API requests
   */
  async getIdToken(): Promise<string | null> {
    try {
      if (!this.user) return null;
      return await getIdToken();
    } catch (error) {
      // Track ID token retrieval failures
      logger.error('Failed to get ID token', error, {
        tags: {
          service: 'auth',
          operation: 'get_id_token',
        },
        contexts: {
          auth: {
            hasUser: !!this.user,
            userEmail: this.user?.email,
          },
        },
      });
      throw error;
    }
  }
}

export const authStore = new AuthStore();
