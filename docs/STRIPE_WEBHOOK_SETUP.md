# Stripe Webhook Configuration Guide

This document provides a comprehensive guide for configuring Stripe webhooks required by the UK Travel History application.

## Overview

The application uses Stripe webhooks as the **single source of truth** for subscription lifecycle management. All subscription state changes, payment events, and user entitlements are synchronized through webhook events.

## Required Webhook Events

Configure these events in your Stripe Dashboard to ensure proper subscription handling:

### Event Configuration Table

| Event Type | Purpose | Database Impact | Required |
|-----------|---------|----------------|----------|
| `checkout.session.completed` | Provisions new users after payment | Creates user record (legacy flow) or triggers subscription creation | ✅ **Critical** |
| `customer.subscription.created` | Syncs new subscription to database | Creates/updates user subscription tier and status | ✅ **Critical** |
| `customer.subscription.updated` | Syncs subscription changes | Updates tier, status, cancel_at_period_end, pause state | ✅ **Critical** |
| `customer.subscription.deleted` | Handles subscription cancellation | Downgrades user to free tier, preserves grace period | ✅ **Critical** |
| `invoice.payment_succeeded` | Reactivates after successful payment | Changes status from past_due/unpaid to active | ✅ **Critical** |
| `invoice.payment_failed` | Handles failed payments | Marks subscription as past_due (Stripe will retry) | ✅ **Critical** |

## Step-by-Step Setup

### 1. Access Stripe Webhook Settings

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Click **Add endpoint**

### 2. Configure Endpoint URL

**Production:**
```
https://your-domain.com/api/webhooks/stripe
```

**Development (using Stripe CLI):**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 3. Select Events to Listen To

In the Stripe Dashboard webhook configuration, select these events:

#### Subscription Lifecycle Events

- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`

#### Payment Events

- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`

#### Checkout Events

- ✅ `checkout.session.completed`

### 4. Copy Webhook Signing Secret

1. After creating the endpoint, Stripe will display a **Signing secret**
2. Copy this value (it starts with `whsec_`)
3. Set it as the `STRIPE_WEBHOOK_SECRET` environment variable

**Example:**
```bash
STRIPE_WEBHOOK_SECRET=whsec_abc123xyz...
```

### 5. Verify Configuration

After setup, verify your webhook endpoint is receiving events:

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click on your endpoint
3. Check **Recent deliveries** tab
4. Look for successful (200 OK) responses

## Event Handling Details

### `checkout.session.completed`

**Purpose:** Initiates user provisioning and subscription setup

**What Happens:**
- **Authenticated checkout (new flow):** User already exists via Clerk, subscription webhooks handle entitlement
- **Legacy flow:** Creates auth user, database record, and purchase intent

**Metadata Required:**
- `userId` (for authenticated checkouts)
- `email` (for user identification)
- `purchase_intent_id` (legacy flow only)

**Database Changes:**
- Creates user record if doesn't exist (legacy flow)
- Records purchase intent status

---

### `customer.subscription.created`

**Purpose:** Provisions subscription entitlements when user subscribes

**What Happens:**
- Maps Stripe price ID to subscription tier (monthly/yearly/lifetime)
- Creates or updates user record with subscription details
- Sets initial subscription status and period end date

**Metadata Required:**
- `userId` (Clerk user ID) OR `email`

**Database Changes:**
- Sets `subscription_tier` (monthly/yearly/lifetime)
- Sets `subscription_status` (active/trialing/etc.)
- Sets `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`
- Sets `current_period_end` (for billing cycle tracking)

---

### `customer.subscription.updated`

**Purpose:** Syncs subscription changes (upgrades, downgrades, cancellations, pauses)

**What Happens:**
- Updates subscription tier if price changed
- Updates status (active → past_due, etc.)
- Tracks `cancel_at_period_end` flag for scheduled cancellations
- Tracks `pause_collection.resumes_at` for paused subscriptions

**Metadata Required:**
- `userId` OR `email`

**Database Changes:**
- Updates `subscription_tier`, `subscription_status`
- Updates `cancel_at_period_end` (boolean)
- Updates `pause_resumes_at` (timestamp for paused subscriptions)
- Updates `current_period_end`

