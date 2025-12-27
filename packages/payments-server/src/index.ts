/**
 * @uth/payments-server
 * Provider-agnostic server-side payments SDK
 *
 * This package provides a stable API for payments that hides
 * provider implementation details (Stripe, Paddle, etc.)
 */

// Export domain types
export type {
  CheckoutIntent,
  CheckoutSessionRef,
  Entitlement,
  WebhookEvent,
  WebhookEventResult,
  WebhookHandlerInput,
  PriceIds,
  CheckoutSessionDetails,
  SubscriptionDetails,
} from './types/domain';
export {
  PaymentsError,
  PaymentsErrorCode,
  PaymentPlan,
  PaymentStatus,
  WebhookEventType,
} from './types/domain';

// Export public operations
export {
  createCheckoutSession,
  verifyCheckoutSession,
  handleWebhook,
  isPaymentsConfigured,
  getPriceIds,
  retrieveCheckoutSession,
  retrieveSubscription,
  constructWebhookEvent,
  createPortalSession,
} from './public/payments-operations';

// DO NOT export:
// - Internal provider interfaces (PaymentsServerProvider)
// - Provider adapters (StripePaymentsServerAdapter)
// - Provider resolver functions
// - Stripe interop (removed to maintain abstraction)
