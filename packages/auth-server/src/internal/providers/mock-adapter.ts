/**
 * Mock implementation of AuthServerProvider for testing
 */

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
 * Mock auth server provider for testing
 */
export class MockAuthServerAdapter implements AuthServerProvider {
  private configured = true;
  private users: Map<string, AuthUser> = new Map();
  private tokens: Map<string, { uid: string; exp: number }> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private subscriptionsBySessionId: Map<string, Subscription> = new Map();

  initialize(config: AuthServerProviderConfig): void {
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Add a mock user (for testing)
   */
  addMockUser(user: AuthUser): void {
    this.users.set(user.uid, user);
  }

  /**
   * Add a mock token (for testing)
   */
  addMockToken(token: string, uid: string, expiresIn = 3600): void {
    this.tokens.set(token, {
      uid,
      exp: Math.floor(Date.now() / 1000) + expiresIn,
    });
  }

  async verifyToken(
    token: string,
    checkRevoked = true,
  ): Promise<AuthTokenClaims> {
    const tokenData = this.tokens.get(token);

    if (!tokenData) {
      throw new AuthError(
        AuthErrorCode.INVALID_TOKEN,
        'Invalid or expired token',
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (tokenData.exp < now) {
      throw new AuthError(AuthErrorCode.INVALID_TOKEN, 'Token has expired');
    }

    const user = this.users.get(tokenData.uid);

    return {
      uid: tokenData.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      exp: tokenData.exp,
      iat: tokenData.exp - 3600,
    };
  }

  async getUser(uid: string): Promise<AuthUser> {
    const user = this.users.get(uid);

    if (!user) {
      throw new AuthError(
        AuthErrorCode.USER_NOT_FOUND,
        `User not found: ${uid}`,
      );
    }

    return user;
  }

  async deleteUser(uid: string): Promise<void> {
    if (!this.users.has(uid)) {
      throw new AuthError(
        AuthErrorCode.USER_NOT_FOUND,
        `User not found: ${uid}`,
      );
    }

    this.users.delete(uid);
  }

  async setCustomClaims(
    uid: string,
    claims: Record<string, unknown>,
  ): Promise<void> {
    const user = this.users.get(uid);

    if (!user) {
      throw new AuthError(
        AuthErrorCode.USER_NOT_FOUND,
        `User not found: ${uid}`,
      );
    }

    user.customClaims = claims;
  }

  async createCustomToken(
    uid: string,
    claims?: Record<string, unknown>,
  ): Promise<string> {
    const token = `mock_token_${uid}_${Date.now()}`;
    this.addMockToken(token, uid);
    return token;
  }

  /**
   * Clear all mock data (for testing)
   */
  clearMockData(): void {
    this.users.clear();
    this.tokens.clear();
    this.subscriptions.clear();
    this.subscriptionsBySessionId.clear();
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  async getSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptions.get(userId) || null;
  }

  async getSubscriptionBySessionId(
    sessionId: string,
  ): Promise<Subscription | null> {
    return this.subscriptionsBySessionId.get(sessionId) || null;
  }

  async createSubscription(
    data: CreateSubscriptionData,
  ): Promise<Subscription> {
    const now = new Date();
    const subscription: Subscription = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    this.subscriptions.set(data.userId, subscription);
    if (data.stripeSessionId) {
      this.subscriptionsBySessionId.set(data.stripeSessionId, subscription);
    }

    return subscription;
  }

  async updateSubscription(
    userId: string,
    updates: UpdateSubscriptionData,
  ): Promise<Subscription> {
    const existing = this.subscriptions.get(userId);

    if (!existing) {
      throw new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        `Subscription not found: ${userId}`,
      );
    }

    const updated: Subscription = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.subscriptions.set(userId, updated);
    if (updated.stripeSessionId) {
      this.subscriptionsBySessionId.set(updated.stripeSessionId, updated);
    }

    return updated;
  }
}
