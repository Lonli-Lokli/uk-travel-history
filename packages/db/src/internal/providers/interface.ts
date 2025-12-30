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
  updateUserByAuthId(authUserId: string, updates: UpdateUserData): Promise<User>;

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
}
