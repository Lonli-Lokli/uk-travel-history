/**
 * Public API for database operations
 * Provider-agnostic interface for database functionality
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
} from '../types/domain';
import { getDbProvider } from '../internal/provider-resolver';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Check if the database is properly configured
 * @returns true if configured and ready to use
 */
export function isDbConfigured(): boolean {
  try {
    const provider = getDbProvider();
    return provider.isConfigured();
  } catch {
    return false;
  }
}

/**
 * Check if the database is alive
 * @returns true if configured and ready to use
 */
export async function isDbAlive(): Promise<boolean> {
  try {
    const provider = getDbProvider();
    return await provider.isAlive();
  } catch {
    return false;
  }
}

/**
 * Execute keepalive function to maintain database connection
 * @returns Result from keepalive function
 */
export async function keepalive(): Promise<number> {
  const provider = getDbProvider();
  return provider.keepalive();
}

// ============================================================================
// User Operations
// ============================================================================

/**
 * Get user by authentication provider user ID
 * @param authUserId - The authentication provider user ID (e.g., Clerk user ID)
 * @returns The user, or null if not found
 */
export async function getUserByAuthId(
  authUserId: string,
): Promise<User | null> {
  const provider = getDbProvider();
  return provider.getUserByAuthId(authUserId);
}

/**
 * Get user by database ID
 * @param id - The user's database ID
 * @returns The user, or null if not found
 */
export async function getUserById(id: string): Promise<User | null> {
  const provider = getDbProvider();
  return provider.getUserById(id);
}

/**
 * Create a new user in the database
 * @param data - User creation data
 * @returns The created user
 * @throws DbError if creation fails
 */
export async function createUser(data: CreateUserData): Promise<User> {
  const provider = getDbProvider();
  return provider.createUser(data);
}

/**
 * Update a user's information
 * @param authUserId - The authentication provider user ID
 * @param updates - Fields to update
 * @returns The updated user
 * @throws DbError if update fails or user not found
 */
export async function updateUserByAuthId(
  authUserId: string,
  updates: UpdateUserData,
): Promise<User> {
  const provider = getDbProvider();
  return provider.updateUserByAuthId(authUserId, updates);
}

/**
 * Delete a user from the database
 * @param authUserId - The authentication provider user ID
 * @throws DbError if deletion fails or user not found
 */
export async function deleteUserByAuthId(authUserId: string): Promise<void> {
  const provider = getDbProvider();
  return provider.deleteUserByAuthId(authUserId);
}

/**
 * Get user by Stripe checkout session ID
 * @param sessionId - The Stripe checkout session ID
 * @returns The user, or null if not found
 */
export async function getUserBySessionId(sessionId: string): Promise<User | null> {
  const provider = getDbProvider();
  return provider.getUserBySessionId(sessionId);
}

// ============================================================================
// Purchase Intent Operations
// ============================================================================

/**
 * Get a purchase intent by ID
 * @param id - The purchase intent ID
 * @returns The purchase intent, or null if not found
 */
export async function getPurchaseIntentById(
  id: string,
): Promise<PurchaseIntent | null> {
  const provider = getDbProvider();
  return provider.getPurchaseIntentById(id);
}

/**
 * Get a purchase intent by Stripe checkout session ID
 * @param sessionId - The Stripe checkout session ID
 * @returns The purchase intent, or null if not found
 */
export async function getPurchaseIntentBySessionId(
  sessionId: string,
): Promise<PurchaseIntent | null> {
  const provider = getDbProvider();
  return provider.getPurchaseIntentBySessionId(sessionId);
}

/**
 * Get all purchase intents for a user
 * @param authUserId - The authentication provider user ID
 * @returns Array of purchase intents for the user
 */
export async function getPurchaseIntentsByAuthUserId(
  authUserId: string,
): Promise<PurchaseIntent[]> {
  const provider = getDbProvider();
  return provider.getPurchaseIntentsByAuthUserId(authUserId);
}

/**
 * Create a new purchase intent
 * @param data - Purchase intent creation data
 * @returns The created purchase intent
 * @throws DbError if creation fails
 */
