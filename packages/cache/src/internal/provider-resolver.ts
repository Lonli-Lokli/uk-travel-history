/**
 * Provider resolver - determines which cache provider to use
 * Allows for provider injection for testing
 */

import type { CacheProvider } from './providers/interface';
import { MockCacheAdapter } from './providers/mock-adapter';
import { UpstashCacheAdapter } from './providers/upstash-provider';

let providerInstance: CacheProvider | null = null;
let injectedProvider: CacheProvider | null = null;

/**
 * Get the configured cache provider
 * Uses injected provider if set (for testing), otherwise uses environment config
 */
export function getCacheProvider(): CacheProvider {
  // If a provider has been injected (for testing), use it
  if (injectedProvider) {
    return injectedProvider;
  }

  // If we already have an instance, return it
  if (providerInstance) {
    return providerInstance;
  }

  // Determine provider from environment
  const providerType = process.env.UTH_CACHE_PROVIDER || 'upstash';

  switch (providerType.toLowerCase()) {
    case 'mock':
      providerInstance = new MockCacheAdapter();
      break;
    case 'upstash':
    default:
      providerInstance = new UpstashCacheAdapter();
      break;
  }

  // Initialize the provider
  providerInstance.initialize({ provider: providerType });

  return providerInstance;
}

/**
 * Inject a provider instance (for testing)
 * @param provider - The provider to inject, or null to clear injection
 */
export function injectCacheProvider(provider: CacheProvider | null): void {
  injectedProvider = provider;
}

/**
 * Reset the provider instance (for testing)
 */
export function resetCacheProvider(): void {
  providerInstance = null;
  injectedProvider = null;
}
