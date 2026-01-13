/**
 * Provider interface for database operations
 * This interface defines the contract that all database providers must implement
 */

/**
 * Configuration for database provider
 */
export interface CacheProviderConfig {
  /** Provider type (for logging/debugging) */
  provider?: 'upstash' | 'mock' | string;
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
}
