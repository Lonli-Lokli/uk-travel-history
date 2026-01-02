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
  PriceDetails,
  PriceDetail,
  CheckoutSessionDetails,
  SubscriptionDetails,
  TypedWebhookEvent,
  InvoiceDetails,
  PauseCollectionInfo,
  // Webhook event types
  ParsedWebhookEvent,
  CheckoutSessionEventData,
  InvoiceEventData,
  CheckoutCompletedEvent,
  SubscriptionCreatedEvent,
  SubscriptionUpdatedEvent,
  SubscriptionDeletedEvent,
  InvoicePaymentSucceededEvent,
  InvoicePaymentFailedEvent,
  UnknownWebhookEvent,
} from './types/domain';
export {
  PaymentsError,
  PaymentsErrorCode,
  PaymentPlan,
  PaymentStatus,
  WebhookEventType,
  ProviderSubscriptionStatus,
} from './types/domain';

// Export public operations
export {
  createCheckoutSession,
  verifyCheckoutSession,
  isPaymentsConfigured,
  getPriceIds,
  getPriceDetails,
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
