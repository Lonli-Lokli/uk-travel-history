// Stripe Server-Side Configuration
// Used for creating checkout sessions and processing webhooks

import Stripe from 'stripe';

// Use a placeholder key during build time if STRIPE_SECRET_KEY is not set
// This allows the build to succeed without requiring Stripe credentials
const stripeSecretKey =
  process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key_for_build';

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

// Price IDs from Stripe Dashboard
// These should be set in environment variables
export const STRIPE_PRICES = {
  PREMIUM_MONTHLY:
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY || 'price_premium_monthly',
  PREMIUM_ANNUAL:
    process.env.STRIPE_PRICE_PREMIUM_ANNUAL || 'price_premium_annual',
  PREMIUM_ONCE: process.env.STRIPE_PRICE_PREMIUM_ONCE || 'price_premium_once',
};

export { stripe as StripeAPI };