/**
 * @uth/cache
 * Provider-agnostic cache SDK
 *
 * This package provides a stable API for cache operations that hides
 * provider implementation details (Upstash, etc.)
 */

export { CacheError, CacheErrorCode } from './types/domain';

// Export public operations
export {
  isCacheConfigured,
  get,
  set,
  deleteKey,
  exists,
  setIfNotExists,
  getCacheOperations,
  withTTL,
  type CacheOperations,
} from './public/cache-operations';

// Export SetOptions type for consumers
export type { SetOptions } from './internal/providers/interface';

// Export testing utilities (for internal use only - consumers should use public API)
export {
  injectCacheProvider,
  resetCacheProvider,
} from './internal/provider-resolver';
export { MockCacheAdapter } from './internal/providers/mock-adapter';

// DO NOT export:
// - Internal provider interfaces (CacheProvider)
// - Provider adapters (UpstashCacheAdapter)
// - Upstash types (Cache)
// - Upstash client functions (these are now internal to the adapter)
