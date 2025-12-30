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
export async function getUserByAuthId(authUserId: string): Promise<User | null> {
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
