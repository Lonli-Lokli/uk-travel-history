/**
 * Provider resolution logic for client-side payments
 */

import type {
  PaymentsClientProvider,
  PaymentsClientProviderConfig,
} from './providers/interface';
import { StripePaymentsClientAdapter } from './providers/stripe-adapter';
import { PaymentsError, PaymentsErrorCode } from '../types/domain';

let cachedProvider: PaymentsClientProvider | undefined;

/**
 * Resolve and initialize the appropriate payments provider
 * Uses environment variable NEXT_PUBLIC_UTH_PAYMENTS_PROVIDER to determine provider (defaults to 'stripe')
 */
export function resolvePaymentsProvider(
  config?: PaymentsClientProviderConfig,
): PaymentsClientProvider {
  // Return cached provider if already initialized
  if (cachedProvider) {
    return cachedProvider;
  }

  // Determine provider type from config or environment
  const providerType =
    config?.type ||
    (process.env.NEXT_PUBLIC_UTH_PAYMENTS_PROVIDER as any) ||
    'stripe';

  let provider: PaymentsClientProvider;

  switch (providerType) {
    case 'stripe':
      provider = new StripePaymentsClientAdapter();
      break;
    // Future providers can be added here
    // case 'paddle':
    //   provider = new PaddlePaymentsClientAdapter();
    //   break;
    default:
      throw new PaymentsError(
        PaymentsErrorCode.CONFIG_ERROR,
        `Unknown payments provider: ${providerType}. Supported providers: stripe`,
      );
  }

  // Initialize the provider
  provider.initialize(config || {});

  // Cache for future use
  cachedProvider = provider;

  return provider;
}

/**
 * Get the current payments provider instance
 * Creates one if it doesn't exist
 */
export function getPaymentsProvider(): PaymentsClientProvider {
  return resolvePaymentsProvider();
}

/**
 * Clear the cached provider (useful for testing)
 */
export function clearPaymentsProviderCache(): void {
  cachedProvider = undefined;
}
