/**
 * Provider interface for server-side payments
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
} from '../../types/domain';

/**
 * Configuration for the payments provider
 */
export interface PaymentsServerProviderConfig {
  /** Provider type (for future extensibility) */
  type?: 'stripe' | 'paddle' | 'custom';
  /** Provider-specific configuration */
  options?: Record<string, unknown>;
}

/**
 * Interface that all server-side payments providers must implement
 */
export interface PaymentsServerProvider {
  /**
   * Initialize the provider with configuration
   * @throws PaymentsError if initialization fails
   */
  initialize(config: PaymentsServerProviderConfig): Promise<void> | void;

  /**
   * Check if the provider is properly configured and ready to use
   */
  isConfigured(): boolean;

  /**
   * Create a checkout session
   * @param intent - Checkout intent with plan and user information
   * @returns Session reference with redirect URL
   * @throws PaymentsError if session creation fails
   */
  createCheckoutSession(intent: CheckoutIntent): Promise<CheckoutSessionRef>;

  /**
   * Verify and retrieve checkout session
   * @param sessionId - The session ID to verify
   * @returns Entitlement information if session is complete
   * @throws PaymentsError if session not found or verification fails
   */
  verifyCheckoutSession(sessionId: string): Promise<Entitlement | null>;

  /**
   * Handle incoming webhook
   * Verifies signature and normalizes event to domain type
   * @param input - Webhook input with body and signature
   * @returns Normalized webhook event result
   * @throws PaymentsError if signature is invalid or processing fails
   */
  handleWebhook(input: WebhookHandlerInput): Promise<WebhookEventResult>;

  /**
   * Get price ID for a payment plan
   * (Internal mapping from domain plan to provider price ID)
   * @param plan - The payment plan
   * @returns Provider-specific price ID
   */
  getPriceId(plan: string): string;

  /**
   * Get all configured price IDs
   * @returns Object with all price IDs
   */
  getPriceIds(): PriceIds;

  /**
   * Retrieve checkout session details
   * @param sessionId - The session ID to retrieve
   * @returns Session details
   * @throws PaymentsError if session not found
   */
  retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionDetails>;

  /**
   * Retrieve subscription details
   * @param subscriptionId - The subscription ID to retrieve
   * @returns Subscription details
   * @throws PaymentsError if subscription not found
   */
  retrieveSubscription(subscriptionId: string): Promise<SubscriptionDetails>;

  /**
   * Construct and verify webhook event
   * Low-level method for webhook signature verification
   * @param body - Raw webhook body
   * @param signature - Webhook signature
   * @param secret - Webhook secret
   * @returns Provider-specific event object
   * @throws PaymentsError if verification fails
   */
  constructWebhookEvent(
    body: string | Buffer,
    signature: string,
    secret: string,
  ): any;
}
