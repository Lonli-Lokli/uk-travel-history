/**
 * Clerk implementation of AuthServerProvider
 * Handles server-side auth operations using Clerk Backend SDK
 */

import { createClerkClient } from '@clerk/backend';
import { currentUser } from '@clerk/nextjs/server';
import { Webhook } from 'svix';
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
  WebhookVerificationResult,
} from '../../types/domain';
import { AuthError, AuthErrorCode } from '../../types/domain';

/**
 * Clerk implementation of the auth server provider
 */
export class ClerkAuthServerAdapter implements AuthServerProvider {
  private configured = false;
  private initError?: Error;
  private client: ReturnType<typeof createClerkClient> | null = null;

  initialize(config: AuthServerProviderConfig): void {
    // Check for Clerk secret key
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      const error = new Error(
        'Clerk Secret Key not configured. Set CLERK_SECRET_KEY environment variable.',
      );
      this.initError = error;
      logger.warn(error.message);
      return;
    }

    // Create Clerk client instance
    this.client = createClerkClient({
      secretKey,
    });

    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private ensureConfigured(): ReturnType<typeof createClerkClient> {
    if (!this.configured || !this.client) {
      if (this.initError) {
        throw new AuthError(
          AuthErrorCode.CONFIG_ERROR,
          `Clerk not initialized: ${this.initError.message}`,
          this.initError,
        );
      }
      throw new AuthError(
        AuthErrorCode.CONFIG_ERROR,
        'Clerk not initialized. Set CLERK_SECRET_KEY environment variable.',
      );
    }
    return this.client;
  }

