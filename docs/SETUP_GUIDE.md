# Setup Guide: Public Sign-Up with RLS-Enforced Entitlements

This guide covers the complete setup for issue #100: migrating to unlocked public sign-up with Supabase RLS-enforced entitlements.

## Overview

The application now supports:

- **Public sign-up**: Users can create accounts without payment
- **Subscription tiers**: Free, Monthly, Yearly, Lifetime
- **RLS enforcement**: Database-level security for entitlements
- **Stripe integration**: Automated subscription lifecycle management

## Prerequisites

- Clerk account (for authentication)
- Supabase project (for database)
- Stripe account (for payments)
- GitHub repository (for webhook delivery)

---

## 1. Database Setup (Supabase)

### Run Migrations

Apply the following migrations in order:

```bash
# 1. Initial schema (if not already applied)
supabase migration apply 001_initial_schema.sql

# 2. Add entitlement fields
supabase migration apply 002_add_entitlements.sql

# 3. Add RLS policies
supabase migration apply 003_add_rls_policies.sql
```

### Verify Tables

Your `users` table should now have these columns:

- `id` (UUID, primary key)
- `clerk_user_id` (TEXT, unique)
- `email` (TEXT)
- `passkey_enrolled` (BOOLEAN)
- `subscription_tier` (ENUM: free, monthly, yearly, lifetime)
- `subscription_status` (ENUM: active, past_due, canceled, trialing, incomplete, unpaid)
- `stripe_customer_id` (TEXT, nullable)
- `stripe_subscription_id` (TEXT, nullable)
- `stripe_price_id` (TEXT, nullable)
- `current_period_end` (TIMESTAMPTZ, nullable)
- `created_at` (TIMESTAMPTZ)

### Verify RLS Policies

Check that RLS is enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'purchase_intents', 'webhook_events');
```

All should return `rowsecurity = true`.

---

## 2. Clerk Configuration

### Enable Public Sign-Up

1. Go to **Clerk Dashboard** → Your Application → **User & Authentication**
2. Under **Email, Phone, Username**, enable:
   - ✅ Email address
   - ✅ Allow sign-up (no payment gate)
3. Under **Social Connections**, enable (optional):
   - ✅ Google
   - ✅ GitHub
4. Under **Multi-factor**, configure passkeys (optional):
   - ✅ Passkeys available but not required

### Configure Webhook

1. Go to **Clerk Dashboard** → **Webhooks** → **Add Endpoint**
2. Set endpoint URL: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy the **Signing Secret** → set as `CLERK_WEBHOOK_SECRET` env var

### Get API Keys

1. Go to **Clerk Dashboard** → **API Keys**
2. Copy:
   - **Publishable Key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret Key** → `CLERK_SECRET_KEY`

---

## 3. Stripe Configuration

### Create Products and Prices

1. Go to **Stripe Dashboard** → **Products** → **Add Product**
2. Create three products:

**Monthly Subscription**

- Name: "UK Travel History - Monthly"
- Pricing: $9.99/month (recurring)
- Copy **Price ID** → `STRIPE_MONTHLY_PRICE_ID`

**Yearly Subscription**

- Name: "UK Travel History - Yearly"
- Pricing: $99/year (recurring)
- Copy **Price ID** → `STRIPE_YEARLY_PRICE_ID`

**Lifetime Access**

- Name: "UK Travel History - Lifetime"
- Pricing: $199 (one-time)
- Copy **Price ID** → `STRIPE_LIFETIME_PRICE_ID`

### Configure Webhook

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks** → **Add Endpoint**
2. Set endpoint URL: `https://your-domain.com/api/webhooks/stripe`
3. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy **Signing Secret** → set as `STRIPE_WEBHOOK_SECRET` env var

**For detailed webhook configuration and troubleshooting, see [STRIPE_WEBHOOK_SETUP.md](./STRIPE_WEBHOOK_SETUP.md)**

### Get API Keys

1. Go to **Stripe Dashboard** → **Developers** → **API Keys**
2. Copy:
   - **Publishable Key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret Key** → `STRIPE_SECRET_KEY`

---

## 4. Environment Variables

