import { getCacheProvider } from '../internal/provider-resolver';

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
