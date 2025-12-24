/**
 * Clerk implementation of AuthServerProvider
 * Handles server-side auth operations using Clerk Backend SDK
 */

import { clerkClient } from '@clerk/nextjs/server';
import { logger } from '@uth/utils';
import { getSupabaseServerClient } from '@uth/db';
import type { AuthServerProvider, AuthServerProviderConfig } from './interface';
import type {
  AuthUser,
  AuthTokenClaims,
  Subscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
} from '../../types/domain';
import { AuthError, AuthErrorCode } from '../../types/domain';

/**
 * Clerk implementation of the auth server provider
 */
export class ClerkAuthServerAdapter implements AuthServerProvider {
  private configured = false;
  private initError?: Error;

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

    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private ensureConfigured(): void {
    if (!this.configured) {
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
  }

  async verifyToken(
    token: string,
    checkRevoked = true,
  ): Promise<AuthTokenClaims> {
    this.ensureConfigured();

    try {
      // Verify the session token with Clerk
      const client = await clerkClient();
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
        emailVerified: user.emailAddresses[0]?.verification?.status === 'verified',
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
      const client = await clerkClient();
      const user = await client.users.getUser(uid);

      return {
        uid: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        emailVerified: user.emailAddresses[0]?.verification?.status === 'verified',
        displayName: user.fullName || user.username || undefined,
        photoURL: user.imageUrl || undefined,
        customClaims: user.publicMetadata,
        createdAt: new Date(user.createdAt),
        lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : undefined,
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
      const client = await clerkClient();
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
      const client = await clerkClient();
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
      const supabase = getSupabaseServerClient();

      const { data, error } = await supabase
        .from('purchase_intents')
        .select('*')
        .eq('clerk_user_id', userId)
        .eq('status', 'provisioned')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        throw error;
      }

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
      const supabase = getSupabaseServerClient();

      const { data, error } = await supabase
        .from('purchase_intents')
        .select('*')
        .eq('stripe_checkout_session_id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

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

  /**
   * Create a Clerk user (server-side)
   * Used by webhook handler after successful payment
   */
  async createClerkUser(email: string): Promise<{ id: string; email: string }> {
    this.ensureConfigured();

    try {
      const client = await clerkClient();
      const user = await client.users.createUser({
        emailAddress: [email],
        skipPasswordRequirement: true, // Passkeys will be used
        skipPasswordChecks: true,
      });

      return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || email,
      };
    } catch (error: any) {
      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Failed to create Clerk user: ${error.message}`,
        error,
      );
    }
  }
}
