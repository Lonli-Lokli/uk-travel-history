/**
 * Firebase implementation of AuthServerProvider
 * Wraps Firebase Admin SDK and normalizes to domain types
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { logger } from '@uth/utils';
import type { AuthServerProvider, AuthServerProviderConfig } from './interface';
import type {
  AuthUser,
  AuthTokenClaims,
  Subscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
  CreateUserData,
  UpdateUserMetadataData,
  UserListResult,
} from '../../types/domain';
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
  private firestore?: Firestore;
  private configured = false;
  private initError?: Error;

  initialize(config: AuthServerProviderConfig): void {
    // Check if already initialized
    if (getApps().length > 0) {
      this.app = getApps()[0];
      this.auth = getAuth(this.app);
      this.firestore = getFirestore(this.app);
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
      this.firestore = getFirestore(this.app);
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

  private getFirestore(): Firestore {
    if (!this.firestore) {
      if (this.initError) {
        throw new AuthError(
          AuthErrorCode.CONFIG_ERROR,
          `Firebase Admin SDK not initialized: ${this.initError.message}`,
          this.initError,
        );
      }
      throw new AuthError(
        AuthErrorCode.CONFIG_ERROR,
        'Firebase Admin SDK not initialized.',
      );
    }
    return this.firestore;
  }

  async verifyToken(
    token: string,
    checkRevoked = true,
  ): Promise<AuthTokenClaims> {
    const auth = this.ensureConfigured();

    try {
      const decodedToken = await auth.verifyIdToken(token, checkRevoked);

      // Normalize Firebase token to domain type
      const { email, email_verified, iat, exp, uid, ...customClaims } =
        decodedToken;

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

  // ============================================================================
  // Subscription Management
  // ============================================================================

  async getSubscription(userId: string): Promise<Subscription | null> {
    const firestore = this.getFirestore();

    try {
      const doc = await firestore.collection('subscriptions').doc(userId).get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      if (!data) {
        return null;
      }

      // Convert Firestore Timestamps to Dates
      return {
        userId: data.userId,
        status: data.status,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripeSessionId: data.stripeSessionId,
        stripePriceId: data.stripePriceId,
        currentPeriodStart: data.currentPeriodStart?.toDate() || new Date(),
        currentPeriodEnd: data.currentPeriodEnd?.toDate() || new Date(),
        cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        canceledAt: data.canceledAt?.toDate(),
        lastPaymentError: data.lastPaymentError?.toDate(),
      };
    } catch (error: any) {
      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to get subscription: ${error.message}`,
        error,
      );
    }
  }

  async getSubscriptionBySessionId(
    sessionId: string,
  ): Promise<Subscription | null> {
    const firestore = this.getFirestore();

    try {
      const querySnapshot = await firestore
        .collection('subscriptions')
        .where('stripeSessionId', '==', sessionId)
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      // Convert Firestore Timestamps to Dates
      return {
        userId: data.userId,
        status: data.status,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripeSessionId: data.stripeSessionId,
        stripePriceId: data.stripePriceId,
        currentPeriodStart: data.currentPeriodStart?.toDate() || new Date(),
        currentPeriodEnd: data.currentPeriodEnd?.toDate() || new Date(),
        cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        canceledAt: data.canceledAt?.toDate(),
        lastPaymentError: data.lastPaymentError?.toDate(),
      };
    } catch (error: any) {
      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to get subscription by session ID: ${error.message}`,
        error,
      );
    }
  }

  async createSubscription(
    data: CreateSubscriptionData,
  ): Promise<Subscription> {
    const firestore = this.getFirestore();

    try {
      const now = new Date();
      const subscriptionData = {
        userId: data.userId,
        status: data.status,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripeSessionId: data.stripeSessionId,
        stripePriceId: data.stripePriceId,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        createdAt: now,
        updatedAt: now,
      };

      await firestore
        .collection('subscriptions')
        .doc(data.userId)
        .set(subscriptionData);

      return {
        ...subscriptionData,
      };
    } catch (error: any) {
      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to create subscription: ${error.message}`,
        error,
      );
    }
  }

  async updateSubscription(
    userId: string,
    updates: UpdateSubscriptionData,
  ): Promise<Subscription> {
    const firestore = this.getFirestore();

    try {
      const updateData: any = {
        ...updates,
        updatedAt: new Date(),
      };

      await firestore
        .collection('subscriptions')
        .doc(userId)
        .update(updateData);

      // Fetch and return the updated subscription
      const subscription = await this.getSubscription(userId);
      if (!subscription) {
        throw new AuthError(
          AuthErrorCode.PROVIDER_ERROR,
          'Subscription not found after update',
        );
      }

      return subscription;
    } catch (error: any) {
      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to update subscription: ${error.message}`,
        error,
      );
    }
  }

  async createUser(data: CreateUserData): Promise<AuthUser> {
    const auth = this.ensureConfigured();

    try {
      const userRecord = await auth.createUser({
        email: data.email,
        emailVerified: false,
      });

      return {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        customClaims: userRecord.customClaims,
        createdAt: new Date(userRecord.metadata.creationTime),
        lastSignInAt: userRecord.metadata.lastSignInTime
          ? new Date(userRecord.metadata.lastSignInTime)
          : undefined,
      };
    } catch (error: any) {
      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to create user: ${error.message}`,
        error,
      );
    }
  }

  async getUsersByEmail(email: string): Promise<UserListResult> {
    const auth = this.ensureConfigured();

    try {
      const userRecord = await auth.getUserByEmail(email);

      const users: AuthUser[] = [
        {
          uid: userRecord.uid,
          email: userRecord.email,
          emailVerified: userRecord.emailVerified,
          displayName: userRecord.displayName,
          photoURL: userRecord.photoURL,
          customClaims: userRecord.customClaims,
          createdAt: new Date(userRecord.metadata.creationTime),
          lastSignInAt: userRecord.metadata.lastSignInTime
            ? new Date(userRecord.metadata.lastSignInTime)
            : undefined,
        },
      ];

      return {
        users,
        totalCount: users.length,
      };
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return {
          users: [],
          totalCount: 0,
        };
      }

      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to get users by email: ${error.message}`,
        error,
      );
    }
  }

  async updateUserMetadata(
    uid: string,
    data: UpdateUserMetadataData,
  ): Promise<void> {
    const auth = this.ensureConfigured();

    try {
      // Get current user to merge claims
      const currentUser = await auth.getUser(uid);
      const currentClaims = currentUser.customClaims || {};

      // Firebase uses customClaims for what Clerk calls publicMetadata
      // Firebase doesn't have a separate privateMetadata concept at the auth level
      const updatedClaims = {
        ...currentClaims,
        ...(data.publicMetadata || {}),
        ...(data.privateMetadata || {}),
      };

      await auth.setCustomUserClaims(uid, updatedClaims);
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
        `Failed to update user metadata: ${error.message}`,
        error,
      );
    }
  }
}
