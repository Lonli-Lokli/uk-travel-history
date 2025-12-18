// Authentication Store with Passkey Support
// Manages user authentication state using Firebase + WebAuthn (Passkeys)

import { makeAutoObservable, runInAction } from 'mobx';
import {
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  createUserWithPasskey,
  signInWithPasskey as sdkSignInWithPasskey,
  FirebaseWebAuthnError,
} from '@firebase-web-authn/browser';
import {
  auth,
  getAuthInstance,
  getFunctionsInstance,
} from '@uth/firebase-client';
import * as Sentry from '@sentry/nextjs';

class AuthStore {
  user: User | null = null;
  isLoading = true;
  isAuthenticating = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);

    // Listen for auth state changes
    if (typeof window !== 'undefined' && auth) {
      onAuthStateChanged(auth, (user) => {
        runInAction(() => {
          this.user = user;
          this.isLoading = false;
        });
      });
    } else {
      // If auth is not available, set loading to false immediately
      this.isLoading = false;
    }
  }

  /**
   * Check if passkey/WebAuthn is supported in the browser
   */
  get isPasskeySupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === 'function'
    );
  }

  /**
   * Sign in with passkey
   * Uses the official @firebase-web-authn/browser SDK
   */
  async signInWithPasskey(): Promise<void> {
    if (!this.isPasskeySupported) {
      throw new Error('Passkeys are not supported in this browser');
    }

    this.isAuthenticating = true;
    this.error = null;

    try {
      const auth = getAuthInstance();
      const functions = getFunctionsInstance();

      // Use the official SDK method
      await sdkSignInWithPasskey(auth, functions);

      runInAction(() => {
        this.isAuthenticating = false;
      });
    } catch (error) {
      // Track Firebase auth failures in Sentry
      Sentry.captureException(error, {
        tags: {
          service: 'firebase',
          operation: 'sign_in_with_passkey',
        },
        contexts: {
          auth: {
            isPasskeySupported: this.isPasskeySupported,
            errorType:
              error instanceof FirebaseWebAuthnError
                ? 'FirebaseWebAuthnError'
                : 'Error',
          },
        },
        level: 'error',
      });

      runInAction(() => {
        // Handle FirebaseWebAuthnError with more detailed messages
        if (error instanceof FirebaseWebAuthnError) {
          this.error = error.message;
        } else {
          this.error =
            error instanceof Error
              ? error.message
              : 'Failed to sign in with passkey';
        }
        this.isAuthenticating = false;
      });
      throw error;
    }
  }

  /**
   * Register a new passkey
   * Uses the official @firebase-web-authn/browser SDK
   */
  async registerPasskey(email: string, displayName?: string): Promise<void> {
    if (!this.isPasskeySupported) {
      throw new Error('Passkeys are not supported in this browser');
    }

    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please enter a valid email address');
    }

    this.isAuthenticating = true;
    this.error = null;

    try {
      const auth = getAuthInstance();
      const functions = getFunctionsInstance();

      // Use the official SDK method
      // The 'name' parameter is what the passkey manager will display
      const name = displayName || email;
      await createUserWithPasskey(auth, functions, name);

      runInAction(() => {
        this.isAuthenticating = false;
      });
    } catch (error) {
      // Track Firebase auth failures in Sentry
      Sentry.captureException(error, {
        tags: {
          service: 'firebase',
          operation: 'register_passkey',
        },
        contexts: {
          auth: {
            isPasskeySupported: this.isPasskeySupported,
            errorType:
              error instanceof FirebaseWebAuthnError
                ? 'FirebaseWebAuthnError'
                : 'Error',
            hasEmail: !!email,
            hasDisplayName: !!displayName,
          },
        },
        level: 'error',
      });

      runInAction(() => {
        // Handle FirebaseWebAuthnError with more detailed messages
        if (error instanceof FirebaseWebAuthnError) {
          this.error = error.message;
        } else {
          this.error =
            error instanceof Error
              ? error.message
              : 'Failed to register passkey';
        }
        this.isAuthenticating = false;
      });
      throw error;
    }
  }

  /**
   * Register a new passkey WITHOUT email (anonymous registration)
   * Used for post-payment registration flow
   * Uses the official @firebase-web-authn/browser SDK
   */
  async registerPasskeyAnonymous(): Promise<void> {
    if (!this.isPasskeySupported) {
      throw new Error('Passkeys are not supported in this browser');
    }

    this.isAuthenticating = true;
    this.error = null;

    try {
      const auth = getAuthInstance();
      const functions = getFunctionsInstance();

      // Use the official SDK method with a generic display name
      // Since no email is collected, use a generic identifier
      const name = 'UK Travel History User';
      await createUserWithPasskey(auth, functions, name);

      runInAction(() => {
        this.isAuthenticating = false;
      });
    } catch (error) {
      // Track Firebase auth failures in Sentry
      Sentry.captureException(error, {
        tags: {
          service: 'firebase',
          operation: 'register_passkey_anonymous',
        },
        contexts: {
          auth: {
            isPasskeySupported: this.isPasskeySupported,
            errorType:
              error instanceof FirebaseWebAuthnError
                ? 'FirebaseWebAuthnError'
                : 'Error',
          },
        },
        level: 'error',
      });

      runInAction(() => {
        // Handle FirebaseWebAuthnError with more detailed messages
        if (error instanceof FirebaseWebAuthnError) {
          this.error = error.message;
        } else {
          this.error =
            error instanceof Error
              ? error.message
              : 'Failed to register passkey';
        }
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
      if (!auth) {
        throw new Error('Firebase Auth is not initialized');
      }
      await firebaseSignOut(auth);
    } catch (error) {
      // Track Firebase signout failures in Sentry
      Sentry.captureException(error, {
        tags: {
          service: 'firebase',
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
