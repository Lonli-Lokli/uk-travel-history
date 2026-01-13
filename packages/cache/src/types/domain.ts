/**
 * Error codes for cache operations
 */
export enum CacheErrorCode {
  /** Cache configuration is invalid or missing */
  CONFIG_ERROR = 'CONFIG_ERROR',
  /** Error from the underlying cache provider */
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  /** Network or communication error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Record not found */
  NOT_FOUND = 'NOT_FOUND',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Database error with structured information
 */
export class CacheError extends Error {
  constructor(
    public readonly code: CacheErrorCode,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'CacheError';
    Object.setPrototypeOf(this, CacheError.prototype);
  }

  /**
   * Check if this is a specific error code
   */
  is(code: CacheErrorCode): boolean {
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
