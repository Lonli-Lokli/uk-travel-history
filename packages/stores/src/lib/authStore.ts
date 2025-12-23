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
import * as Sentry from '@sentry/nextjs';

class AuthStore {
  user: AuthUser | null = null;
  isLoading = true;
  isAuthenticating = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);

    // Listen for auth state changes using SDK
    if (typeof window !== 'undefined') {
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
        // If auth is not available, set loading to false immediately
        this.isLoading = false;
      }
    } else {
      // Server-side, set loading to false immediately
      this.isLoading = false;
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
      // Track auth failures in Sentry
      Sentry.captureException(error, {
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
        level: 'error',
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
      // Track auth failures in Sentry
      Sentry.captureException(error, {
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
        level: 'error',
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
      // Track auth failures in Sentry
      Sentry.captureException(error, {
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
        level: 'error',
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
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      await signOut();
    } catch (error) {
      // Track signout failures in Sentry
      Sentry.captureException(error, {
        tags: {
          service: 'auth',
          operation: 'sign_out',
        },
        level: 'error',
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
      // Track ID token retrieval failures in Sentry
      Sentry.captureException(error, {
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
        level: 'error',
      });
      throw error;
    }
  }
}

export const authStore = new AuthStore();
