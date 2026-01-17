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
  TrackingGoalData,
  CreateTrackingGoalData,
  UpdateTrackingGoalData,
  GoalTemplate,
  BulkCreateTripsData,
  CreateTripData,
  CreateTripGroupData,
  TripData,
  TripGroupData,
  UpdateTripData,
  UpdateTripGroupData,
} from '../../types/domain';
import {
  DbError,
  DbErrorCode,
  PurchaseIntentStatus,
  SubscriptionTier,
  SubscriptionStatus,
  UserRole,
} from '../../types/domain';

type MockPurchaseIntent = PurchaseIntent & {
  authUserId: string | null;
};
type MockUser = User & {
  authUserId: string;
};

/**
 * Mock implementation for testing
 */
export class MockDbAdapter implements DbProvider {
 
  private configured = false;
  private users: Map<string, MockUser> = new Map();
  private purchaseIntents: Map<string, MockPurchaseIntent> = new Map();
  private webhookEvents: Map<string, WebhookEvent> = new Map();
  private featurePolicies: Map<string, FeaturePolicy> = new Map();
  private trackingGoals: Map<string, TrackingGoalData> = new Map();
  private goalTemplates: Map<string, GoalTemplate> = new Map();
  private trips: Map<string, TripData> = new Map();
  private tripGroups: Map<string, TripGroupData> = new Map();
  private idCounter = 1;