**Key States Handled:**
- **Scheduled cancellation:** `cancel_at_period_end=true` (user keeps access until period ends)
- **Paused subscription:** `status=paused`, `pause_resumes_at` set
- **Plan change:** Updates tier and price ID

---

### `customer.subscription.deleted`

**Purpose:** Handles final subscription cancellation

**What Happens:**
- Downgrades user to free tier
- Clears subscription ID (no longer active)
- Preserves `current_period_end` for grace period access

**Metadata Required:**
- `userId` OR `email`

**Database Changes:**
- Sets `subscription_tier = 'free'`
- Sets `subscription_status = null` (free tier has no status)
- Sets `stripe_subscription_id = null`
- Preserves `current_period_end` (allows access until period expires)

**Grace Period:**
Users maintain access until `current_period_end` even after cancellation.

---

### `invoice.payment_succeeded`

**Purpose:** Reactivates subscription after successful payment retry

**What Happens:**
- Finds user by customer email
- If status was `past_due` or `unpaid`, changes to `active`

**Database Changes:**
- Updates `subscription_status` from `past_due`/`unpaid` to `active`

**Use Case:**
When a payment fails initially but succeeds on retry, this event restores access.

---

### `invoice.payment_failed`

**Purpose:** Marks subscription as past due when payment fails

**What Happens:**
- Finds user by customer email
- Marks subscription as `past_due` (Stripe will retry payment)

**Database Changes:**
- Sets `subscription_status = 'past_due'`

**Stripe Behavior:**
Stripe automatically retries failed payments using Smart Retries. This event alerts the system but doesn't immediately cancel access.

---

## Subscription State Machine

This diagram shows how webhook events transition subscription states:

```
┌─────────────────────────────────────────────────────────────┐
│                     SUBSCRIPTION LIFECYCLE                   │
└─────────────────────────────────────────────────────────────┘

checkout.session.completed (authenticated)
              ↓
  customer.subscription.created
              ↓
          [ACTIVE]
              │
              ├─→ customer.subscription.updated (cancel_at_period_end=true)
              │   → [ACTIVE with scheduled cancel]
              │   → customer.subscription.deleted (at period end)
              │   → [CANCELED / FREE TIER]
              │
              ├─→ invoice.payment_failed
              │   → [PAST_DUE]
              │   → invoice.payment_succeeded
              │   → [ACTIVE]
              │
              ├─→ customer.subscription.updated (pause_collection)
              │   → [PAUSED]
              │   → customer.subscription.updated (resume)
              │   → [ACTIVE]
              │
              └─→ customer.subscription.updated (plan change)
                  → [ACTIVE with new tier]
```

## Testing Webhooks Locally

### Using Stripe CLI

1. **Install Stripe CLI:**
```bash
brew install stripe/stripe-cli/stripe
# or
scoop install stripe
```

2. **Login to Stripe:**
```bash
stripe login
```

3. **Forward webhooks to local server:**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

4. **Trigger test events:**
```bash
# Test subscription creation
stripe trigger customer.subscription.created

# Test payment failure
stripe trigger invoice.payment_failed

# Test subscription update
stripe trigger customer.subscription.updated
```

### Verify Event Processing

Check application logs for:
```
[INFO] Processing customer.subscription.created { subscriptionId: 'sub_...' }
[INFO] Updated user subscription to monthly { authUserId: '...', subscriptionId: '...' }
```

## Troubleshooting

### "Webhook signature verification failed"

**Cause:** Incorrect `STRIPE_WEBHOOK_SECRET` or request body modification

**Fix:**
1. Verify `STRIPE_WEBHOOK_SECRET` matches the value in Stripe Dashboard
2. Ensure webhook endpoint reads raw request body (not JSON-parsed)
3. Check that no middleware is modifying the request body

**Code Reference:** `apps/uk-travel-history/src/app/api/webhooks/stripe/route.ts:41`

---

### "Event already processed, skipping"

**Cause:** Webhook event with same `event.id` received multiple times (normal behavior)

**Explanation:** This is **expected and correct**. Stripe may retry webhook delivery if previous attempt failed or timed out. The application uses idempotency to prevent duplicate processing.

**Database Table:** `webhook_events` stores processed event IDs

---

### "No userId or email in subscription metadata"

