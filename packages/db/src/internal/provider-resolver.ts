/**
 * Provider resolver - determines which database provider to use
 * Allows for provider injection for testing
 */

import type { DbProvider } from './providers/interface';
import { SupabaseDbAdapter } from './providers/supabase-adapter';
import { MockDbAdapter } from './providers/mock-adapter';

let providerInstance: DbProvider | null = null;
let injectedProvider: DbProvider | null = null;

/**
 * Get the configured database provider
 * Uses injected provider if set (for testing), otherwise uses environment config
 */
export function getDbProvider(): DbProvider {
  // If a provider has been injected (for testing), use it
  if (injectedProvider) {
    return injectedProvider;
  }

  // If we already have an instance, return it
  if (providerInstance) {
    return providerInstance;
  }

  // Determine provider from environment
  const providerType = process.env.UTH_DB_PROVIDER || 'supabase';

  switch (providerType.toLowerCase()) {
    case 'mock':
      providerInstance = new MockDbAdapter();
      break;
    case 'supabase':
    default:
      providerInstance = new SupabaseDbAdapter();
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
export function injectDbProvider(provider: DbProvider | null): void {
  injectedProvider = provider;
}

/**
 * Reset the provider instance (for testing)
 */
export function resetDbProvider(): void {
  providerInstance = null;
  injectedProvider = null;
}
