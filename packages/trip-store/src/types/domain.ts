/**
 * Domain types for trip store operations
 */

/**
 * Error codes for trip store operations
 */
export enum TripStoreErrorCode {
  /** Configuration is invalid or missing */
  CONFIG_ERROR = 'CONFIG_ERROR',
  /** Error from the underlying storage provider */
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  /** Session not found or invalid */
  SESSION_ERROR = 'SESSION_ERROR',
  /** Trip not found */
  NOT_FOUND = 'NOT_FOUND',
  /** Validation error (invalid input) */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Trip store error with structured information
 */
export class TripStoreError extends Error {
  constructor(
    public readonly code: TripStoreErrorCode,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'TripStoreError';
    Object.setPrototypeOf(this, TripStoreError.prototype);
  }

  /**
   * Check if this is a specific error code
   */
  is(code: TripStoreErrorCode): boolean {
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
 * Context for trip store operations
 * Determines which storage backend to use
 */
export interface TripStoreContext {
  /** User ID if authenticated and paid */
  userId: string | null;
  /** Session ID from cookie (for anonymous/free users) */
  sessionId: string | null;
  /** Whether user is on a paid tier */
  isPaidUser: boolean;
}
