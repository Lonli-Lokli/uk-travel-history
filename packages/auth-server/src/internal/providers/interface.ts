/**
 * Provider interface for server-side authentication
 * Implementations provide the actual auth logic (Firebase, Clerk, etc.)
 */

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

/**
 * Configuration for the auth provider
 */
export interface AuthServerProviderConfig {
  /** Provider type (for future extensibility) */
  type?: 'firebase' | 'clerk' | 'custom';
  /** Provider-specific configuration */
  options?: Record<string, unknown>;
}

/**
 * Interface that all server-side auth providers must implement
 */
export interface AuthServerProvider {
  /**
   * Initialize the provider with configuration
   * @throws AuthError if initialization fails
   */
  initialize(config: AuthServerProviderConfig): Promise<void> | void;

  /**
   * Check if the provider is properly configured and ready to use
   */
  isConfigured(): boolean;

  /**
   * Verify an authentication token and return the claims
   * @param token - The token to verify
   * @param checkRevoked - Whether to check if token has been revoked
   * @returns Decoded token claims
   * @throws AuthError if verification fails
   */
  verifyToken(token: string, checkRevoked?: boolean): Promise<AuthTokenClaims>;

  /**
   * Get user information by user ID
   * @param uid - The user's unique identifier
   * @returns User information
   * @throws AuthError if user not found or retrieval fails
   */
  getUser(uid: string): Promise<AuthUser>;

  /**
   * Delete a user account
   * @param uid - The user's unique identifier
   * @throws AuthError if deletion fails
   */
  deleteUser(uid: string): Promise<void>;

  /**
   * Set custom claims for a user
   * @param uid - The user's unique identifier
   * @param claims - Custom claims to set
   * @throws AuthError if operation fails
   */
  setCustomClaims(uid: string, claims: Record<string, unknown>): Promise<void>;

  /**
   * Create a custom token for a user (for testing or special cases)
   * @param uid - The user's unique identifier
   * @param claims - Optional custom claims
   * @returns A custom token
   * @throws AuthError if token creation fails
   */
  createCustomToken(
    uid: string,
    claims?: Record<string, unknown>,
  ): Promise<string>;

  // Subscription Management
  /**
   * Get a user's subscription by user ID
   * @param userId - The user's unique identifier
   * @returns The user's subscription, or null if not found
   * @throws AuthError if operation fails
   */
  getSubscription(userId: string): Promise<Subscription | null>;

  /**
   * Get a subscription by Stripe checkout session ID
   * @param sessionId - The Stripe checkout session ID
   * @returns The subscription associated with the session, or null if not found
   * @throws AuthError if operation fails
   */
  getSubscriptionBySessionId(sessionId: string): Promise<Subscription | null>;

  /**
   * Create a new subscription for a user
   * @param data - Subscription data
   * @returns The created subscription
   * @throws AuthError if operation fails
   */
  createSubscription(data: CreateSubscriptionData): Promise<Subscription>;

  /**
   * Update an existing subscription
   * @param userId - The user's unique identifier
   * @param updates - Subscription fields to update
   * @returns The updated subscription
   * @throws AuthError if operation fails
   */
  updateSubscription(
    userId: string,
    updates: UpdateSubscriptionData,
  ): Promise<Subscription>;

  /**
   * Create a new user in the auth provider
   * @param data - User creation data
   * @returns Created user information
   * @throws AuthError if creation fails
   */
  createUser(data: CreateUserData): Promise<AuthUser>;

  /**
   * Get users by email address
   * @param email - Email address to search for
   * @returns List of users with that email
   * @throws AuthError if operation fails
   */
  getUsersByEmail(email: string): Promise<UserListResult>;

  /**
   * Update user metadata
   * @param uid - The user's unique identifier
   * @param data - Metadata to update
   * @throws AuthError if operation fails
   */
  updateUserMetadata(uid: string, data: UpdateUserMetadataData): Promise<void>;

  /**
   * Verify webhook signature and extract event data (optional)
   * @param body - Raw webhook body
   * @param headers - Webhook headers with signature info
   * @param secret - Webhook secret for verification
   * @returns Verified event type and data
   * @throws AuthError if verification fails
   */
  verifyWebhook?(
    body: string,
    headers: Record<string, string>,
    secret: string,
  ): Promise<WebhookVerificationResult>;

  /**
   * Get current authenticated user from server context (optional)
   * @returns Current user or null if not authenticated
   * @throws AuthError if operation fails
   */
  getCurrentUser?(): Promise<AuthUser | null>;
}
