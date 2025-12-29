/**
 * Public API for server-side authentication operations
 * Provider-agnostic interface for auth functionality
 */

import type {
  AuthUser,
  AuthTokenClaims,
  AuthSession,
  Subscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
  CreateUserData,
  UpdateUserMetadataData,
  UserListResult,
} from '../types/domain';
import { AuthError, AuthErrorCode } from '../types/domain';
import { getAuthProvider } from '../internal/provider-resolver';
import type { IncomingHttpHeaders } from 'http';

/**
 * Extract token from Authorization header
 * Supports both "Bearer <token>" and plain token formats
 */
function extractTokenFromHeaders(
  headers: IncomingHttpHeaders | Headers,
): string | undefined {
  let authHeader: string | undefined;

  // Handle both Node.js IncomingHttpHeaders and Web API Headers
  if (headers instanceof Headers) {
    authHeader = headers.get('authorization') || undefined;
  } else {
    authHeader = headers.authorization;
  }

  if (!authHeader) {
    return undefined;
  }

  // Support "Bearer <token>" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Support plain token
  return authHeader;
}

/**
 * Verify an authentication token and return the claims
 * @param token - The token to verify
 * @param checkRevoked - Whether to check if the token has been revoked (default: true)
 * @returns Token claims
 * @throws AuthError if verification fails
 */
export async function verifyToken(
  token: string,
  checkRevoked = true,
): Promise<AuthTokenClaims> {
  const provider = getAuthProvider();
  return provider.verifyToken(token, checkRevoked);
}

/**
 * Get session from HTTP request headers
 * Extracts and verifies the authentication token from the Authorization header
 * @param headers - Request headers (Node.js IncomingHttpHeaders or Web API Headers)
 * @returns AuthSession with user and token information
 * @throws AuthError if token is missing or invalid
 */
export async function getSessionFromRequest(
  headers: IncomingHttpHeaders | Headers,
): Promise<AuthSession> {
  const token = extractTokenFromHeaders(headers);

  if (!token) {
    throw new AuthError(
      AuthErrorCode.UNAUTHENTICATED,
      'No authentication token found in request headers',
    );
  }

  const provider = getAuthProvider();
  const claims = await provider.verifyToken(token);
  const user = await provider.getUser(claims.uid);

  return {
    user,
    token,
    expiresAt: claims.exp
      ? new Date(claims.exp * 1000)
      : new Date(Date.now() + 3600000), // Default 1 hour
  };
}

/**
 * Require authentication for a request
 * Throws AuthError if not authenticated
 * @param headers - Request headers
 * @returns AuthSession
 * @throws AuthError if not authenticated
 */
export async function requireAuth(
  headers: IncomingHttpHeaders | Headers,
): Promise<AuthSession> {
  return getSessionFromRequest(headers);
}

/**
 * Get user information by user ID
 * @param uid - The user's unique identifier
 * @returns User information
 * @throws AuthError if user not found
 */
export async function getUser(uid: string): Promise<AuthUser> {
  const provider = getAuthProvider();
  return provider.getUser(uid);
}

/**
 * Delete a user account
 * @param uid - The user's unique identifier
 * @throws AuthError if deletion fails
 */
export async function deleteUser(uid: string): Promise<void> {
  const provider = getAuthProvider();
  return provider.deleteUser(uid);
}

/**
 * Set custom claims for a user
 * Custom claims are included in the user's token and can be used for authorization
 * @param uid - The user's unique identifier
 * @param claims - Custom claims to set
 * @throws AuthError if operation fails
 */
export async function setCustomClaims(
  uid: string,
  claims: Record<string, unknown>,
): Promise<void> {
  const provider = getAuthProvider();
  return provider.setCustomClaims(uid, claims);
}

/**
 * Get custom claims for a user
 * @param uid - The user's unique identifier
 * @returns Custom claims object
 * @throws AuthError if operation fails
 */
export async function getCustomClaims(
  uid: string,
): Promise<Record<string, unknown>> {
  const user = await getUser(uid);
  return user.customClaims || {};
}

/**
 * Create a custom token for a user (useful for testing or special authentication flows)
 * @param uid - The user's unique identifier
 * @param claims - Optional custom claims to include in the token
 * @returns Custom token string
 * @throws AuthError if token creation fails
 */
export async function createCustomToken(
  uid: string,
  claims?: Record<string, unknown>,
): Promise<string> {
  const provider = getAuthProvider();
  return provider.createCustomToken(uid, claims);
}

