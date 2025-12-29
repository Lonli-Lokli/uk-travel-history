# @uth/payments/client

Provider-agnostic client-side payments SDK for React applications.

## Purpose

Abstracts payment provider implementation (Stripe) for subscription management and checkout flows.

## Key Features

- **Provider Agnostic**: Currently supports Stripe, easily extensible
- **Type-Safe**: Full TypeScript support
- **Checkout Integration**: Stripe Checkout sessions
- **Customer Portal**: Subscription management UI

## Usage

### Create Checkout Session

```typescript
import { createCheckoutSession, PaymentPlan } from '@uth/payments/client';

async function handleSubscribe() {
  const session = await createCheckoutSession({
    plan: PaymentPlan.PREMIUM_MONTHLY,
    userId: 'user_123',
    customerEmail: 'user@example.com',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
  });

  // Redirect to Stripe Checkout
  window.location.href = session.url;
}
```

### Create Customer Portal Session

```typescript
import { createPortalSession } from '@uth/payments/client';

async function openPortal() {
  const url = await createPortalSession({
    customerId: 'cus_123',
    returnUrl: 'https://example.com/account',
  });

  window.location.href = url;
}
```

## API Reference

### `createCheckoutSession(intent): Promise<CheckoutSessionRef>`

Create Stripe Checkout session for subscription or one-time payment.

### `createPortalSession(options): Promise<string>`

Create Customer Portal session for subscription management.

### `isPaymentsConfigured(): boolean`

Check if payment provider is configured.

## Payment Plans

```typescript
enum PaymentPlan {
  PREMIUM_MONTHLY = 'PREMIUM_MONTHLY',
  PREMIUM_ANNUAL = 'PREMIUM_ANNUAL',
  PREMIUM_ONCE = 'PREMIUM_ONCE', // Lifetime
}
```

## Environment Variables

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

## Testing

```bash
nx test payments-client
```

## Related

- **[`@uth/payments/server`](../server/README.md)** - Server-side payment operations
- **[`@uth/stores`](../../stores/README.md)** - Payment store (MobX)
