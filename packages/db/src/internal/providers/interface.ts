/**
 * Provider interface for database operations
 * This interface defines the contract that all database providers must implement
 */

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
  TripData,
  CreateTripData,
  UpdateTripData,
  BulkCreateTripsData,
  TripGroupData,
  CreateTripGroupData,
  UpdateTripGroupData,
} from '../../types/domain';

/**
 * Configuration for database provider
 */
export interface DbProviderConfig {
  /** Provider type (for logging/debugging) */
  provider?: 'supabase' | 'mock' | string;
}

/**
 * Database provider interface
 * All database providers must implement this interface
 */
export interface DbProvider {
  /**
   * Initialize the provider with configuration
   */
  initialize(config: DbProviderConfig): void;

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean;

    /**
   * Check if the provider is alive
   */
  isAlive(): Promise<boolean>;

  /**
   * Execute a function to keep the database connection alive
   * Returns the result of the keepalive function
   */
  keepalive(): Promise<number>;

  // ============================================================================
  // User Operations
  // ============================================================================

  /**
   * Get user by auth user ID
   * @param authUserId - The authentication provider user ID
   * @returns The user, or null if not found
   */
  getUserByAuthId(authUserId: string): Promise<User | null>;

  /**
   * Get user by database ID
   * @param id - The user's database ID
   * @returns The user, or null if not found
   */
  getUserById(id: string): Promise<User | null>;

  /**
   * Create a new user
   * @param data - User creation data
   * @returns The created user
   */
  createUser(data: CreateUserData): Promise<User>;

  /**
   * Update a user by auth user ID
   * @param authUserId - The authentication provider user ID
   * @param updates - Fields to update
   * @returns The updated user
   */
  updateUserByAuthId(
    authUserId: string,
    updates: UpdateUserData,
  ): Promise<User>;

  /**
   * Delete a user by auth user ID
   * @param authUserId - The authentication provider user ID
   */
  deleteUserByAuthId(authUserId: string): Promise<void>;

  // ============================================================================
  // Purchase Intent Operations
  // ============================================================================

  /**
   * Get purchase intent by ID
   * @param id - The purchase intent ID
   * @returns The purchase intent, or null if not found
   */
  getPurchaseIntentById(id: string): Promise<PurchaseIntent | null>;

  /**
   * Get purchase intent by Stripe checkout session ID
   * @param sessionId - The Stripe checkout session ID
   * @returns The purchase intent, or null if not found
   */
  getPurchaseIntentBySessionId(
    sessionId: string,
  ): Promise<PurchaseIntent | null>;

  /**
   * Get user by Stripe checkout session ID
   * @param sessionId - The Stripe checkout session ID
   * @returns The user, or null if not found
   */
  getUserBySessionId(sessionId: string): Promise<User | null>;

  /**
   * Get purchase intents by auth user ID
   * @param authUserId - The authentication provider user ID
   * @returns Array of purchase intents for the user
   */
  getPurchaseIntentsByAuthUserId(authUserId: string): Promise<PurchaseIntent[]>;

  /**
   * Create a new purchase intent
   * @param data - Purchase intent creation data
   * @returns The created purchase intent
   */
  createPurchaseIntent(data: CreatePurchaseIntentData): Promise<PurchaseIntent>;

  /**
   * Update a purchase intent by ID
   * @param id - The purchase intent ID
   * @param updates - Fields to update
   * @returns The updated purchase intent
   */
  updatePurchaseIntent(
    id: string,
    updates: UpdatePurchaseIntentData,
  ): Promise<PurchaseIntent>;

  // ============================================================================
  // Webhook Event Operations
  // ============================================================================

  /**
   * Check if a webhook event has already been processed
   * @param stripeEventId - The Stripe event ID
   * @returns True if already processed, false otherwise
   */
  hasWebhookEventBeenProcessed(stripeEventId: string): Promise<boolean>;

  /**
   * Record that a webhook event has been processed
   * @param data - Webhook event data
   * @returns The created webhook event record
   */
  recordWebhookEvent(data: CreateWebhookEventData): Promise<WebhookEvent>;

  // ============================================================================
  // Feature Policy Operations
  // ============================================================================

  /**
   * Get all feature policies
   * @returns Array of all feature policies
   */
  getAllFeaturePolicies(): Promise<FeaturePolicy[]>;

  /**
   * Get a feature policy by feature key
   * @param featureKey - The feature key
   * @returns The feature policy, or null if not found
   */
  getFeaturePolicyByKey(featureKey: string): Promise<FeaturePolicy | null>;