/**
 * Check if the auth provider is properly configured
 * @returns true if configured and ready to use
 */
export function isAuthConfigured(): boolean {
  try {
    const provider = getAuthProvider();
    return provider.isConfigured();
  } catch {
    return false;
  }
}

// ============================================================================
// Subscription Management Operations
// ============================================================================

/**
 * Get a user's subscription by user ID
 * @param userId - The user's unique identifier
 * @returns The user's subscription, or null if not found
 * @throws AuthError if operation fails
 */
export async function getSubscription(
  userId: string,
): Promise<Subscription | null> {
  const provider = getAuthProvider();
  return provider.getSubscription(userId);
}

/**
 * Get a subscription by Stripe checkout session ID
 * Used to check if a checkout session has already been used
 * @param sessionId - The Stripe checkout session ID
 * @returns The subscription associated with the session, or null if not found
 * @throws AuthError if operation fails
 */
export async function getSubscriptionBySessionId(
  sessionId: string,
): Promise<Subscription | null> {
  const provider = getAuthProvider();
  return provider.getSubscriptionBySessionId(sessionId);
}

/**
 * Create a new subscription for a user
 * @param data - Subscription data
 * @returns The created subscription
 * @throws AuthError if operation fails
 */
export async function createSubscription(
  data: CreateSubscriptionData,
): Promise<Subscription> {
  const provider = getAuthProvider();
  return provider.createSubscription(data);
}

/**
 * Update an existing subscription
 * @param userId - The user's unique identifier
 * @param updates - Subscription fields to update
 * @returns The updated subscription
 * @throws AuthError if operation fails
 */
export async function updateSubscription(
  userId: string,
  updates: UpdateSubscriptionData,
): Promise<Subscription> {
  const provider = getAuthProvider();
  return provider.updateSubscription(userId, updates);
}

/**
 * Create a new user in the auth system
 * @param data - User creation data
 * @returns Created user information
 * @throws AuthError if creation fails
 */
export async function createUser(data: CreateUserData): Promise<AuthUser> {
  const provider = getAuthProvider();
  return provider.createUser(data);
}

/**
 * Get users by email address
 * @param email - Email address to search for
 * @returns List of users with that email
 * @throws AuthError if operation fails
 */
export async function getUsersByEmail(email: string): Promise<UserListResult> {
  const provider = getAuthProvider();
  return provider.getUsersByEmail(email);
}

/**
 * Update user metadata (public and/or private)
 * @param uid - The user's unique identifier
 * @param data - Metadata to update
 * @throws AuthError if operation fails
 */
export async function updateUserMetadata(
  uid: string,
  data: UpdateUserMetadataData,
): Promise<void> {
  const provider = getAuthProvider();
  return provider.updateUserMetadata(uid, data);
}

// ============================================================================
// Webhook Event Processing Operations
// ============================================================================

/**
 * Webhook event data for user lifecycle events
 */
export interface UserWebhookEventData {
  id: string;
  email_addresses?: Array<{
    id: string;
    email_address: string;
  }>;
  primary_email_address_id?: string;
}

/**
 * Result of webhook verification
 */
export interface WebhookVerificationResult {
  type: string;
  data: any;
}

/**
 * Verify webhook signature and extract event data
 * Provider-agnostic webhook verification
 * @param body - Raw webhook body (string)
 * @param headers - Webhook headers with signature info
 * @param secret - Webhook secret for verification
 * @returns Verified event type and data
 * @throws AuthError if verification fails
 */
export async function verifyWebhook(
  body: string,
  headers: Record<string, string>,
  secret: string,
): Promise<WebhookVerificationResult> {
  const provider = getAuthProvider();
  if (!provider.verifyWebhook) {
    throw new AuthError(
      AuthErrorCode.NOT_IMPLEMENTED,
      'Webhook verification not supported by this auth provider',
    );
  }
  return provider.verifyWebhook(body, headers, secret);
}

/**
 * Get current authenticated user from server context
 * This is a server-side function that retrieves the currently authenticated user
 * @returns Current user or null if not authenticated
 * @throws AuthError if operation fails
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const provider = getAuthProvider();
  if (!provider.getCurrentUser) {
    throw new AuthError(
      AuthErrorCode.NOT_IMPLEMENTED,
      'getCurrentUser not supported by this auth provider',
    );
  }
  return provider.getCurrentUser();
}
