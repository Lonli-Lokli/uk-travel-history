/**
 * Provider interface for cache operations
 * This interface defines the contract that all cache providers must implement
 */

/**
 * Configuration for cache provider
 */
export interface CacheProviderConfig {
  /** Provider type (for logging/debugging) */
  provider?: 'upstash' | 'mock' | string;
}

/**
 * Options for set operations
 */
export interface SetOptions {
  /** TTL in seconds */
  ttl?: number;
}

/**
 * Cache provider interface
 * All cache providers must implement this interface
 */
export interface CacheProvider {
  /**
   * Initialize the provider with configuration
   */
  initialize(config: CacheProviderConfig): void;

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean;

  /**
   * Get a value from the cache
   * @param key The cache key
   * @returns The cached value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in the cache
   * @param key The cache key
   * @param value The value to cache
   * @param options Optional settings (TTL, etc.)
   */
  set<T>(key: string, value: T, options?: SetOptions): Promise<void>;

  /**
   * Delete a value from the cache
   * @param key The cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a key exists in the cache
   * @param key The cache key
   * @returns true if the key exists
   */
  exists(key: string): Promise<boolean>;
}