  async verifyToken(
    token: string,
    checkRevoked = true,
  ): Promise<AuthTokenClaims> {
    const client = this.ensureConfigured();

    try {
      // Verify the session token with Clerk
      const session = await client.sessions.verifySession(token, token);

      if (!session) {
        throw new AuthError(
          AuthErrorCode.INVALID_TOKEN,
          'Invalid or expired session token',
        );
      }

      // Get user details
      const user = await client.users.getUser(session.userId);

      return {
        uid: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        emailVerified:
          user.emailAddresses[0]?.verification?.status === 'verified',
        iat: Math.floor(session.createdAt / 1000),
        exp: Math.floor(session.expireAt / 1000),
        // Include any custom public metadata as claims
        ...user.publicMetadata,
      };
    } catch (error: any) {
      // Map Clerk errors to domain errors
      if (error.status === 401 || error.status === 403) {
        throw new AuthError(
          AuthErrorCode.INVALID_TOKEN,
          'Authentication token is invalid or expired',
          error,
        );
      }

      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Token verification failed: ${error.message}`,
        error,
      );
    }
  }

  async getUser(uid: string): Promise<AuthUser> {
    this.ensureConfigured();

    try {
      const client = this.ensureConfigured();
      const user = await client.users.getUser(uid);

      return {
        uid: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        emailVerified:
          user.emailAddresses[0]?.verification?.status === 'verified',
        displayName: user.fullName || user.username || undefined,
        photoURL: user.imageUrl || undefined,
        customClaims: user.publicMetadata,
        createdAt: new Date(user.createdAt),
        lastSignInAt: user.lastSignInAt
          ? new Date(user.lastSignInAt)
          : undefined,
      };
    } catch (error: any) {
      if (error.status === 404) {
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
    this.ensureConfigured();

    try {
      const client = this.ensureConfigured();
      await client.users.deleteUser(uid);
    } catch (error: any) {
      if (error.status === 404) {
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
    this.ensureConfigured();

    try {
      const client = this.ensureConfigured();
      await client.users.updateUser(uid, {
        publicMetadata: claims,
      });
    } catch (error: any) {
      if (error.status === 404) {
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
    this.ensureConfigured();

    // Clerk doesn't support custom tokens in the same way as Firebase
    // This would typically be handled via Clerk's session management
    throw new AuthError(
      AuthErrorCode.PROVIDER_ERROR,
      'createCustomToken is not supported with Clerk. Use Clerk session tokens instead.',
    );
  }

  // ============================================================================
  // Subscription Management (using Supabase)
  // ============================================================================

  async getSubscription(userId: string): Promise<Subscription | null> {
    try {
      // Lazy-load db operations to respect module boundaries
      const { getPurchaseIntentsByAuthUserId, PurchaseIntentStatus } = await import('@uth/db');

      // Get provisioned purchase intents for the user
      const intents = await getPurchaseIntentsByAuthUserId(userId);
      const provisioned = intents.find(
        (intent) => intent.status === PurchaseIntentStatus.PROVISIONED,
      );

      // Note: For one-time payments, we don't have subscription data
      // This is a placeholder implementation
      // In reality, you'd want a separate subscriptions table or modify the schema
      return null;
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
    try {
      // Lazy-load db operations to respect module boundaries
      const { getPurchaseIntentBySessionId } = await import('@uth/db');

      const intent = await getPurchaseIntentBySessionId(sessionId);

      // Placeholder - one-time payment doesn't have subscription
      return null;
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
    // Note: This is for one-time payments, not subscriptions
    // Keeping interface compatibility
    throw new AuthError(
      AuthErrorCode.PROVIDER_ERROR,
      'createSubscription is not used for one-time payments. Use purchase_intents table instead.',
    );
  }

  async updateSubscription(
    userId: string,
    updates: UpdateSubscriptionData,
  ): Promise<Subscription> {
    // Note: This is for one-time payments, not subscriptions
    throw new AuthError(
      AuthErrorCode.PROVIDER_ERROR,
      'updateSubscription is not used for one-time payments. Use purchase_intents table instead.',
    );
  }

  async createUser(data: CreateUserData): Promise<AuthUser> {
    this.ensureConfigured();

    try {
      const client = this.ensureConfigured();
      const user = await client.users.createUser({
        emailAddress: [data.email],
        skipPasswordRequirement: data.skipPasswordRequirement ?? false,
        skipPasswordChecks: data.skipPasswordChecks ?? false,
      });

      return {
        uid: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        emailVerified:
          user.emailAddresses[0]?.verification?.status === 'verified',
        displayName: user.fullName || user.username || undefined,
        photoURL: user.imageUrl || undefined,
        customClaims: user.publicMetadata,
        createdAt: new Date(user.createdAt),
        lastSignInAt: user.lastSignInAt
          ? new Date(user.lastSignInAt)
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
    this.ensureConfigured();

    try {
      const client = this.ensureConfigured();
      const response = await client.users.getUserList({
        emailAddress: [email],
      });

      const users: AuthUser[] = response.data.map((user) => ({
        uid: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        emailVerified:
          user.emailAddresses[0]?.verification?.status === 'verified',
        displayName: user.fullName || user.username || undefined,
        photoURL: user.imageUrl || undefined,
        customClaims: user.publicMetadata,
        createdAt: new Date(user.createdAt),
        lastSignInAt: user.lastSignInAt
          ? new Date(user.lastSignInAt)
          : undefined,
      }));

      return {
        users,
        totalCount: response.totalCount,
      };
    } catch (error: any) {
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
    this.ensureConfigured();

    try {
      const client = this.ensureConfigured();

      // Get current user to merge metadata
      const currentUser = await client.users.getUser(uid);

      await client.users.updateUser(uid, {
        publicMetadata: data.publicMetadata
          ? {
              ...currentUser.publicMetadata,
              ...data.publicMetadata,
            }
          : undefined,
        privateMetadata: data.privateMetadata
          ? {
              ...currentUser.privateMetadata,
              ...data.privateMetadata,
            }
          : undefined,
      });
    } catch (error: any) {
      if (error.status === 404) {
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

  async verifyWebhook(
    body: string,
    headers: Record<string, string>,
    secret: string,
  ): Promise<WebhookVerificationResult> {
    this.ensureConfigured();

    try {
      const svix_id = headers['svix-id'];
      const svix_timestamp = headers['svix-timestamp'];
      const svix_signature = headers['svix-signature'];

      if (!svix_id || !svix_timestamp || !svix_signature) {
        throw new AuthError(
          AuthErrorCode.INVALID_INPUT,
          'Missing svix headers for webhook verification',
        );
      }

      const wh = new Webhook(secret);
      const event = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as any;

      return {
        type: event.type,
        data: event.data,
      };
    } catch (error: any) {
      throw new AuthError(
        AuthErrorCode.INVALID_TOKEN,
        `Webhook verification failed: ${error.message}`,
        error,
      );
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    this.ensureConfigured();

    try {
      const user = await currentUser();

      if (!user) {
        logger.info('getCurrentUser: No authenticated user found');
        return null;
      }

      logger.debug('getCurrentUser: Successfully retrieved user', {
        extra: {
          userId: user.id,
          email: user.emailAddresses[0]?.emailAddress,
        },
      });

      return {
        uid: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        emailVerified:
          user.emailAddresses[0]?.verification?.status === 'verified',
        displayName: user.fullName || user.username || undefined,
        photoURL: user.imageUrl || undefined,
        customClaims: user.publicMetadata,
        createdAt: new Date(user.createdAt),
        lastSignInAt: user.lastSignInAt
          ? new Date(user.lastSignInAt)
          : undefined,
      };
    } catch (error: any) {
      // Log the full error details for debugging
      logger.error('getCurrentUser: Failed to retrieve current user', {
        extra: {
          errorMessage: error.message,
          errorStack: error.stack,
          errorCode: error.code,
          errorStatus: error.status,
        },
      });

      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to get current user: ${error.message}`,
        error,
      );
    }
  }
}
