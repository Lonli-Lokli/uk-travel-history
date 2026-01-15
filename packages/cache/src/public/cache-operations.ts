import { getCacheProvider } from '../internal/provider-resolver';
import type { SetOptions } from '../internal/providers/interface';

/**
 * Check if the cache is properly configured
 * @returns true if configured and ready to use
 */
export function isCacheConfigured(): boolean {
  try {
    const provider = getCacheProvider();
    return provider.isConfigured();
  } catch {
    return false;
  }
}

/**
 * Public cache operations interface
 */
export interface CacheOperations {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: SetOptions): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * Get a value from the cache
 * @param key The cache key
 * @returns The cached value or null if not found
 */
export async function get<T>(key: string): Promise<T | null> {
  const provider = getCacheProvider();
  return provider.get<T>(key);
}

/**
 * Set a value in the cache
 * @param key The cache key
 * @param value The value to cache
 * @param options Optional settings (TTL, etc.)
 */
export async function set<T>(
  key: string,
  value: T,
  options?: SetOptions,
): Promise<void> {
  const provider = getCacheProvider();
  return provider.set(key, value, options);
}

/**
 * Delete a value from the cache
 * @param key The cache key
 */
export async function deleteKey(key: string): Promise<void> {
  const provider = getCacheProvider();
  return provider.delete(key);
}

/**
 * Check if a key exists in the cache
 * @param key The cache key
 * @returns true if the key exists
 */
export async function exists(key: string): Promise<boolean> {
  const provider = getCacheProvider();
  return provider.exists(key);
}

/**
 * Get cache operations object
 * Useful when you need to pass cache operations as a dependency
 */
export function getCacheOperations(): CacheOperations {
  return {
    get,
    set,
    delete: deleteKey,
    exists,
  };
}

/**
 * Create a cache operations wrapper with a default TTL
 * All set operations will use this TTL unless overridden
 * @param defaultTtl TTL in seconds
 */
export function withTTL(defaultTtl: number): CacheOperations {
  return {
    get,
    set: <T>(key: string, value: T, options?: SetOptions) =>
      set(key, value, { ttl: options?.ttl ?? defaultTtl }),
    delete: deleteKey,
    exists,
  };
}
