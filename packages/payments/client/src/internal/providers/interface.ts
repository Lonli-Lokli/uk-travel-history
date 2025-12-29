/**
 * Provider interface for client-side payments
 */

import type { StartCheckoutInput, CheckoutResult } from '../../types/domain';

/**
 * Configuration for the payments provider
 */
export interface PaymentsClientProviderConfig {
  /** Provider type (for future extensibility) */
  type?: 'stripe' | 'paddle' | 'custom';
  /** Provider-specific configuration */
  options?: Record<string, unknown>;
}

/**
 * Interface that all client-side payments providers must implement
 */
export interface PaymentsClientProvider {
  /**
   * Initialize the provider with configuration
   * @throws PaymentsError if initialization fails
   */
  initialize(config: PaymentsClientProviderConfig): Promise<void> | void;

  /**
   * Check if the provider is properly configured and ready to use
   */
  isConfigured(): boolean;

  /**
   * Start checkout flow by redirecting to payment provider
   * @param checkoutUrl - The checkout URL from the server
   * @returns Checkout result with session ID
   * @throws PaymentsError if redirect fails
   */
  redirectToCheckout(checkoutUrl: string): Promise<CheckoutResult>;
}
