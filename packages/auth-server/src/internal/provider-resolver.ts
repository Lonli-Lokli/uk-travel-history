/**
 * Provider resolution logic
 * Determines which auth provider to use based on configuration
 */

import type {
  AuthServerProvider,
  AuthServerProviderConfig,
} from './providers/interface';
import { FirebaseAuthServerAdapter } from './providers/firebase-adapter';
import { AuthError, AuthErrorCode } from '../types/domain';

let cachedProvider: AuthServerProvider | undefined;

/**
 * Resolve and initialize the appropriate auth provider
 * Uses environment variable UTH_AUTH_PROVIDER to determine provider (defaults to 'firebase')
 */
export function resolveAuthProvider(
  config?: AuthServerProviderConfig,
): AuthServerProvider {
  // Return cached provider if already initialized
  if (cachedProvider) {
    return cachedProvider;
  }

  // Determine provider type from config or environment
  const providerType =
    config?.type || (process.env.UTH_AUTH_PROVIDER as any) || 'firebase';

  let provider: AuthServerProvider;

  switch (providerType) {
    case 'firebase':
      provider = new FirebaseAuthServerAdapter();
      break;
    // Future providers can be added here
    // case 'clerk':
    //   provider = new ClerkAuthServerAdapter();
    //   break;
    default:
      throw new AuthError(
        AuthErrorCode.CONFIG_ERROR,
        `Unknown auth provider: ${providerType}. Supported providers: firebase`,
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
