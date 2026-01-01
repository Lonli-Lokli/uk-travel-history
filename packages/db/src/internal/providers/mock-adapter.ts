/**
 * Mock implementation of DbProvider for testing
 * Stores data in-memory without requiring a real database
 */

import type { DbProvider, DbProviderConfig } from './interface';
import type {
  User,
  CreateUserData,
  UpdateUserData,
  PurchaseIntent,
  CreatePurchaseIntentData,
  UpdatePurchaseIntentData,
  WebhookEvent,
  CreateWebhookEventData,
  FeaturePolicy,
} from '../../types/domain';
import {
  DbError,
  DbErrorCode,
  PurchaseIntentStatus,
  SubscriptionTier,
  SubscriptionStatus,
} from '../../types/domain';

/**
 * Mock implementation for testing
 */
export class MockDbAdapter implements DbProvider {
  private configured = false;
  private users: Map<string, User> = new Map();
  private purchaseIntents: Map<string, PurchaseIntent> = new Map();
  private webhookEvents: Map<string, WebhookEvent> = new Map();
  private featurePolicies: Map<string, FeaturePolicy> = new Map();
  private idCounter = 1;

  initialize(_config: DbProviderConfig): void {
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async keepalive(): Promise<number> {
    return 1; // Mock response
  }

  /**
   * Reset all data (useful for tests)
   */
  reset(): void {
    this.users.clear();
    this.purchaseIntents.clear();
    this.webhookEvents.clear();
    this.featurePolicies.clear();
    this.idCounter = 1;
  }

  private generateId(): string {
    return `mock-${this.idCounter++}`;
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  async getUserByAuthId(authUserId: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.authUserId === authUserId) {
        return user;
      }
    }
    return null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async createUser(data: CreateUserData): Promise<User> {
    // Check for duplicate auth user ID
    const existing = await this.getUserByAuthId(data.authUserId);
    if (existing) {
      throw new DbError(
        DbErrorCode.UNIQUE_VIOLATION,
        `User with authUserId ${data.authUserId} already exists`,
      );
    }

    const user: User = {
      id: this.generateId(),
      authUserId: data.authUserId,
      email: data.email,
      passkeyEnrolled: data.passkeyEnrolled ?? false,
      subscriptionTier: data.subscriptionTier ?? SubscriptionTier.FREE,
      subscriptionStatus: data.subscriptionStatus ?? SubscriptionStatus.ACTIVE,
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      stripePriceId: data.stripePriceId ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      createdAt: new Date(),
    };

    this.users.set(user.id, user);
    return user;
  }

  async updateUserByAuthId(
    authUserId: string,
    updates: UpdateUserData,
  ): Promise<User> {
    const user = await this.getUserByAuthId(authUserId);

    if (!user) {
      throw new DbError(
        DbErrorCode.NOT_FOUND,
        `User with authUserId ${authUserId} not found`,
      );
    }

    const updated: User = {
      ...user,
      email: updates.email ?? user.email,
      passkeyEnrolled: updates.passkeyEnrolled ?? user.passkeyEnrolled,
      subscriptionTier: updates.subscriptionTier ?? user.subscriptionTier,
      subscriptionStatus: updates.subscriptionStatus ?? user.subscriptionStatus,
      stripeCustomerId: updates.stripeCustomerId !== undefined ? updates.stripeCustomerId : user.stripeCustomerId,
      stripeSubscriptionId: updates.stripeSubscriptionId !== undefined ? updates.stripeSubscriptionId : user.stripeSubscriptionId,
      stripePriceId: updates.stripePriceId !== undefined ? updates.stripePriceId : user.stripePriceId,
      currentPeriodEnd: updates.currentPeriodEnd !== undefined ? updates.currentPeriodEnd : user.currentPeriodEnd,
    };

    this.users.set(updated.id, updated);
    return updated;
  }

  async deleteUserByAuthId(authUserId: string): Promise<void> {
    const user = await this.getUserByAuthId(authUserId);

    if (!user) {
      throw new DbError(
        DbErrorCode.NOT_FOUND,
        `User with authUserId ${authUserId} not found`,
      );
    }

    this.users.delete(user.id);
  }

  // ============================================================================
  // Purchase Intent Operations
  // ============================================================================

  async getPurchaseIntentById(id: string): Promise<PurchaseIntent | null> {
    return this.purchaseIntents.get(id) || null;
  }

  async getPurchaseIntentBySessionId(
    sessionId: string,
  ): Promise<PurchaseIntent | null> {
    for (const intent of this.purchaseIntents.values()) {
      if (intent.stripeCheckoutSessionId === sessionId) {
        return intent;
      }
    }
    return null;
  }

  async getPurchaseIntentsByAuthUserId(
    authUserId: string,
  ): Promise<PurchaseIntent[]> {
    const results: PurchaseIntent[] = [];
    for (const intent of this.purchaseIntents.values()) {
      if (intent.authUserId === authUserId) {
        results.push(intent);
      }
    }
    return results;
  }

  async createPurchaseIntent(
    data: CreatePurchaseIntentData,
  ): Promise<PurchaseIntent> {
    const now = new Date();
    const intent: PurchaseIntent = {
      id: this.generateId(),
      status: data.status || PurchaseIntentStatus.CREATED,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      email: data.email,
      priceId: data.priceId ?? null,
      productId: data.productId ?? null,
      authUserId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.purchaseIntents.set(intent.id, intent);
    return intent;
  }

  async updatePurchaseIntent(
    id: string,
    updates: UpdatePurchaseIntentData,
  ): Promise<PurchaseIntent> {
    const intent = await this.getPurchaseIntentById(id);

    if (!intent) {
      throw new DbError(
        DbErrorCode.NOT_FOUND,
        `PurchaseIntent with id ${id} not found`,
      );
    }

    const updated: PurchaseIntent = {
      ...intent,
      status: updates.status ?? intent.status,
      stripeCheckoutSessionId:
        updates.stripeCheckoutSessionId !== undefined
          ? updates.stripeCheckoutSessionId
          : intent.stripeCheckoutSessionId,
      stripePaymentIntentId:
        updates.stripePaymentIntentId !== undefined
          ? updates.stripePaymentIntentId
          : intent.stripePaymentIntentId,
      authUserId:
        updates.authUserId !== undefined
          ? updates.authUserId
          : intent.authUserId,
      updatedAt: new Date(),
    };

    this.purchaseIntents.set(updated.id, updated);
    return updated;
  }

  // ============================================================================
  // Webhook Event Operations
  // ============================================================================

  async hasWebhookEventBeenProcessed(stripeEventId: string): Promise<boolean> {
    for (const event of this.webhookEvents.values()) {
      if (event.stripeEventId === stripeEventId) {
        return true;
      }
    }
    return false;
  }

  async recordWebhookEvent(data: CreateWebhookEventData): Promise<WebhookEvent> {
    // Check for duplicate
    const hasProcessed = await this.hasWebhookEventBeenProcessed(
      data.stripeEventId,
    );
    if (hasProcessed) {
      throw new DbError(
        DbErrorCode.UNIQUE_VIOLATION,
        `Webhook event ${data.stripeEventId} has already been processed`,
      );
    }

    const event: WebhookEvent = {
      id: this.generateId(),
      stripeEventId: data.stripeEventId,
      type: data.type,
      payload: data.payload,
      processedAt: new Date(),
    };

    this.webhookEvents.set(event.id, event);
    return event;
  }

  // ============================================================================
  // Feature Policy Operations
  // ============================================================================

  async getAllFeaturePolicies(): Promise<FeaturePolicy[]> {
    return Array.from(this.featurePolicies.values());
  }

  async getFeaturePolicyByKey(featureKey: string): Promise<FeaturePolicy | null> {
    for (const policy of this.featurePolicies.values()) {
      if (policy.featureKey === featureKey) {
        return policy;
      }
    }
    return null;
  }
}
