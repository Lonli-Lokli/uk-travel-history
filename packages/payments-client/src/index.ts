/**
 * @uth/payments-client
 * Provider-agnostic client-side payments SDK
 *
 * This package provides a stable API for payments that hides
 * provider implementation details (Stripe, Paddle, etc.)
 */

// Export domain types
export type {
  StartCheckoutInput,
  CheckoutResult,
  Entitlement,
} from './types/domain';
export {
  PaymentsError,
  PaymentsErrorCode,
  PaymentPlan,
  PaymentStatus,
} from './types/domain';

// Export public operations
export { startCheckout, isPaymentsConfigured } from './public/payments-operations';

// DO NOT export:
// - Internal provider interfaces (PaymentsClientProvider)
// - Provider adapters (StripePaymentsClientAdapter)
// - Provider resolver functions
// - Stripe/Paddle types or SDK instances
