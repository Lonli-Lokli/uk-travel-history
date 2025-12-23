/**
 * Provider resolution logic for client-side auth
 */

import type {
  AuthClientProvider,
  AuthClientProviderConfig,
} from './providers/interface';
import { FirebaseAuthClientAdapter } from './providers/firebase-adapter';
import { ClerkAuthClientAdapter } from './providers/clerk-adapter';
import { AuthError, AuthErrorCode } from '../types/domain';

let cachedProvider: AuthClientProvider | undefined;

/**
 * Resolve and initialize the appropriate auth provider
 * Uses environment variable NEXT_PUBLIC_UTH_AUTH_PROVIDER to determine provider (defaults to 'clerk')
 */
export function resolveAuthProvider(
  config?: AuthClientProviderConfig,
): AuthClientProvider {
  // Return cached provider if already initialized
  if (cachedProvider) {
    return cachedProvider;
  }

  // Determine provider type from config or environment
  // Default changed to 'clerk' (was 'firebase' pre-migration)
  const providerType =
    config?.type ||
    (process.env.NEXT_PUBLIC_UTH_AUTH_PROVIDER as any) ||
    'clerk';

  let provider: AuthClientProvider;

  switch (providerType) {
    case 'clerk':
      provider = new ClerkAuthClientAdapter();
      break;
    case 'firebase':
      // Legacy provider - maintained for backward compatibility
      provider = new FirebaseAuthClientAdapter();
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
export function getAuthProvider(): AuthClientProvider {
  return resolveAuthProvider();
}

/**
 * Clear the cached provider (useful for testing)
 */
export function clearAuthProviderCache(): void {
  cachedProvider = undefined;
}
