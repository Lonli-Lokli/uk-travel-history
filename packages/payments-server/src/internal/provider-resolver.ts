/**
 * Provider resolution logic for payments
 */

import type {
  PaymentsServerProvider,
  PaymentsServerProviderConfig,
} from './providers/interface';
import { StripePaymentsServerAdapter } from './providers/stripe-adapter';
import { PaymentsError, PaymentsErrorCode } from '../types/domain';

let cachedProvider: PaymentsServerProvider | undefined;

/**
 * Resolve and initialize the appropriate payments provider
 * Uses environment variable UTH_PAYMENTS_PROVIDER to determine provider (defaults to 'stripe')
 */
export function resolvePaymentsProvider(
  config?: PaymentsServerProviderConfig,
): PaymentsServerProvider {
  // Return cached provider if already initialized
  if (cachedProvider) {
    return cachedProvider;
  }

  // Determine provider type from config or environment
  const providerType =
    config?.type || (process.env.UTH_PAYMENTS_PROVIDER as any) || 'stripe';

  let provider: PaymentsServerProvider;

  switch (providerType) {
    case 'stripe':
      provider = new StripePaymentsServerAdapter();
      break;
    // Future providers can be added here
    // case 'paddle':
    //   provider = new PaddlePaymentsServerAdapter();
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
export function getPaymentsProvider(): PaymentsServerProvider {
  return resolvePaymentsProvider();
}

/**
 * Clear the cached provider (useful for testing)
 */
export function clearPaymentsProviderCache(): void {
  cachedProvider = undefined;
}
