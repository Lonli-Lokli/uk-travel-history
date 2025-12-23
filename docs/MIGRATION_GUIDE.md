# Firebase → Clerk + Supabase Migration Guide

This document outlines the migration from Firebase Auth to Clerk + Supabase for the UK Travel History application.

## Overview

The application is transitioning from:
- **Firebase Authentication** → **Clerk** (with passkey support)
- **Firebase Firestore** → **Supabase Postgres**
- **Subscription model** → **One-time payment model**

## Architecture Changes

### Before (Firebase)
```
User → Firebase Auth → Firebase Firestore → Stripe (subscription)
```

### After (Clerk + Supabase)
```
Payment → Stripe Checkout → Webhook → Clerk User Creation → Supabase DB
└→ Passkey Enrollment Required
```

## Key Components

### 1. Supabase Schema (`supabase/migrations/001_initial_schema.sql`)

Three main tables:
- **purchase_intents**: Tracks payment flow from creation to user provisioning
- **users**: Stores app users with Clerk integration
- **webhook_events**: Idempotency and audit log for Stripe webhooks

### 2. API Routes

#### `/api/billing/checkout` (POST)
- Creates purchase_intent record
- Creates Stripe checkout session
- Returns checkout URL

#### `/api/stripe/webhook` (POST)
- Handles `checkout.session.completed` events
- Creates Clerk user (idempotent)
- Provisions access in users table
- Marks purchase_intent as complete

#### `/api/cron/supabase-keepalive` (GET)
- Prevents Supabase Free tier inactivity pause
- Runs daily via Vercel Cron
- Secured with `CRON_SECRET`

### 3. Auth Adapters

#### Clerk Client Adapter (`packages/auth-client/src/internal/providers/clerk-adapter.ts`)
- Implements `AuthClientProvider` interface
- Most methods delegate to Clerk hooks/components
- Provides passkey support detection

#### Clerk Server Adapter (`packages/auth-server/src/internal/providers/clerk-adapter.ts`)
- Implements `AuthServerProvider` interface
- Token verification via Clerk Backend SDK
- User management operations
- Creates Clerk users from webhook

## Setup Instructions

### 1. Create Clerk Application
1. Go to https://dashboard.clerk.com/
2. Create new application
3. Enable Email + Passkeys authentication
4. Copy API keys to `.env.local`:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

### 2. Create Supabase Project
1. Go to https://app.supabase.com/
2. Create new project
3. Run migration: `supabase/migrations/001_initial_schema.sql`
4. Copy keys to `.env.local`:
   ```env
   SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

### 3. Configure Stripe
1. Go to https://dashboard.stripe.com/
2. Create a one-time payment product and price
3. Create webhook endpoint: `https://your-app.vercel.app/api/stripe/webhook`
4. Configure webhook to send `checkout.session.completed` events
5. Copy keys to `.env.local`:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_ONE_TIME_PAYMENT=price_...
   ```

### 4. Configure Cron
1. Generate secure random string for `CRON_SECRET`
2. Add to `.env.local`:
   ```env
   CRON_SECRET=your-secure-random-string
   ```
3. Vercel will automatically register cron from `vercel.json`

## Payment Flow

```
1. User enters email → POST /api/billing/checkout
2. Creates purchase_intent (status: created)
3. Creates Stripe checkout session
4. Updates purchase_intent (status: checkout_created)
5. User completes payment on Stripe
6. Stripe sends webhook → POST /api/stripe/webhook
7. Webhook verifies signature
8. Records event in webhook_events (idempotency)
9. Fetches purchase_intent by session ID
10. Marks as paid
11. Creates Clerk user (or finds existing)
12. Inserts into users table (passkey_enrolled: false)
13. Marks purchase_intent as provisioned
14. User receives invitation to claim account
15. User must enroll passkey to access app
```

## Idempotency Guarantees

### Webhook Processing
- Each Stripe event recorded in `webhook_events` table
- Duplicate events skipped based on `stripe_event_id`
- Purchase intent status checked before provisioning

### User Creation
- Clerk user creation checks for existing email first
- Database insert ignores duplicate key errors (23505)
- Safe to replay webhook events

## Testing

### Unit Tests
```bash
npm test
```

### Integration Testing
1. Use Stripe CLI for webhook testing:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   stripe trigger checkout.session.completed
   ```

2. Test checkout flow:
   ```bash
   curl -X POST http://localhost:3000/api/billing/checkout \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```

3. Test cron endpoint:
   ```bash
   curl http://localhost:3000/api/cron/supabase-keepalive \
     -H "Authorization: Bearer your-cron-secret"
   ```

## Migration Steps

### Phase 1: Deploy New Infrastructure (Current)
- ✅ Supabase schema deployed
- ✅ New API routes deployed
- ✅ Clerk adapters created
- ⏳ Firebase still active (backward compatibility)

### Phase 2: Passkey Enrollment Flow (TODO)
- Create `/claim` page for post-payment setup
- Implement passkey enrollment UI
- Add middleware to enforce passkey requirement
- Update `users.passkey_enrolled` on completion

### Phase 3: Data Migration (TODO)
- Export existing Firebase data
- Transform and import to Supabase
- Update MobX stores to use Supabase

### Phase 4: Cutover (TODO)
- Switch default auth provider to Clerk
- Remove Firebase initialization
- Clean up Firebase dependencies

### Phase 5: Cleanup (TODO)
- Remove Firebase adapter files
- Remove Firebase environment variables
- Update documentation

## Rollback Plan

If issues arise:
1. Revert to previous deployment
2. Firebase remains functional
3. No data loss (dual write during transition)

## Monitoring

### Logs to Watch
- Stripe webhook failures
- Clerk user creation errors
- Supabase connection issues
- Cron job execution

### Metrics
- Successful payment → user provisioning rate
- Time from payment to account access
- Passkey enrollment completion rate

## Security Considerations

### Secrets Management
- Never commit API keys to git
- Use environment variables for all secrets
- Rotate keys periodically

### Webhook Security
- Always verify Stripe signatures
- Use raw body for signature verification
- Log suspicious requests

### Database Access
- Use service role key only on server
- RLS policies prevent unauthorized access
- Audit sensitive operations

## Support

For issues or questions:
1. Check logs in Vercel/Supabase dashboards
2. Review webhook events in Stripe Dashboard
3. See Issue #72 for discussion

## References

- [Clerk Documentation](https://clerk.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Issue #72](https://github.com/Lonli-Lokli/uk-travel-history/issues/72)
