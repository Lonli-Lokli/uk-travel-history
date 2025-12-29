/**
 * Domain types for client-side payments (provider-agnostic)
 */

/**
 * Error codes for client-side payment operations
 */
export enum PaymentsErrorCode {
  /** Payment configuration error */
  CONFIG_ERROR = 'CONFIG_ERROR',
  /** Error from the payment provider */
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  /** Network or communication error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** User cancelled the payment */
  USER_CANCELLED = 'USER_CANCELLED',
  /** Invalid input data */
  INVALID_INPUT = 'INVALID_INPUT',
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
 * Input for starting a checkout
 */
export interface StartCheckoutInput {
  /** The payment plan to purchase */
  plan: PaymentPlan;
  /** URL to redirect to on success (optional, can use default) */
  successUrl?: string;
  /** URL to redirect to on cancellation (optional, can use default) */
  cancelUrl?: string;
}

/**
 * Result of starting a checkout
 */
export interface CheckoutResult {
  /** Session ID for tracking */
  sessionId: string;
  /** Whether the user was redirected (or if redirect failed) */
  redirected: boolean;
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
 * User's entitlement/subscription information
 */
export interface Entitlement {
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
}