export async function createPurchaseIntent(
  data: CreatePurchaseIntentData,
): Promise<PurchaseIntent> {
  const provider = getDbProvider();
  return provider.createPurchaseIntent(data);
}

/**
 * Update a purchase intent
 * @param id - The purchase intent ID
 * @param updates - Fields to update
 * @returns The updated purchase intent
 * @throws DbError if update fails or purchase intent not found
 */
export async function updatePurchaseIntent(
  id: string,
  updates: UpdatePurchaseIntentData,
): Promise<PurchaseIntent> {
  const provider = getDbProvider();
  return provider.updatePurchaseIntent(id, updates);
}

// ============================================================================
// Webhook Event Operations
// ============================================================================

/**
 * Check if a webhook event has already been processed (for idempotency)
 * @param stripeEventId - The Stripe event ID
 * @returns True if the event has been processed, false otherwise
 */
export async function hasWebhookEventBeenProcessed(
  stripeEventId: string,
): Promise<boolean> {
  const provider = getDbProvider();
  return provider.hasWebhookEventBeenProcessed(stripeEventId);
}

/**
 * Record that a webhook event has been processed
 * Used for idempotency to prevent duplicate webhook processing
 * @param data - Webhook event data
 * @returns The created webhook event record
 * @throws DbError if the event has already been recorded
 */
export async function recordWebhookEvent(
  data: CreateWebhookEventData,
): Promise<WebhookEvent> {
  const provider = getDbProvider();
  return provider.recordWebhookEvent(data);
}

// ============================================================================
// Feature Policy Operations
// ============================================================================

/**
 * Get all feature policies
 * @returns Array of all feature policies
 */
export async function getAllFeaturePolicies(): Promise<FeaturePolicy[]> {
  const provider = getDbProvider();
  return provider.getAllFeaturePolicies();
}

/**
 * Get a feature policy by feature key
 * @param featureKey - The feature key
 * @returns The feature policy, or null if not found
 */
export async function getFeaturePolicyByKey(
  featureKey: string,
): Promise<FeaturePolicy | null> {
  const provider = getDbProvider();
  return provider.getFeaturePolicyByKey(featureKey);
}

// ============================================================================
// Tracking Goal Operations
// ============================================================================

/**
 * Get all goals for a user
 * @param userId - The user ID (clerk_user_id)
 * @param includeArchived - Whether to include archived goals
 * @returns Array of goals
 */
export async function getUserGoals(
  userId: string,
  includeArchived = false,
): Promise<TrackingGoalData[]> {
  const provider = getDbProvider();
  return provider.getUserGoals(userId, includeArchived);
}

/**
 * Get a goal by ID
 * @param goalId - The goal ID
 * @returns The goal, or null if not found
 */
export async function getGoalById(
  goalId: string,
): Promise<TrackingGoalData | null> {
  const provider = getDbProvider();
  return provider.getGoalById(goalId);
}

/**
 * Create a new tracking goal
 * @param userId - The user ID (clerk_user_id)
 * @param data - Goal creation data
 * @returns The created goal
 */
export async function createGoal(
  userId: string,
  data: CreateTrackingGoalData,
): Promise<TrackingGoalData> {
  const provider = getDbProvider();
  return provider.createGoal(userId, data);
}

/**
 * Update a tracking goal
 * @param goalId - The goal ID
 * @param data - Goal update data
 * @returns The updated goal
 */
export async function updateGoal(
  goalId: string,
  data: UpdateTrackingGoalData,
): Promise<TrackingGoalData> {
  const provider = getDbProvider();
  return provider.updateGoal(goalId, data);
}

/**
 * Delete a tracking goal
 * @param goalId - The goal ID
 */
export async function deleteGoal(goalId: string): Promise<void> {
  const provider = getDbProvider();
  return provider.deleteGoal(goalId);
}

/**
 * Get goal count for a user (for limit checking)
 * @param userId - The user ID
 * @returns Number of active (non-archived) goals
 */
export async function getGoalCount(userId: string): Promise<number> {
  const provider = getDbProvider();
  return provider.getGoalCount(userId);
}

// ============================================================================
// Goal Template Operations
// ============================================================================

/**
 * Get all available goal templates
 * @param jurisdiction - Optional jurisdiction filter
 * @returns Array of goal templates
 */
