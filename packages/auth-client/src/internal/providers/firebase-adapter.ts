/**
 * Firebase implementation of AuthClientProvider
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFunctions, type Functions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { logger } from '@uth/utils';
import type {
  AuthClientProvider,
  AuthClientProviderConfig,
} from './interface';
import type {
  AuthUser,
  EmailPasswordCredentials,
  SignInResult,
  AuthState,
  AuthStateChangeCallback,
} from '../../types/domain';
import { AuthError, AuthErrorCode } from '../../types/domain';

/**
 * Firebase client adapter
 */
export class FirebaseAuthClientAdapter implements AuthClientProvider {
  private app?: FirebaseApp;
  private auth?: Auth;
  private functions?: Functions;
  private configured = false;

  initialize(config: AuthClientProviderConfig): void {
    // Only initialize on client-side
    if (typeof window === 'undefined') {
      return;
    }

    // Firebase configuration from environment variables
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    // Validate that required config is present
    const required = ['apiKey', 'authDomain', 'projectId'];
    const missing = required.filter((key) => !firebaseConfig[key as keyof typeof firebaseConfig]);

    if (missing.length > 0) {
      logger.warn(
        `Firebase config missing: ${missing.join(', ')}. ` +
          'Authentication will not work until these are configured.',
      );
      return;
    }

    try {
      // Use existing app if already initialized
      if (getApps().length > 0) {
        this.app = getApps()[0];
      } else {
        this.app = initializeApp(firebaseConfig);
      }

      this.auth = getAuth(this.app);
      this.functions = getFunctions(this.app);
      this.configured = true;

      // Initialize App Check if reCAPTCHA site key is provided
      const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      if (recaptchaSiteKey) {
        try {
          initializeAppCheck(this.app, {
            provider: new ReCaptchaV3Provider(recaptchaSiteKey),
            isTokenAutoRefreshEnabled: true,
          });
        } catch (error) {
          logger.error('Failed to initialize App Check:', error);
        }
      }
    } catch (error) {
      logger.error('Failed to initialize Firebase:', error);
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private ensureConfigured(): Auth {
    if (typeof window === 'undefined') {
      throw new AuthError(
        AuthErrorCode.CONFIG_ERROR,
        'Firebase Auth can only be used on the client side',
      );
    }

    if (!this.auth) {
      throw new AuthError(
        AuthErrorCode.CONFIG_ERROR,
        'Firebase Auth is not initialized. Check your Firebase configuration.',
      );
    }

    return this.auth;
  }

  /**
   * Normalize Firebase User to domain AuthUser
   */
  private normalizeUser(user: User): AuthUser {
    return {
      uid: user.uid,
      email: user.email || undefined,
      emailVerified: user.emailVerified,
      displayName: user.displayName || undefined,
      photoURL: user.photoURL || undefined,
      isAnonymous: user.isAnonymous,
    };
  }

  /**
   * Map Firebase errors to domain errors
   */
  private mapFirebaseError(error: any): AuthError {
    const errorCode = error.code || '';

    if (errorCode === 'auth/user-cancelled') {
      return new AuthError(
        AuthErrorCode.USER_CANCELLED,
        'Authentication was cancelled',
        error,
      );
    }

    if (
      errorCode === 'auth/wrong-password' ||
      errorCode === 'auth/user-not-found' ||
      errorCode === 'auth/invalid-credential'
    ) {
      return new AuthError(
        AuthErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
        error,
      );
    }

    if (errorCode === 'auth/email-already-in-use') {
      return new AuthError(
        AuthErrorCode.ACCOUNT_EXISTS,
        'An account with this email already exists',
        error,
      );
    }

    if (errorCode === 'auth/too-many-requests') {
      return new AuthError(
        AuthErrorCode.TOO_MANY_ATTEMPTS,
        'Too many failed attempts. Please try again later.',
        error,
      );
    }

    if (errorCode.startsWith('auth/network')) {
      return new AuthError(
        AuthErrorCode.NETWORK_ERROR,
        'Network error. Please check your connection.',
        error,
      );
    }

    return new AuthError(
      AuthErrorCode.PROVIDER_ERROR,
      error.message || 'Authentication failed',
      error,
    );
  }

  getCurrentUser(): AuthUser | null {
    const auth = this.ensureConfigured();
    const user = auth.currentUser;
    return user ? this.normalizeUser(user) : null;
  }

  async signInWithEmailPassword(
    credentials: EmailPasswordCredentials,
  ): Promise<SignInResult> {
    const auth = this.ensureConfigured();

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password,
      );
      const token = await userCredential.user.getIdToken();

      return {
        user: this.normalizeUser(userCredential.user),
        token,
      };
    } catch (error) {
      throw this.mapFirebaseError(error);
    }
  }

  async signOut(): Promise<void> {
    const auth = this.ensureConfigured();

    try {
      await firebaseSignOut(auth);
    } catch (error) {
      throw this.mapFirebaseError(error);
    }
  }

  async getIdToken(forceRefresh = false): Promise<string> {
    const auth = this.ensureConfigured();
    const user = auth.currentUser;

    if (!user) {
      throw new AuthError(
        AuthErrorCode.UNAUTHENTICATED,
        'No user is currently signed in',
      );
    }

    try {
      return await user.getIdToken(forceRefresh);
    } catch (error) {
      throw this.mapFirebaseError(error);
    }
  }

  onAuthStateChanged(callback: AuthStateChangeCallback): () => void {
    const auth = this.ensureConfigured();

    let initialLoad = true;

    return firebaseOnAuthStateChanged(
      auth,
      (user) => {
        const state: AuthState = {
          user: user ? this.normalizeUser(user) : null,
          loading: false,
        };
        callback(state);
        initialLoad = false;
      },
      (error) => {
        callback({
          user: null,
          loading: false,
          error: this.mapFirebaseError(error),
        });
        initialLoad = false;
      },
    );
  }

  async createUserWithEmailPassword(
    credentials: EmailPasswordCredentials,
  ): Promise<SignInResult> {
    const auth = this.ensureConfigured();

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password,
      );
      const token = await userCredential.user.getIdToken();

      return {
        user: this.normalizeUser(userCredential.user),
        token,
      };
    } catch (error) {
      throw this.mapFirebaseError(error);
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    const auth = this.ensureConfigured();

    try {
      await firebaseSendPasswordResetEmail(auth, email);
    } catch (error) {
      throw this.mapFirebaseError(error);
    }
  }

  async updateProfile(profile: {
    displayName?: string;
    photoURL?: string;
  }): Promise<void> {
    const auth = this.ensureConfigured();
    const user = auth.currentUser;

    if (!user) {
      throw new AuthError(
        AuthErrorCode.UNAUTHENTICATED,
        'No user is currently signed in',
      );
    }

    try {
      await firebaseUpdateProfile(user, profile);
    } catch (error) {
      throw this.mapFirebaseError(error);
    }
  }
}
