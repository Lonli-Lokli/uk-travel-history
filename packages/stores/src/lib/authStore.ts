// Authentication Store with Passkey Support
// Manages user authentication state using the auth SDK

import { makeAutoObservable, runInAction } from 'mobx';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import {
  signOut as sdkSignOut,
  isPasskeySupported as sdkIsPasskeySupported,
  signInWithPasskey as sdkSignInWithPasskey,
  registerPasskey as sdkRegisterPasskey,
  registerPasskeyAnonymous as sdkRegisterPasskeyAnonymous,
  AuthError,
  AuthErrorCode,
} from '@uth/auth-client';
import * as Sentry from '@sentry/nextjs';

// Helper to get auth instance for Firebase-specific operations
// This is a temporary workaround until we fully migrate to SDK
import { getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

function getAuthInstance() {
  const apps = getApps();
  if (apps.length === 0) {
    throw new Error('Firebase is not initialized');
  }
  return getAuth(apps[0]);
}

class AuthStore {
  user: User | null = null;
  isLoading = true;
  isAuthenticating = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);

    // Listen for auth state changes
    if (typeof window !== 'undefined') {
      try {
        const auth = getAuthInstance();
        onAuthStateChanged(auth, (user) => {
          runInAction(() => {
            this.user = user;
            this.isLoading = false;
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
    return sdkIsPasskeySupported();
  }

  /**
   * Sign in with passkey
   * Uses the auth SDK passkey operations
   */
  async signInWithPasskey(): Promise<void> {
    this.isAuthenticating = true;
    this.error = null;

    try {
      await sdkSignInWithPasskey();

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
      await sdkRegisterPasskey(displayName);

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
      await sdkRegisterPasskeyAnonymous();

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
      await sdkSignOut();
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
      return this.user.getIdToken();
    } catch (error) {
      // Track ID token retrieval failures in Sentry
      Sentry.captureException(error, {
        tags: {
          service: 'firebase',
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