export async function getGoalTemplates(
  jurisdiction?: string,
): Promise<GoalTemplate[]> {
  const provider = getDbProvider();
  return provider.getGoalTemplates(jurisdiction);
}

// ============================================================================
// Trip Operations
// ============================================================================

/**
 * Get all trips for a user
 * @param userId - The user ID (clerk_user_id)
 * @returns Array of trips
 */
export async function getTrips(userId: string): Promise<TripData[]> {
  const provider = getDbProvider();
  return provider.getTrips(userId);
}

/**
 * Get trips for a specific goal
 * @param goalId - The goal ID
 * @returns Array of trips for the goal
 */
export async function getTripsByGoal(goalId: string): Promise<TripData[]> {
  const provider = getDbProvider();
  return provider.getTripsByGoal(goalId);
}

/**
 * Get a trip by ID
 * @param tripId - The trip ID
 * @returns The trip, or null if not found
 */
export async function getTripById(tripId: string): Promise<TripData | null> {
  const provider = getDbProvider();
  return provider.getTripById(tripId);
}

/**
 * Create a new trip
 * @param userId - The user ID (clerk_user_id)
 * @param data - Trip creation data
 * @returns The created trip
 */
export async function createTrip(
  userId: string,
  data: CreateTripData,
): Promise<TripData> {
  const provider = getDbProvider();
  return provider.createTrip(userId, data);
}

/**
 * Bulk create trips (for imports)
 * @param userId - The user ID (clerk_user_id)
 * @param data - Bulk trip creation data
 * @returns Array of created trips
 */
export async function bulkCreateTrips(
  userId: string,
  data: BulkCreateTripsData,
): Promise<TripData[]> {
  const provider = getDbProvider();
  return provider.bulkCreateTrips(userId, data);
}

/**
 * Update a trip
 * @param tripId - The trip ID
 * @param data - Trip update data
 * @returns The updated trip
 */
export async function updateTrip(
  tripId: string,
  data: UpdateTripData,
): Promise<TripData> {
  const provider = getDbProvider();
  return provider.updateTrip(tripId, data);
}

/**
 * Delete a trip
 * @param tripId - The trip ID
 */
export async function deleteTrip(tripId: string): Promise<void> {
  const provider = getDbProvider();
  return provider.deleteTrip(tripId);
}

/**
 * Reorder trips by updating their sort_order
 * @param tripIds - Array of trip IDs in the desired order
 */
export async function reorderTrips(tripIds: string[]): Promise<void> {
  const provider = getDbProvider();
  return provider.reorderTrips(tripIds);
}

// ============================================================================
// Trip Group Operations
// ============================================================================

/**
 * Get all trip groups for a user
 * @param userId - The user ID (clerk_user_id)
 * @returns Array of trip groups
 */
export async function getTripGroups(userId: string): Promise<TripGroupData[]> {
  const provider = getDbProvider();
  return provider.getTripGroups(userId);
}

/**
 * Get a trip group by ID
 * @param groupId - The group ID
 * @returns The trip group, or null if not found
 */
export async function getTripGroupById(
  groupId: string,
): Promise<TripGroupData | null> {
  const provider = getDbProvider();
  return provider.getTripGroupById(groupId);
}

/**
 * Create a new trip group
 * @param userId - The user ID (clerk_user_id)
 * @param data - Trip group creation data
 * @returns The created trip group
 */
export async function createTripGroup(
  userId: string,
  data: CreateTripGroupData,
): Promise<TripGroupData> {
  const provider = getDbProvider();
  return provider.createTripGroup(userId, data);
}

/**
 * Update a trip group
 * @param groupId - The group ID
 * @param data - Trip group update data
 * @returns The updated trip group
 */
export async function updateTripGroup(
  groupId: string,
  data: UpdateTripGroupData,
): Promise<TripGroupData> {
  const provider = getDbProvider();
  return provider.updateTripGroup(groupId, data);
}

/**
 * Delete a trip group
 * @param groupId - The group ID
 */
export async function deleteTripGroup(groupId: string): Promise<void> {
  const provider = getDbProvider();
  return provider.deleteTripGroup(groupId);
}
