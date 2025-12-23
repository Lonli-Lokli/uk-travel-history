/**
 * Stripe Interoperability Layer
 * Provides direct access to Stripe API instance for advanced use cases
 *
 * WARNING: These are escape hatches that bypass the SDK abstraction.
 * Use only when the SDK's provider-agnostic API doesn't support your use case.
 * Direct usage couples your code to Stripe.
 */

import type Stripe from 'stripe';
import { getPaymentsProvider } from '../internal/provider-resolver';
import { StripePaymentsServerAdapter } from '../internal/providers/stripe-adapter';

/**
 * Get Stripe API instance
 * @returns Stripe instance
 * @throws Error if Stripe is not configured or not using Stripe provider
 */
export function getStripeInstance(): Stripe {
  const provider = getPaymentsProvider();

  // Check if provider is Stripe
  if (!(provider instanceof StripePaymentsServerAdapter)) {
    throw new Error('Current payments provider is not Stripe');
  }

  // Access the internal stripe instance through type casting
  // This is safe because we verified the instance type above
  const stripeAdapter = provider as any;
  if (!stripeAdapter.stripe) {
    throw new Error('Stripe is not initialized');
  }

  return stripeAdapter.stripe;
}

/**
 * Stripe price IDs from environment variables
 * These match the price IDs configured in your Stripe Dashboard
 */
export const STRIPE_PRICES = {
  PREMIUM_MONTHLY:
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY || 'price_premium_monthly',
  PREMIUM_ANNUAL:
    process.env.STRIPE_PRICE_PREMIUM_ANNUAL || 'price_premium_annual',
  PREMIUM_ONCE: process.env.STRIPE_PRICE_PREMIUM_ONCE || 'price_premium_once',
};

/**
 * Legacy export for backwards compatibility
 * @deprecated Use getStripeInstance() instead
 */
export const StripeAPI = new Proxy({} as Stripe, {
  get(_target, prop) {
    const stripe = getStripeInstance();
    return stripe[prop as keyof Stripe];
  },
});
