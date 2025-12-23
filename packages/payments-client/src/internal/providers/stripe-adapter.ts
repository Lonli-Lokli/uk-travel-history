/**
 * Stripe implementation of PaymentsClientProvider
 */

import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { logger } from '@uth/utils';
import type {
  PaymentsClientProvider,
  PaymentsClientProviderConfig,
} from './interface';
import type { CheckoutResult } from '../../types/domain';
import { PaymentsError, PaymentsErrorCode } from '../../types/domain';

/**
 * Stripe client adapter
 */
export class StripePaymentsClientAdapter implements PaymentsClientProvider {
  private stripePromise: Promise<Stripe | null> | null = null;
  private configured = false;

  initialize(config: PaymentsClientProviderConfig): void {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      logger.warn(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined. Stripe checkout will not work.',
      );
      return;
    }

    this.stripePromise = loadStripe(publishableKey);
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private async ensureConfigured(): Promise<Stripe> {
    if (!this.stripePromise) {
      throw new PaymentsError(
        PaymentsErrorCode.CONFIG_ERROR,
        'Stripe is not initialized. Check NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.',
      );
    }

    const stripe = await this.stripePromise;

    if (!stripe) {
      throw new PaymentsError(
        PaymentsErrorCode.PROVIDER_ERROR,
        'Failed to load Stripe.js',
      );
    }

    return stripe;
  }

  async redirectToCheckout(checkoutUrl: string): Promise<CheckoutResult> {
    // Extract session ID from Stripe checkout URL
    // Stripe checkout URLs are in the format: https://checkout.stripe.com/c/pay/{SESSION_ID}#...
    // or for Checkout Sessions: the URL parameter ?session_id=...
    const url = new URL(checkoutUrl);
    let sessionId = url.searchParams.get('session_id');

    if (!sessionId) {
      // Try to extract from path for hosted checkout
      const pathMatch = checkoutUrl.match(/\/c\/pay\/([^#?]+)/);
      sessionId = pathMatch ? pathMatch[1] : '';
    }

    // For Stripe, we just redirect to the URL
    // The redirect happens via window.location
    if (typeof window !== 'undefined') {
      window.location.href = checkoutUrl;
    }

    return {
      sessionId: sessionId || 'unknown',
      redirected: true,
    };
  }
}
