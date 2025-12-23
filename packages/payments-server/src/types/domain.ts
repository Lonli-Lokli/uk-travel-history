/**
 * Domain types for payments (provider-agnostic)
 * These types define the public API contract and do not expose provider-specific types
 */

/**
 * Error codes for payment operations
 */
export enum PaymentsErrorCode {
  /** Invalid webhook signature */
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  /** Resource not found */
  NOT_FOUND = 'NOT_FOUND',
  /** Event already processed (idempotency) */
  ALREADY_PROCESSED = 'ALREADY_PROCESSED',
  /** Payment configuration error */
  CONFIG_ERROR = 'CONFIG_ERROR',
  /** Error from the payment provider */
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  /** Invalid input data */
  INVALID_INPUT = 'INVALID_INPUT',
  /** Network or communication error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Payment error with structured information
 */
export class PaymentsError extends Error {
  constructor(
    public readonly code: PaymentsErrorCode,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'PaymentsError';
    Object.setPrototypeOf(this, PaymentsError.prototype);
  }

  /**
   * Check if this is a specific error code
   */
  is(code: PaymentsErrorCode): boolean {
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
 * Payment plan/price tier
 */
export enum PaymentPlan {
  PREMIUM_MONTHLY = 'PREMIUM_MONTHLY',
  PREMIUM_ANNUAL = 'PREMIUM_ANNUAL',
  PREMIUM_ONCE = 'PREMIUM_ONCE',
}

/**
 * Input for creating a checkout session
 */
export interface CheckoutIntent {
  /** The payment plan to purchase */
  plan: PaymentPlan;
  /** User ID purchasing the plan */
  userId: string;
  /** URL to redirect to on success */
  successUrl: string;
  /** URL to redirect to on cancellation */
  cancelUrl: string;
  /** Optional metadata */
  metadata?: Record<string, string>;
}

/**
 * Reference to a checkout session
 */
export interface CheckoutSessionRef {
  /** Unique session identifier */
  id: string;
  /** URL to redirect user to complete checkout */
  url: string;
  /** When the session expires */
  expiresAt: Date;
}

/**
 * Payment status
 */
export enum PaymentStatus {
  /** Payment is pending */
  PENDING = 'PENDING',
  /** Payment succeeded */
  SUCCEEDED = 'SUCCEEDED',
  /** Payment failed */
  FAILED = 'FAILED',
  /** Payment was cancelled */
  CANCELLED = 'CANCELLED',
  /** Payment is processing */
  PROCESSING = 'PROCESSING',
}

/**
 * Entitlement/subscription information
 */
export interface Entitlement {
  /** User ID */
  userId: string;
  /** Payment plan */
  plan: PaymentPlan;
  /** Payment status */
  status: PaymentStatus;
  /** When the entitlement starts */
  startDate: Date;
  /** When the entitlement ends (for subscriptions) */
  endDate?: Date;
  /** Whether this is an active subscription */
  isActive: boolean;
  /** Subscription ID (for recurring payments) */
  subscriptionId?: string;
}

/**
 * Webhook event types
 */
export enum WebhookEventType {
  /** Checkout session completed */
  CHECKOUT_COMPLETED = 'CHECKOUT_COMPLETED',
  /** Payment succeeded */
  PAYMENT_SUCCEEDED = 'PAYMENT_SUCCEEDED',
  /** Payment failed */
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  /** Subscription created */
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  /** Subscription updated */
  SUBSCRIPTION_UPDATED = 'SUBSCRIPTION_UPDATED',
  /** Subscription cancelled */
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  /** Unknown event type */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Normalized webhook event
 */
export interface WebhookEvent {
  /** Event ID (for idempotency) */
  id: string;
  /** Event type */
  type: WebhookEventType;
  /** Event timestamp */
  timestamp: Date;
  /** User ID associated with this event */
  userId?: string;
  /** Payment plan */
  plan?: PaymentPlan;
  /** Payment status */
  status?: PaymentStatus;
  /** Checkout session ID */
  sessionId?: string;
  /** Subscription ID */
  subscriptionId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of processing a webhook
 */
export interface WebhookEventResult {
  /** The normalized event */
  event: WebhookEvent;
  /** Whether this event was already processed (idempotency check) */
  alreadyProcessed: boolean;
  /** Any actions taken (for logging/debugging) */
  actions?: string[];
}

/**
 * Input for webhook handler
 */
export interface WebhookHandlerInput {
  /** Raw webhook body (as string or buffer) */
  body: string | Buffer;
  /** Webhook signature header (for verification) */
  signature: string;
  /** Additional headers (if needed) */
  headers?: Record<string, string>;
}

/**
 * Price IDs for different payment plans
 */
export interface PriceIds {
  PREMIUM_MONTHLY: string;
  PREMIUM_ANNUAL: string;
  PREMIUM_ONCE: string;
}

/**
 * Checkout session details (provider-agnostic)
 */
export interface CheckoutSessionDetails {
  /** Session ID */
  id: string;
  /** Payment status */
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
  /** Customer ID (Stripe customer ID, etc.) */
  customerId?: string;
  /** Subscription ID (if subscription mode) */
  subscriptionId?: string;
  /** Session metadata */
  metadata?: Record<string, string | null>;
  /** Customer email */
  customerEmail?: string;
}

/**
 * Subscription details (provider-agnostic)
 */
export interface SubscriptionDetails {
  /** Subscription ID */
  id: string;
  /** Customer ID */
  customerId: string;
  /** Subscription status */
  status: string;
  /** Current period start timestamp (seconds) */
  currentPeriodStart: number;
  /** Current period end timestamp (seconds) */
  currentPeriodEnd: number;
  /** Cancel at period end flag */
  cancelAtPeriodEnd: boolean;
  /** Price ID */
  priceId?: string;
  /** Subscription metadata */
  metadata?: Record<string, string | null>;
}
