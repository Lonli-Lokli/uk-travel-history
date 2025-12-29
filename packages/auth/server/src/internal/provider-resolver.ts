/**
 * Provider resolution logic
 * Determines which auth provider to use based on configuration
 */

import type {
  AuthServerProvider,
  AuthServerProviderConfig,
} from './providers/interface';
import { FirebaseAuthServerAdapter } from './providers/firebase-adapter';
import { ClerkAuthServerAdapter } from './providers/clerk-adapter';
import { AuthError, AuthErrorCode } from '../types/domain';

let cachedProvider: AuthServerProvider | undefined;

/**
 * Resolve and initialize the appropriate auth provider
 * Uses environment variable UTH_AUTH_PROVIDER to determine provider (defaults to 'clerk')
 */
export function resolveAuthProvider(
  config?: AuthServerProviderConfig,
): AuthServerProvider {
  // Return cached provider if already initialized
  if (cachedProvider) {
    return cachedProvider;
  }

  // Determine provider type from config or environment
  // Default changed to 'clerk' (was 'firebase' pre-migration)
  const providerType =
    config?.type || (process.env.UTH_AUTH_PROVIDER as any) || 'clerk';

  let provider: AuthServerProvider;

  switch (providerType) {
    case 'clerk':
      provider = new ClerkAuthServerAdapter();
      break;
    case 'firebase':
      // Legacy provider - maintained for backward compatibility
      provider = new FirebaseAuthServerAdapter();
      break;
    default:
      throw new AuthError(
        AuthErrorCode.CONFIG_ERROR,
        `Unknown auth provider: ${providerType}. Supported providers: clerk, firebase`,
      );
  }

  // Initialize the provider
  provider.initialize(config || {});

  // Cache for future use
  cachedProvider = provider;

  return provider;
}

/**
 * Get the current auth provider instance
 * Creates one if it doesn't exist
 */
export function getAuthProvider(): AuthServerProvider {
  return resolveAuthProvider();
}

/**
 * Clear the cached provider (useful for testing)
 */
export function clearAuthProviderCache(): void {
  cachedProvider = undefined;
}

/**
 * Set a custom provider (useful for testing)
 */
export function setAuthProvider(provider: AuthServerProvider): void {
  cachedProvider = provider;
}
