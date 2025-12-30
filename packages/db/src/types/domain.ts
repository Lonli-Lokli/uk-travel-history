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
 * Subscription tier for entitlement enforcement
 */
export enum SubscriptionTier {
  /** Free tier (default for new sign-ups) */
  FREE = 'free',
  /** Monthly recurring subscription */
  MONTHLY = 'monthly',
  /** Yearly recurring subscription */
  YEARLY = 'yearly',
  /** Lifetime one-time purchase */
  LIFETIME = 'lifetime',
}

/**
 * Subscription status (aligned with Stripe statuses)
 */
export enum SubscriptionStatus {
  /** Subscription is active and paid */
  ACTIVE = 'active',
  /** Payment failed but subscription not cancelled yet */
  PAST_DUE = 'past_due',
  /** Subscription has been cancelled */
  CANCELED = 'canceled',
  /** In trial period */
  TRIALING = 'trialing',
  /** Initial payment failed */
  INCOMPLETE = 'incomplete',
  /** Payment failed and grace period ended */
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
  /** Subscription tier for entitlement enforcement */
  subscriptionTier: SubscriptionTier;
  /** Subscription status (null for free/non-paid users) */
  subscriptionStatus: SubscriptionStatus | null;
  /** Stripe customer ID (if user has purchased) */
  stripeCustomerId: string | null;
  /** Stripe subscription ID (if user has recurring subscription) */
  stripeSubscriptionId: string | null;
  /** Stripe price ID for current subscription/purchase */
  stripePriceId: string | null;
  /** End date of current subscription period (null for lifetime) */
  currentPeriodEnd: Date | null;
  /** When the user record was created */
  createdAt: Date;
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
  /** Subscription status (optional, defaults to null for FREE tier, ACTIVE for paid tiers) */
  subscriptionStatus?: SubscriptionStatus | null;
  /** Stripe customer ID (optional) */
  stripeCustomerId?: string | null;
  /** Stripe subscription ID (optional) */
  stripeSubscriptionId?: string | null;
  /** Stripe price ID (optional) */
  stripePriceId?: string | null;
  /** Current period end (optional) */
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
  /** Subscription status (null for free/non-paid users) */
  subscriptionStatus?: SubscriptionStatus | null;
  /** Stripe customer ID */
  stripeCustomerId?: string | null;
  /** Stripe subscription ID */
  stripeSubscriptionId?: string | null;
  /** Stripe price ID */
  stripePriceId?: string | null;
  /** Current period end */
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

// ============================================================================
// Feature Policy Types
// ============================================================================

/**
 * Represents a feature policy configuration
 */
export interface FeaturePolicy {
  /** Unique identifier */
  id: string;
  /** Feature key identifier */
  featureKey: string;
  /** Global kill switch - if false, feature is disabled for everyone */
  enabled: boolean;
  /** Minimum tier required to access this feature */
  minTier: string;
  /** Rollout percentage (0-100) for gradual feature rollout */
  rolloutPercentage: number | null;
  /** Explicit allowlist of user IDs (bypasses tier check) */
  allowlist: string[] | null;
  /** Explicit denylist of user IDs (blocks access regardless of tier) */
  denylist: string[] | null;
  /** Explicit list of beta users who get access regardless of tier */
  betaUsers: string[] | null;
  /** When the policy was created */
  createdAt: Date;
  /** When the policy was last updated */
  updatedAt: Date;
}
