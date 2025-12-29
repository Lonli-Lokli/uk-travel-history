# @uth/payments/server

Provider-agnostic server-side payments SDK for Next.js API routes.

## Purpose

Handles server-side payment operations including webhook processing, subscription management, and secure Stripe interactions.

## Key Features

- **Webhook Handling**: Process Stripe webhooks with signature verification
- **Subscription Management**: Create, update, cancel subscriptions
- **Checkout Sessions**: Server-side session creation
- **Type-Safe**: Full TypeScript support with domain types

## Usage

### Create Checkout Session

```typescript
import { createCheckoutSession, PaymentPlan } from '@uth/payments/server';

export async function POST(request: Request) {
  const session = await createCheckoutSession({
    plan: PaymentPlan.PREMIUM_MONTHLY,
    userId: 'user_123',
    customerEmail: 'user@example.com',
    successUrl: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/cancel`,
    metadata: {
      userId: 'user_123',
    },
  });

  return Response.json({ sessionId: session.id, url: session.url });
}
```

### Handle Webhooks

```typescript
import { handleWebhook } from '@uth/payments/server';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  const result = await handleWebhook({
    body,
    signature,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });

  // Process webhook event
  const { event, alreadyProcessed } = result;

  if (event.type === WebhookEventType.CHECKOUT_COMPLETED) {
    // Provision user access
  }

  return Response.json({ received: true });
}
```

### Retrieve Subscription

```typescript
import { retrieveSubscription } from '@uth/payments/server';

const subscription = await retrieveSubscription('sub_123');
console.log('Status:', subscription.status);
console.log('Current period end:', subscription.currentPeriodEnd);
```

## API Reference

### `createCheckoutSession(intent): Promise<CheckoutSessionRef>`

Create Stripe Checkout session.

### `handleWebhook(input): Promise<WebhookEventResult>`

Process and verify Stripe webhook events.

### `retrieveCheckoutSession(sessionId): Promise<CheckoutSessionDetails>`

Get checkout session details.

### `retrieveSubscription(subscriptionId): Promise<SubscriptionDetails>`

Get subscription details.

### `createPortalSession(customerId, returnUrl): Promise<string>`

Create Customer Portal session URL.

## Webhook Events

Processes these Stripe events:

- `checkout.session.completed` - Initial payment/subscription
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Subscription changes
- `customer.subscription.deleted` - Cancellation
- `invoice.payment_succeeded` - Successful payment
- `invoice.payment_failed` - Failed payment

## Environment Variables

```bash
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_YEARLY_PRICE_ID=price_...
STRIPE_LIFETIME_PRICE_ID=price_...
```

## Testing

```bash
nx test payments-server
```

## Related

- **[`@uth/payments/client`](../client/README.md)** - Client-side payments
- **[`@uth/db`](../../db/README.md)** - User entitlement storage
- **[Stripe Webhooks](https://stripe.com/docs/webhooks)** - Official docs
