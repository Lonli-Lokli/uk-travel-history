/**
 * Domain types for database operations (provider-agnostic)
 * These types define the public API contract and do not expose provider-specific types
 */

/**
 * Error codes for database operations
 */
export enum DbErrorCode {
  /** Database configuration is invalid or missing */
  CONFIG_ERROR = 'CONFIG_ERROR',
  /** Error from the underlying database provider */
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  /** Network or communication error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Record not found */
  NOT_FOUND = 'NOT_FOUND',
  /** Unique constraint violation */
  UNIQUE_VIOLATION = 'UNIQUE_VIOLATION',
  /** Foreign key constraint violation */
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',
  /** Invalid query or operation */
  INVALID_OPERATION = 'INVALID_OPERATION',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Database error with structured information
 */
export class DbError extends Error {
  constructor(
    public readonly code: DbErrorCode,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'DbError';
    Object.setPrototypeOf(this, DbError.prototype);
  }

  /**
   * Check if this is a specific error code
   */
  is(code: DbErrorCode): boolean {
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

// ============================================================================
// User Types
// ============================================================================

/**
 * Subscription tier enum
 */
export enum SubscriptionTier {
  FREE = 'free',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  LIFETIME = 'lifetime',
}

/**
 * Subscription status enum
 */
export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  INCOMPLETE = 'incomplete',
  UNPAID = 'unpaid',
}

/**
 * Represents a user in the database
 */
export interface User {
  /** Unique identifier */
  id: string;
  /** Authentication provider user ID (e.g., Clerk user ID) */
  authUserId: string;
  /** User's email address */
  email: string;
  /** Whether user has enrolled in passkey authentication */
  passkeyEnrolled: boolean;
  /** Subscription tier */
  subscriptionTier: SubscriptionTier;
  /** Subscription status (null for free tier) */
  subscriptionStatus: SubscriptionStatus | null;
  /** Stripe customer ID */
  stripeCustomerId: string | null;
  /** Stripe subscription ID (null for lifetime/free) */
  stripeSubscriptionId: string | null;
  /** Stripe price ID */
  stripePriceId: string | null;
  /** End of current billing period (null for lifetime/free) */
  currentPeriodEnd: Date | null;
  /** When the user record was created */
  createdAt: Date;
  /** When the user record was last updated */
  updatedAt: Date;
}

/**
 * Data for creating a new user
 */
export interface CreateUserData {
  /** Authentication provider user ID */
  authUserId: string;
  /** User's email address */
  email: string;
  /** Whether user has enrolled in passkey authentication (optional, defaults to false) */
  passkeyEnrolled?: boolean;
  /** Subscription tier (optional, defaults to FREE) */
  subscriptionTier?: SubscriptionTier;
  /** Subscription status (optional) */
  subscriptionStatus?: SubscriptionStatus | null;
  /** Stripe customer ID (optional) */
  stripeCustomerId?: string | null;
  /** Stripe subscription ID (optional) */
  stripeSubscriptionId?: string | null;
  /** Stripe price ID (optional) */
  stripePriceId?: string | null;
  /** End of current billing period (optional) */
  currentPeriodEnd?: Date | null;
}

/**
 * Data for updating a user
 */
export interface UpdateUserData {
  /** User's email address */
  email?: string;
  /** Whether user has enrolled in passkey authentication */
  passkeyEnrolled?: boolean;
  /** Subscription tier */
  subscriptionTier?: SubscriptionTier;
  /** Subscription status */
  subscriptionStatus?: SubscriptionStatus | null;
  /** Stripe customer ID */
  stripeCustomerId?: string | null;
  /** Stripe subscription ID */
  stripeSubscriptionId?: string | null;
  /** Stripe price ID */
  stripePriceId?: string | null;
  /** End of current billing period */
  currentPeriodEnd?: Date | null;
}

// ============================================================================
// Purchase Intent Types
// ============================================================================

/**
 * Status of a purchase intent
 */
export enum PurchaseIntentStatus {
  /** Initial state - purchase intent created */
  CREATED = 'created',
  /** Stripe checkout session has been created */
  CHECKOUT_CREATED = 'checkout_created',
  /** Payment has been successfully completed */
  PAID = 'paid',
  /** User account has been provisioned/created */
  PROVISIONED = 'provisioned',
}

/**
 * Represents a purchase intent (tracks the one-time payment flow)
 */
export interface PurchaseIntent {
  /** Unique identifier */
  id: string;
  /** Current status of the purchase intent */
  status: PurchaseIntentStatus;
  /** Stripe checkout session ID (if created) */
  stripeCheckoutSessionId: string | null;
  /** Stripe payment intent ID (if created) */
  stripePaymentIntentId: string | null;
  /** Customer's email address */
  email: string;
  /** Stripe price ID */
  priceId: string | null;
  /** Stripe product ID */
  productId: string | null;
  /** Clerk user ID (after account is created) */
  authUserId: string | null;
  /** When the purchase intent was created */
  createdAt: Date;
  /** When the purchase intent was last updated */
  updatedAt: Date;
}

/**
 * Data for creating a new purchase intent
 */
export interface CreatePurchaseIntentData {
  /** Customer's email address */
  email: string;
  /** Initial status (optional, defaults to CREATED) */
  status?: PurchaseIntentStatus;
  /** Stripe price ID (optional) */
  priceId?: string | null;
  /** Stripe product ID (optional) */
  productId?: string | null;
}

/**
 * Data for updating a purchase intent
 */
export interface UpdatePurchaseIntentData {
  /** Current status of the purchase intent */
  status?: PurchaseIntentStatus;
  /** Stripe checkout session ID */
  stripeCheckoutSessionId?: string | null;
  /** Stripe payment intent ID */
  stripePaymentIntentId?: string | null;
  /** Clerk user ID */
  authUserId?: string | null;
}

// ============================================================================
// Webhook Event Types
// ============================================================================

/**
 * Represents a processed webhook event (for idempotency)
 */
export interface WebhookEvent {
  /** Unique identifier */
  id: string;
  /** Stripe event ID (for deduplication) */
  stripeEventId: string;
  /** Event type */
  type: string;
  /** Event payload (JSON) */
  payload: Record<string, unknown>;
  /** When the webhook was processed */
  processedAt: Date;
}

/**
 * Data for creating a new webhook event record
 */
export interface CreateWebhookEventData {
  /** Stripe event ID */
  stripeEventId: string;
  /** Event type */
  type: string;
  /** Event payload (JSON) */
  payload: Record<string, unknown>;
}
