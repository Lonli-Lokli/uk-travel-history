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

// Re-export PaymentPlan enum for convenience
export { PaymentPlan };
