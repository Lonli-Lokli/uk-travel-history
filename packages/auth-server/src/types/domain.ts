/**
 * Domain types for authentication (provider-agnostic)
 * These types define the public API contract and do not expose provider-specific types
 */

/**
 * Represents an authenticated user in the system
 */
export interface AuthUser {
  /** Unique identifier for the user */
  uid: string;
  /** User's email address (if available) */
  email?: string;
  /** Whether the user's email has been verified */
  emailVerified: boolean;
  /** User's display name (if available) */
  displayName?: string;
  /** URL to user's profile photo (if available) */
  photoURL?: string;
  /** Custom claims attached to the user */
  customClaims?: Record<string, unknown>;
  /** Timestamp when the user was created */
  createdAt?: Date;
  /** Timestamp when the user last signed in */
  lastSignInAt?: Date;
}

/**
 * Represents a user session
 */
export interface AuthSession {
  /** The authenticated user */
  user: AuthUser;
  /** The session token (opaque to consumers) */
  token: string;
  /** When the session expires */
  expiresAt: Date;
}

/**
 * Claims extracted from an auth token
 */
export interface AuthTokenClaims {
  /** User ID */
  uid: string;
  /** User's email */
  email?: string;
  /** Whether email is verified */
  emailVerified?: boolean;
  /** Token issued at timestamp */
  iat?: number;
  /** Token expiration timestamp */
  exp?: number;
  /** Custom claims */
  [key: string]: unknown;
}

/**
 * Result of an authentication operation
 */
export interface AuthResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** The authenticated user (if successful) */
  user?: AuthUser;
  /** Error information (if failed) */
  error?: AuthError;
}

/**
 * Error codes for authentication operations
 */
export enum AuthErrorCode {
  /** User is not authenticated */
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  /** User is authenticated but not authorized for the operation */
  FORBIDDEN = 'FORBIDDEN',
  /** Authentication configuration is invalid or missing */
  CONFIG_ERROR = 'CONFIG_ERROR',
  /** Error from the underlying auth provider */
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  /** Network or communication error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Token is invalid or expired */
  INVALID_TOKEN = 'INVALID_TOKEN',
  /** User not found */
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  /** Invalid input data */
  INVALID_INPUT = 'INVALID_INPUT',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Authentication error with structured information
 */
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }

  /**
   * Check if this is a specific error code
   */
  is(code: AuthErrorCode): boolean {
    return this.code === code;
  }

  /**
   * Convert to a JSON-serializable object
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
    };
  }
}

/**
 * Subscription status values
 */
export enum SubscriptionStatus {
  /** Subscription is active and valid */
  ACTIVE = 'active',
  /** Subscription payment is past due */
  PAST_DUE = 'past_due',
  /** Subscription has been canceled */
  CANCELED = 'canceled',
  /** Subscription is in trial period */
  TRIALING = 'trialing',
  /** Subscription is incomplete (payment failed) */
  INCOMPLETE = 'incomplete',
  /** Subscription is incomplete and payment is still being processed */
  INCOMPLETE_EXPIRED = 'incomplete_expired',
  /** Subscription is unpaid */
  UNPAID = 'unpaid',
}

/**
 * Represents a user subscription
 */
export interface Subscription {
  /** User ID this subscription belongs to */
  userId: string;
  /** Subscription status */
  status: SubscriptionStatus | string;
  /** Stripe customer ID */
  stripeCustomerId: string;
  /** Stripe subscription ID */
  stripeSubscriptionId: string;
  /** Stripe checkout session ID (if created via checkout) */
  stripeSessionId?: string;
  /** Stripe price ID */
  stripePriceId?: string;
  /** Current billing period start date */
  currentPeriodStart: Date;
  /** Current billing period end date */
  currentPeriodEnd: Date;
  /** Whether subscription will cancel at period end */
  cancelAtPeriodEnd: boolean;
  /** When subscription was created */
  createdAt: Date;
  /** When subscription was last updated */
  updatedAt: Date;
  /** When subscription was canceled (if applicable) */
  canceledAt?: Date;
  /** Last payment error timestamp (if applicable) */
  lastPaymentError?: Date;
}

/**
 * Data required to create a new subscription
 */
export interface CreateSubscriptionData {
  /** User ID */
  userId: string;
  /** Subscription status */
  status: SubscriptionStatus | string;
  /** Stripe customer ID */
  stripeCustomerId: string;
  /** Stripe subscription ID */
  stripeSubscriptionId: string;
  /** Stripe checkout session ID (optional) */
  stripeSessionId?: string;
  /** Stripe price ID (optional) */
  stripePriceId?: string;
  /** Current billing period start date */
  currentPeriodStart: Date;
  /** Current billing period end date */
  currentPeriodEnd: Date;
  /** Whether subscription will cancel at period end */
  cancelAtPeriodEnd: boolean;
}

/**
 * Data for updating a subscription
 */
export interface UpdateSubscriptionData {
  /** Subscription status */
  status?: SubscriptionStatus | string;
  /** Current billing period end date */
  currentPeriodEnd?: Date;
  /** Whether subscription will cancel at period end */
  cancelAtPeriodEnd?: boolean;
  /** When subscription was canceled */
  canceledAt?: Date;
  /** Last payment error timestamp */
  lastPaymentError?: Date;
}

/**
 * Data for creating a new user
 */
export interface CreateUserData {
  /** User's email address */
  email: string;
  /** Whether to skip password requirement (for passkey-only auth) */
  skipPasswordRequirement?: boolean;
  /** Whether to skip password validation checks */
  skipPasswordChecks?: boolean;
}

/**
 * Data for updating user metadata
 */
export interface UpdateUserMetadataData {
  /** Public metadata accessible to the client */
  publicMetadata?: Record<string, unknown>;
  /** Private metadata only accessible server-side */
  privateMetadata?: Record<string, unknown>;
}

/**
 * Result of user list query
 */
export interface UserListResult {
  /** List of users matching the query */
  users: AuthUser[];
  /** Total count of users */
  totalCount: number;
}
