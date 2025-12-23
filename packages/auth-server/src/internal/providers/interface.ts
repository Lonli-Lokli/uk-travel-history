/**
 * Provider interface for server-side authentication
 * Implementations provide the actual auth logic (Firebase, Clerk, etc.)
 */

import type { AuthUser, AuthTokenClaims } from '../../types/domain';

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
}