  initialize(_config: DbProviderConfig): void {
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async isAlive(): Promise<boolean> {
    return this.isConfigured();
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
    this.trackingGoals.clear();
    this.goalTemplates.clear();
    this.trips.clear();
    this.tripGroups.clear();
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

  
  async getUserBySessionId(sessionId: string): Promise<User | null> {
    for (const intent of this.purchaseIntents.values()) {
      if (intent.stripeCheckoutSessionId === sessionId) {
        if (intent.authUserId) {
          return this.getUserByAuthId(intent.authUserId);
        }
        return null;
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

    const user: MockUser = {
      id: this.generateId(),
      authUserId: data.authUserId,
      email: data.email,
      passkeyEnrolled: data.passkeyEnrolled ?? false,
      role: data.role ?? UserRole.STANDARD,
      subscriptionTier: data.subscriptionTier ?? SubscriptionTier.FREE,
      subscriptionStatus: data.subscriptionStatus ?? SubscriptionStatus.ACTIVE,
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      stripePriceId: data.stripePriceId ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
      pauseResumesAt: data.pauseResumesAt ?? null,
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

    const updated: MockUser = {
      ...user,
      authUserId: authUserId,
      email: updates.email ?? user.email,
      passkeyEnrolled: updates.passkeyEnrolled ?? user.passkeyEnrolled,
      role: updates.role ?? user.role,
      subscriptionTier: updates.subscriptionTier ?? user.subscriptionTier,
      subscriptionStatus: updates.subscriptionStatus ?? user.subscriptionStatus,
      stripeCustomerId:
        updates.stripeCustomerId !== undefined
          ? updates.stripeCustomerId
          : user.stripeCustomerId,
      stripeSubscriptionId:
        updates.stripeSubscriptionId !== undefined
          ? updates.stripeSubscriptionId
          : user.stripeSubscriptionId,
      stripePriceId:
        updates.stripePriceId !== undefined
          ? updates.stripePriceId
          : user.stripePriceId,
      currentPeriodEnd:
        updates.currentPeriodEnd !== undefined
          ? updates.currentPeriodEnd
          : user.currentPeriodEnd,
      cancelAtPeriodEnd:
        updates.cancelAtPeriodEnd !== undefined
          ? updates.cancelAtPeriodEnd
          : user.cancelAtPeriodEnd,
      pauseResumesAt:
        updates.pauseResumesAt !== undefined
          ? updates.pauseResumesAt
          : user.pauseResumesAt,
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

  // ==============================
  //      Trip operations
  // ==============================

  async getTrips(userId: string): Promise<TripData[]> {
    const results: TripData[] = [];
    for (const trip of this.trips.values()) {
      if (trip.userId === userId) {
        results.push(trip);
      }
    }
    return results;
  }

  async getTripsByGoal(goalId: string): Promise<TripData[]> {
    const results: TripData[] = [];
    for (const trip of this.trips.values()) {
      if (trip.goalId === goalId) {
        results.push(trip);
      }
    }
    return results;
  }

  async getTripById(tripId: string): Promise<TripData | null> {
    return this.trips.get(tripId) || null;
  }

  async createTrip(userId: string, data: CreateTripData): Promise<TripData> {
    const now = new Date().toISOString();
    const trip: TripData = {
      id: this.generateId(),
      userId,
      goalId: data.goalId ?? null,
      title: data.title ?? null,
      outDate: data.outDate,
      inDate: data.inDate,
      outRoute: data.outRoute ?? null,
      inRoute: data.inRoute ?? null,
      destination: data.destination ?? null,
      notes: data.notes ?? null,
      groupId: data.groupId ?? null,
      sortOrder: data.sortOrder ?? 0,
      source: data.source ?? 'manual',
      createdAt: now,
      updatedAt: now,
    };

    this.trips.set(trip.id, trip);
    return trip;
  }

  async bulkCreateTrips(
    userId: string,
    data: BulkCreateTripsData,
  ): Promise<TripData[]> {
    const results: TripData[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < data.trips.length; i++) {
      const tripData = data.trips[i];
      const trip: TripData = {
        id: this.generateId(),
        userId,
        goalId: data.goalId,
        title: tripData.title ?? null,
        outDate: tripData.outDate,
        inDate: tripData.inDate,
        outRoute: tripData.outRoute ?? null,
        inRoute: tripData.inRoute ?? null,
        destination: tripData.destination ?? null,
        notes: tripData.notes ?? null,
        groupId: tripData.groupId ?? null,
        sortOrder: tripData.sortOrder ?? i,
        source: tripData.source ?? 'manual',
        createdAt: now,
        updatedAt: now,
      };

      this.trips.set(trip.id, trip);
      results.push(trip);
    }

    return results;
  }

  async updateTrip(tripId: string, data: UpdateTripData): Promise<TripData> {
    const trip = await this.getTripById(tripId);

    if (!trip) {
      throw new DbError(
        DbErrorCode.NOT_FOUND,
        `Trip with id ${tripId} not found`,
      );
    }

    const updated: TripData = {
      ...trip,
      title: data.title !== undefined ? data.title : trip.title,
      outDate: data.outDate ?? trip.outDate,
      inDate: data.inDate ?? trip.inDate,
      outRoute: data.outRoute !== undefined ? data.outRoute : trip.outRoute,
      inRoute: data.inRoute !== undefined ? data.inRoute : trip.inRoute,
      destination:
        data.destination !== undefined ? data.destination : trip.destination,
      notes: data.notes !== undefined ? data.notes : trip.notes,
      groupId: data.groupId !== undefined ? data.groupId : trip.groupId,
      sortOrder: data.sortOrder ?? trip.sortOrder,
      updatedAt: new Date().toISOString(),
    };

    this.trips.set(updated.id, updated);
    return updated;
  }

  async deleteTrip(tripId: string): Promise<void> {
    if (!this.trips.has(tripId)) {
      throw new DbError(
        DbErrorCode.NOT_FOUND,
        `Trip with id ${tripId} not found`,
      );
    }
    this.trips.delete(tripId);
  }

  async reorderTrips(tripIds: string[]): Promise<void> {
    for (let i = 0; i < tripIds.length; i++) {
      const trip = this.trips.get(tripIds[i]);
      if (trip) {
        trip.sortOrder = i;
        trip.updatedAt = new Date().toISOString();
      }
    }
  }

  async getTripGroups(userId: string): Promise<TripGroupData[]> {
    const results: TripGroupData[] = [];
    for (const group of this.tripGroups.values()) {
      if (group.userId === userId) {
        results.push(group);
      }
    }
    return results;
  }

  async getTripGroupById(groupId: string): Promise<TripGroupData | null> {
    return this.tripGroups.get(groupId) || null;
  }

  async createTripGroup(
    userId: string,
    data: CreateTripGroupData,
  ): Promise<TripGroupData> {
    const now = new Date().toISOString();
    const group: TripGroupData = {
      id: this.generateId(),
      userId,
      name: data.name,
      color: data.color ?? null,
      sortOrder: data.sortOrder ?? 0,
      isCollapsed: data.isCollapsed ?? false,
      createdAt: now,
      updatedAt: now,
    };

    this.tripGroups.set(group.id, group);
    return group;
  }

  async updateTripGroup(
    groupId: string,
    data: UpdateTripGroupData,
  ): Promise<TripGroupData> {
    const group = await this.getTripGroupById(groupId);

    if (!group) {
      throw new DbError(
        DbErrorCode.NOT_FOUND,
        `TripGroup with id ${groupId} not found`,
      );
    }

    const updated: TripGroupData = {
      ...group,
      name: data.name ?? group.name,
      color: data.color !== undefined ? data.color : group.color,
      sortOrder: data.sortOrder ?? group.sortOrder,
      isCollapsed: data.isCollapsed ?? group.isCollapsed,
      updatedAt: new Date().toISOString(),
    };

    this.tripGroups.set(updated.id, updated);
    return updated;
  }

  async deleteTripGroup(groupId: string): Promise<void> {
    if (!this.tripGroups.has(groupId)) {
      throw new DbError(
        DbErrorCode.NOT_FOUND,
        `TripGroup with id ${groupId} not found`,
      );
    }
    this.tripGroups.delete(groupId);
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
    const intent: MockPurchaseIntent = {
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
    const intent: MockPurchaseIntent | null = (await this.getPurchaseIntentById(
      id,
    )) as MockPurchaseIntent | null;

    if (!intent) {
      throw new DbError(
        DbErrorCode.NOT_FOUND,
        `PurchaseIntent with id ${id} not found`,
      );
    }

    const updated: MockPurchaseIntent = {
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

  async recordWebhookEvent(
    data: CreateWebhookEventData,
  ): Promise<WebhookEvent> {
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
      payload: data.payload as any,
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

  async getFeaturePolicyByKey(
    featureKey: string,
  ): Promise<FeaturePolicy | null> {
    for (const policy of this.featurePolicies.values()) {
      if (policy.featureKey === featureKey) {
        return policy;
      }
    }
    return null;
  }

  // ============================================================================
  // Tracking Goal Operations
  // ============================================================================

  async getUserGoals(
    userId: string,
    includeArchived = false,
  ): Promise<TrackingGoalData[]> {
    const results: TrackingGoalData[] = [];
    for (const goal of this.trackingGoals.values()) {
      if (goal.userId === userId) {
        if (includeArchived || !goal.isArchived) {
          results.push(goal);
        }
      }
    }
    return results.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getGoalById(goalId: string): Promise<TrackingGoalData | null> {
    return this.trackingGoals.get(goalId) || null;
  }

  async createGoal(
    userId: string,
    data: CreateTrackingGoalData,
  ): Promise<TrackingGoalData> {
    const now = new Date().toISOString();
    const goal: TrackingGoalData = {
      id: this.generateId(),
      userId,
      type: data.type,
      jurisdiction: data.jurisdiction,
      name: data.name,
      config: data.config,
      targetDate: data.targetDate ?? null,
      isActive: data.isActive ?? true,
      isArchived: false,
      displayOrder: data.displayOrder ?? 0,
      color: data.color ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.trackingGoals.set(goal.id, goal);
    return goal;
  }

  async updateGoal(
    goalId: string,
    data: UpdateTrackingGoalData,
  ): Promise<TrackingGoalData> {
    const goal = await this.getGoalById(goalId);

    if (!goal) {
      throw new DbError(
        DbErrorCode.NOT_FOUND,
        `Goal with id ${goalId} not found`,
      );
    }

    const updated: TrackingGoalData = {
      ...goal,
      name: data.name ?? goal.name,
      config: data.config ?? goal.config,
      targetDate:
        data.targetDate !== undefined ? data.targetDate : goal.targetDate,
      isActive: data.isActive ?? goal.isActive,
      isArchived: data.isArchived ?? goal.isArchived,
      displayOrder: data.displayOrder ?? goal.displayOrder,
      color: data.color !== undefined ? data.color : goal.color,
      updatedAt: new Date().toISOString(),
    };

    this.trackingGoals.set(updated.id, updated);
    return updated;
  }

  async deleteGoal(goalId: string): Promise<void> {
    if (!this.trackingGoals.has(goalId)) {
      throw new DbError(
        DbErrorCode.NOT_FOUND,
        `Goal with id ${goalId} not found`,
      );
    }
    this.trackingGoals.delete(goalId);
  }

  async getGoalCount(userId: string): Promise<number> {
    let count = 0;
    for (const goal of this.trackingGoals.values()) {
      if (goal.userId === userId && !goal.isArchived) {
        count++;
      }
    }
    return count;
  }

  // ============================================================================
  // Goal Template Operations
  // ============================================================================

  async getGoalTemplates(jurisdiction?: string): Promise<GoalTemplate[]> {
    const results: GoalTemplate[] = [];
    for (const template of this.goalTemplates.values()) {
      if (template.isAvailable) {
        if (!jurisdiction || template.jurisdiction === jurisdiction) {
          results.push(template);
        }
      }
    }
    return results.sort((a, b) => a.displayOrder - b.displayOrder);
  }
}