  // ============================================================================
  // Tracking Goal Operations
  // ============================================================================

  /**
   * Get all goals for a user
   * @param userId - The user ID (clerk_user_id)
   * @param includeArchived - Whether to include archived goals
   * @returns Array of goals
   */
  getUserGoals(
    userId: string,
    includeArchived?: boolean,
  ): Promise<TrackingGoalData[]>;

  /**
   * Get a goal by ID
   * @param goalId - The goal ID
   * @returns The goal, or null if not found
   */
  getGoalById(goalId: string): Promise<TrackingGoalData | null>;

  /**
   * Create a new tracking goal
   * @param userId - The user ID (clerk_user_id)
   * @param data - Goal creation data
   * @returns The created goal
   */
  createGoal(
    userId: string,
    data: CreateTrackingGoalData,
  ): Promise<TrackingGoalData>;

  /**
   * Update a tracking goal
   * @param goalId - The goal ID
   * @param data - Goal update data
   * @returns The updated goal
   */
  updateGoal(
    goalId: string,
    data: UpdateTrackingGoalData,
  ): Promise<TrackingGoalData>;

  /**
   * Delete a tracking goal
   * @param goalId - The goal ID
   */
  deleteGoal(goalId: string): Promise<void>;

  /**
   * Get goal count for a user (for limit checking)
   * @param userId - The user ID
   * @returns Number of active (non-archived) goals
   */
  getGoalCount(userId: string): Promise<number>;

  // ============================================================================
  // Goal Template Operations
  // ============================================================================

  /**
   * Get all available goal templates
   * @param jurisdiction - Optional jurisdiction filter
   * @returns Array of goal templates
   */
  getGoalTemplates(jurisdiction?: string): Promise<GoalTemplate[]>;

  // ============================================================================
  // Trip Operations
  // ============================================================================

  /**
   * Get all trips for a user
   * @param userId - The user ID (clerk_user_id)
   * @returns Array of trips
   */
  getTrips(userId: string): Promise<TripData[]>;

  /**
   * Get trips for a specific goal
   * @param goalId - The goal ID
   * @returns Array of trips for the goal
   */
  getTripsByGoal(goalId: string): Promise<TripData[]>;

  /**
   * Get a trip by ID
   * @param tripId - The trip ID
   * @returns The trip, or null if not found
   */
  getTripById(tripId: string): Promise<TripData | null>;

  /**
   * Create a new trip
   * @param userId - The user ID (clerk_user_id)
   * @param data - Trip creation data
   * @returns The created trip
   */
  createTrip(userId: string, data: CreateTripData): Promise<TripData>;

  /**
   * Bulk create trips (for imports)
   * @param userId - The user ID (clerk_user_id)
   * @param data - Bulk trip creation data
   * @returns Array of created trips
   */
  bulkCreateTrips(
    userId: string,
    data: BulkCreateTripsData,
  ): Promise<TripData[]>;

  /**
   * Update a trip
   * @param tripId - The trip ID
   * @param data - Trip update data
   * @returns The updated trip
   */
  updateTrip(tripId: string, data: UpdateTripData): Promise<TripData>;

  /**
   * Delete a trip
   * @param tripId - The trip ID
   */
  deleteTrip(tripId: string): Promise<void>;

  /**
   * Reorder trips by updating their sort_order
   * @param tripIds - Array of trip IDs in the desired order
   */
  reorderTrips(tripIds: string[]): Promise<void>;

  // ============================================================================
  // Trip Group Operations
  // ============================================================================

  /**
   * Get all trip groups for a user
   * @param userId - The user ID (clerk_user_id)
   * @returns Array of trip groups
   */
  getTripGroups(userId: string): Promise<TripGroupData[]>;

  /**
   * Get a trip group by ID
   * @param groupId - The group ID
   * @returns The trip group, or null if not found
   */
  getTripGroupById(groupId: string): Promise<TripGroupData | null>;

  /**
   * Create a new trip group
   * @param userId - The user ID (clerk_user_id)
   * @param data - Trip group creation data
   * @returns The created trip group
   */
  createTripGroup(
    userId: string,
    data: CreateTripGroupData,
  ): Promise<TripGroupData>;

  /**
   * Update a trip group
   * @param groupId - The group ID
   * @param data - Trip group update data
   * @returns The updated trip group
   */
  updateTripGroup(
    groupId: string,
    data: UpdateTripGroupData,
  ): Promise<TripGroupData>;

  /**
   * Delete a trip group
   * @param groupId - The group ID
   */
  deleteTripGroup(groupId: string): Promise<void>;
}