Create a `.env.local` file with all required variables:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe Payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from step 3)
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_YEARLY_PRICE_ID=price_...
STRIPE_LIFETIME_PRICE_ID=price_...

# Optional: Sentry (for error tracking)
SENTRY_DSN=https://...
```

---

## 5. Testing the Setup

### Test User Sign-Up (Free Tier)

1. Navigate to `/sign-up`
2. Create account with email
3. Verify user created in Supabase with:
   - `subscription_tier = 'free'`
   - `subscription_status = 'active'`

### Test Stripe Subscription Flow

**Using Stripe CLI for local testing:**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Test subscription creation:**

```bash
# Trigger subscription.created event
stripe trigger customer.subscription.created

# Check user upgraded to monthly tier in database
```

### Test RLS Policies

Run these queries as different users to verify isolation:

```sql
-- Set user context (replace with actual Clerk user ID)
SET request.jwt.claims = '{"sub": "user_abc123"}';

-- Should only return current user's data
SELECT * FROM users;

-- Should NOT return other users' data
SELECT * FROM users WHERE clerk_user_id != 'user_abc123';
-- Returns: 0 rows
```

---

## 6. Deployment Checklist

Before deploying to production:

- [ ] All migrations applied to production database
- [ ] RLS policies verified on production
- [ ] Clerk webhook endpoint configured with production URL
- [ ] Stripe webhook endpoint configured with production URL
- [ ] All environment variables set in production
- [ ] Stripe test mode disabled (use live keys)
- [ ] Test complete user flow:
  - [ ] Sign up (free tier)
  - [ ] Subscribe (upgrade to paid)
  - [ ] Payment failure handling
  - [ ] Subscription cancellation

---

## 7. Troubleshooting

### "Webhook signature verification failed"

**Cause**: Wrong webhook secret or incorrect payload
**Fix**: Ensure `STRIPE_WEBHOOK_SECRET` matches the secret from Stripe Dashboard

### "User not found for subscription"

**Cause**: User hasn't signed up yet or email mismatch
**Fix**: Ensure subscription metadata includes `email` field matching Clerk user

### "RLS policy blocks query"

**Cause**: Missing or incorrect JWT claims
**Fix**: Verify Clerk token includes `sub` claim and matches `clerk_user_id` in database

### Tests failing with "Cannot read properties of undefined (reading 'getStatus')"

**Cause**: Nx cache corruption
**Fix**: Run `npx nx reset` or clone repository fresh

---

## 8. Security Considerations

### Service Role Key Protection

The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. **NEVER** expose it to the client.

**Safe usage:**

- ✅ Stripe webhook handlers
- ✅ Clerk webhook handlers
- ✅ Admin API routes
- ❌ Browser/client code
- ❌ Public API routes

### Webhook Verification

All webhook endpoints MUST verify signatures:

```typescript
// Stripe webhooks
const signature = request.headers.get('stripe-signature');
const event = constructWebhookEvent(body, signature, WEBHOOK_SECRET);

// Clerk webhooks
const svix = new Webhook(CLERK_WEBHOOK_SECRET);
svix.verify(payload, headers);
```

### RLS Policy Testing

Always test RLS policies with different user contexts:

```sql
-- Test as User A
SET request.jwt.claims = '{"sub": "user_A"}';
SELECT * FROM users; -- Should see only User A's data

-- Test as User B
SET request.jwt.claims = '{"sub": "user_B"}';
SELECT * FROM users; -- Should see only User B's data

-- Test as anonymous
RESET request.jwt.claims;
SELECT * FROM users; -- Should see nothing (or public data only)
```

---

## 9. Next Steps

After completing this setup:

1. **Implement Premium UI** (Phase 8):
   - Create `<PremiumGate />` component
   - Add `useEntitlement()` hook
   - Gate premium features in UI

2. **Add E2E Tests** (Phase 10):
   - Test complete user journeys
   - Verify RLS enforcement
   - Test webhook idempotency

3. **Monitor in Production**:
   - Set up Sentry alerts
   - Monitor webhook delivery
   - Track subscription metrics

---

## 10. Support

For issues or questions:

- Open an issue on GitHub
- Check Sentry for error logs
- Review Clerk dashboard for auth issues
- Check Stripe dashboard for payment issues