**Cause:** Subscription created without required metadata

**Fix:**
Ensure checkout session or subscription includes metadata:
```typescript
const session = await stripe.checkout.sessions.create({
  metadata: {
    userId: user.id,  // Clerk user ID
    email: user.email, // User email
  },
  // ... other params
});
```

---

### "User not found in database for subscription"

**Cause:** Subscription webhook received before Clerk webhook provisions user

**Fix:**
- Timing issue - Clerk webhook should create user first
- Check Clerk webhook is configured and processing correctly
- Verify user exists in Supabase `users` table

**Fallback:** Handler will attempt to create user if email is available

---

### Webhook not receiving events

**Checklist:**
- [ ] Endpoint URL is correct and publicly accessible
- [ ] Events are selected in Stripe Dashboard
- [ ] Firewall/proxy allows Stripe IPs
- [ ] Application is running and `/api/webhooks/stripe` route exists
- [ ] Check Stripe Dashboard → Webhooks → Recent deliveries for errors

---

## Security Considerations

### Signature Verification

**CRITICAL:** Always verify webhook signatures before processing

```typescript
const signature = request.headers.get('stripe-signature');
const event = constructWebhookEvent(body, signature, WEBHOOK_SECRET);
```

**Why:** Prevents malicious requests from impersonating Stripe

**Reference:** `apps/uk-travel-history/src/app/api/webhooks/stripe/route.ts:59-74`

---

### Idempotency

All webhook handlers are idempotent - processing same event multiple times produces same result:

1. **Event deduplication:** `webhook_events` table records processed event IDs
2. **Database constraints:** Unique constraints prevent duplicate users/subscriptions
3. **Graceful handling:** Handlers check existing state before updating

**Reference:** `apps/uk-travel-history/src/app/api/webhooks/stripe/route.ts:76-82`

---

### Webhook Secret Protection

**Environment Variable:** `STRIPE_WEBHOOK_SECRET`

**Security Rules:**
- ✅ Store in environment variables
- ✅ Rotate periodically
- ✅ Use different secrets for test/production
- ❌ Never commit to version control
- ❌ Never expose in client-side code

---

## Production Deployment Checklist

Before going live:

- [ ] Configure webhook endpoint with production URL
- [ ] Use **live mode** Stripe keys (not test mode)
- [ ] Set production `STRIPE_WEBHOOK_SECRET` environment variable
- [ ] Test all 6 webhook events in production environment
- [ ] Monitor webhook deliveries in Stripe Dashboard
- [ ] Set up alerting for failed webhook deliveries
- [ ] Verify RLS policies protect subscription data

---

## Monitoring & Observability

### Webhook Delivery Monitoring

**Stripe Dashboard:**
1. Navigate to **Developers** → **Webhooks**
2. Click on your endpoint
3. Review **Recent deliveries** tab
4. Check for failed (non-200) responses

### Application Logging

All webhook events are logged with structured context:

```typescript
getRouteLogger().info('Processing customer.subscription.updated', {
  extra: { subscriptionId: subscription.id },
});
```

**Log Locations:**
- Sentry (if configured)
- Application logs
- Vercel logs (if deployed on Vercel)

### Key Metrics to Track

- Webhook delivery success rate (should be >99%)
- Time to process webhook (should be <2s)
- Failed payment recovery rate
- Subscription churn rate

---

## Additional Resources

### Stripe Documentation
- [Webhooks Guide](https://stripe.com/docs/webhooks)
- [Webhook Event Types](https://stripe.com/docs/api/events/types)
- [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)

### Application Code References
- Webhook handler: `apps/uk-travel-history/src/app/api/webhooks/stripe/route.ts`
- Database schema: `supabase/migrations/`
- Setup guide: `docs/SETUP_GUIDE.md`

### Related Issues
- Issue #100: Public sign-up with RLS entitlements
- Issue #128: Subscription lifecycle audit and fixes

---

## Support

For issues or questions:

- **GitHub Issues:** [uk-travel-history/issues](https://github.com/Lonli-Lokli/uk-travel-history/issues)
- **Stripe Support:** [support.stripe.com](https://support.stripe.com)
- **Webhook Testing:** Use `stripe trigger` CLI commands
