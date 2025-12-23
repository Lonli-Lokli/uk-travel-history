/**
 * Public API for client-side payments operations
 * Provider-agnostic interface for payment functionality
 */

import type { StartCheckoutInput, CheckoutResult } from '../types/domain';
import { PaymentPlan } from '../types/domain';
import { getPaymentsProvider } from '../internal/provider-resolver';

/**
 * Start checkout flow
 * This function should be called with a checkout URL obtained from the server
 * It will redirect the user to the payment provider's checkout page
 *
 * @param checkoutUrl - The checkout URL from createCheckoutSession on the server
 * @returns Checkout result with session ID
 * @throws PaymentsError if redirect fails
 */
export async function startCheckout(
  checkoutUrl: string,
): Promise<CheckoutResult> {
  const provider = getPaymentsProvider();
  return provider.redirectToCheckout(checkoutUrl);
}

/**
 * Check if payments are properly configured
 * @returns true if configured and ready to use
 */
export function isPaymentsConfigured(): boolean {
  try {
    const provider = getPaymentsProvider();
    return provider.isConfigured();
  } catch {
    return false;
  }
}

// Re-export PaymentPlan enum for convenience
export { PaymentPlan };
