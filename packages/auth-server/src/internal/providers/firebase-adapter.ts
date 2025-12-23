/**
 * Firebase implementation of AuthServerProvider
 * Wraps Firebase Admin SDK and normalizes to domain types
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { logger } from '@uth/utils';
import type {
  AuthServerProvider,
  AuthServerProviderConfig,
} from './interface';
import type { AuthUser, AuthTokenClaims } from '../../types/domain';
import { AuthError, AuthErrorCode } from '../../types/domain';

/**
 * Firebase-specific configuration
 */
interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Firebase implementation of the auth server provider
 */
export class FirebaseAuthServerAdapter implements AuthServerProvider {
  private app?: App;
  private auth?: Auth;
  private configured = false;
  private initError?: Error;

  initialize(config: AuthServerProviderConfig): void {
    // Check if already initialized
    if (getApps().length > 0) {
      this.app = getApps()[0];
      this.auth = getAuth(this.app);
      this.configured = true;
      return;
    }

    // Load Firebase Admin credentials from environment
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      const error = new Error(
        'Firebase Admin SDK credentials not configured. ' +
          'Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY environment variables.',
      );
      this.initError = error;
      logger.warn(error.message);
      // Don't throw - allow graceful degradation
      return;
    }

    try {
      this.app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          // Private key needs newline characters to be properly formatted
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });

      this.auth = getAuth(this.app);
      this.configured = true;
    } catch (error) {
      this.initError = error as Error;
      logger.error('Failed to initialize Firebase Admin SDK:', error);
      // Don't throw - allow graceful degradation
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private ensureConfigured(): Auth {
    if (!this.auth) {
      if (this.initError) {
        throw new AuthError(
          AuthErrorCode.CONFIG_ERROR,
          `Firebase Admin SDK not initialized: ${this.initError.message}`,
          this.initError,
        );
      }
      throw new AuthError(
        AuthErrorCode.CONFIG_ERROR,
        'Firebase Admin SDK not initialized. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY environment variables.',
      );
    }
    return this.auth;
  }

  async verifyToken(
    token: string,
    checkRevoked = true,
  ): Promise<AuthTokenClaims> {
    const auth = this.ensureConfigured();

    try {
      const decodedToken = await auth.verifyIdToken(token, checkRevoked);

      // Normalize Firebase token to domain type
      const { email, email_verified, iat, exp, uid, ...customClaims } = decodedToken;

      return {
        uid,
        email,
        emailVerified: email_verified,
        iat,
        exp,
        // Include any custom claims (excluding Firebase-specific fields)
        ...customClaims,
      };
    } catch (error: any) {
      // Map Firebase errors to domain errors
      if (error.code === 'auth/id-token-expired') {
        throw new AuthError(
          AuthErrorCode.INVALID_TOKEN,
          'Authentication token has expired',
          error,
        );
      }
      if (
        error.code === 'auth/id-token-revoked' ||
        error.code === 'auth/user-disabled'
      ) {
        throw new AuthError(
          AuthErrorCode.FORBIDDEN,
          'Authentication token has been revoked',
          error,
        );
      }
      if (error.code === 'auth/argument-error') {
        throw new AuthError(
          AuthErrorCode.INVALID_TOKEN,
          'Invalid authentication token format',
          error,
        );
      }

      // Default to provider error
      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Token verification failed: ${error.message}`,
        error,
      );
    }
  }

  async getUser(uid: string): Promise<AuthUser> {
    const auth = this.ensureConfigured();

    try {
      const userRecord = await auth.getUser(uid);

      // Normalize Firebase UserRecord to domain AuthUser
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        customClaims: userRecord.customClaims,
        createdAt: userRecord.metadata.creationTime
          ? new Date(userRecord.metadata.creationTime)
          : undefined,
        lastSignInAt: userRecord.metadata.lastSignInTime
          ? new Date(userRecord.metadata.lastSignInTime)
          : undefined,
      };
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        throw new AuthError(
          AuthErrorCode.USER_NOT_FOUND,
          `User not found: ${uid}`,
          error,
        );
      }

      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to get user: ${error.message}`,
        error,
      );
    }
  }

  async deleteUser(uid: string): Promise<void> {
    const auth = this.ensureConfigured();

    try {
      await auth.deleteUser(uid);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        throw new AuthError(
          AuthErrorCode.USER_NOT_FOUND,
          `User not found: ${uid}`,
          error,
        );
      }

      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to delete user: ${error.message}`,
        error,
      );
    }
  }

  async setCustomClaims(
    uid: string,
    claims: Record<string, unknown>,
  ): Promise<void> {
    const auth = this.ensureConfigured();

    try {
      await auth.setCustomUserClaims(uid, claims);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        throw new AuthError(
          AuthErrorCode.USER_NOT_FOUND,
          `User not found: ${uid}`,
          error,
        );
      }

      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to set custom claims: ${error.message}`,
        error,
      );
    }
  }

  async createCustomToken(
    uid: string,
    claims?: Record<string, unknown>,
  ): Promise<string> {
    const auth = this.ensureConfigured();

    try {
      return await auth.createCustomToken(uid, claims);
    } catch (error: any) {
      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to create custom token: ${error.message}`,
        error,
      );
    }
  }
}
