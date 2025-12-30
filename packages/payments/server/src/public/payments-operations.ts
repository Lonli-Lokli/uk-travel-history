/**
 * Public API for server-side payments operations
 * Provider-agnostic interface for payment functionality
 */

import type {
  CheckoutIntent,
  CheckoutSessionRef,
  WebhookHandlerInput,
  WebhookEventResult,
  Entitlement,
  PriceIds,
  CheckoutSessionDetails,
  SubscriptionDetails,
  PriceDetails,
} from '../types/domain';
import { PaymentPlan } from '../types/domain';
import { getPaymentsProvider } from '../internal/provider-resolver';

/**
 * Create a checkout session for a user to purchase a plan
 * @param intent - Checkout intent with plan and user information
 * @returns Session reference with redirect URL
 * @throws PaymentsError if session creation fails
 */
export async function createCheckoutSession(
  intent: CheckoutIntent,
): Promise<CheckoutSessionRef> {
  const provider = getPaymentsProvider();
  return provider.createCheckoutSession(intent);
}

/**
 * Verify and retrieve checkout session
 * Use this after user returns from checkout to verify payment
 * @param sessionId - The session ID from the checkout redirect
 * @returns Entitlement information if payment succeeded, null if still pending
 * @throws PaymentsError if session not found
 */
export async function verifyCheckoutSession(
  sessionId: string,
): Promise<Entitlement | null> {
  const provider = getPaymentsProvider();
  return provider.verifyCheckoutSession(sessionId);
}

/**
 * Handle incoming webhook from payment provider
 * Verifies signature and normalizes event to domain type
 * @param input - Webhook input with body and signature
 * @returns Normalized webhook event result
 * @throws PaymentsError if signature is invalid or processing fails
 */
export async function handleWebhook(
  input: WebhookHandlerInput,
): Promise<WebhookEventResult> {
  const provider = getPaymentsProvider();
  return provider.handleWebhook(input);
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

/**
 * Get all configured price IDs
 * @returns Object with all price IDs for different plans
 */
export function getPriceIds(): PriceIds {
  const provider = getPaymentsProvider();
  return provider.getPriceIds();
}

/**
 * Get detailed price information for all plans
 * @returns Object with price details for each plan
 * @throws PaymentsError if prices cannot be retrieved
 */
export async function getPriceDetails(): Promise<PriceDetails> {
  const provider = getPaymentsProvider();
  return provider.getPriceDetails();
}

/**
 * Retrieve checkout session details
 * @param sessionId - The session ID to retrieve
 * @returns Session details
 * @throws PaymentsError if session not found
 */
export async function retrieveCheckoutSession(
  sessionId: string,
): Promise<CheckoutSessionDetails> {
  const provider = getPaymentsProvider();
  return provider.retrieveCheckoutSession(sessionId);
}

/**
 * Retrieve subscription details
 * @param subscriptionId - The subscription ID to retrieve
 * @returns Subscription details
 * @throws PaymentsError if subscription not found
 */
export async function retrieveSubscription(
  subscriptionId: string,
): Promise<SubscriptionDetails> {
  const provider = getPaymentsProvider();
  return provider.retrieveSubscription(subscriptionId);
}

/**
 * Construct and verify webhook event
 * Low-level method for webhook signature verification
 * @param body - Raw webhook body
 * @param signature - Webhook signature
 * @param secret - Webhook secret
 * @returns Provider-specific event object (e.g., Stripe.Event)
 * @throws PaymentsError if verification fails
 */
export function constructWebhookEvent(
  body: string | Buffer,
  signature: string,
  secret: string,
): any {
  const provider = getPaymentsProvider();
  return provider.constructWebhookEvent(body, signature, secret);
}

/**
 * Create a customer portal session for subscription management
 * @param customerId - The customer ID
 * @param returnUrl - URL to return to after portal session
 * @returns Portal session URL
 * @throws PaymentsError if creation fails or not supported
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const provider = getPaymentsProvider();
  if (!provider.createPortalSession) {
    throw new Error(
      'Portal session creation not supported by this payments provider',
    );
  }
  return provider.createPortalSession(customerId, returnUrl);
}

// Re-export PaymentPlan enum for convenience
export { PaymentPlan };
