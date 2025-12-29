# @uth/db

Supabase database client with Row Level Security (RLS) and type-safe operations.

## Purpose

Provides typed database access with user-scoped and admin clients for secure data operations.

## Key Features

- **Type-Safe**: Full TypeScript support with generated types
- **RLS Support**: User-scoped and admin clients
- **Supabase Integration**: PostgreSQL with real-time capabilities
- **Migration Support**: SQL migrations in `supabase/migrations/`

## Client Types

### User-Scoped Client

Uses anon key + Clerk JWT for RLS enforcement.

```typescript
import { createUserScopedClient } from '@uth/db';

const supabase = createUserScopedClient(clerkToken);
const { data } = await supabase.from('users').select('*');
```

### Admin Client

Uses service_role key (webhooks only, bypasses RLS).

```typescript
import { createAdminClient } from '@uth/db';

const supabase = createAdminClient();
const { error } = await supabase.from('users').insert({
  clerk_user_id: 'user_123',
  email: 'user@example.com',
});
```

## Database Schema

**Tables:**

- `users` - User profiles and entitlements
- `purchase_intents` - Payment tracking
- `webhook_events` - Stripe webhook audit log

## API Reference

### `createUserScopedClient(token): SupabaseClient`

Create RLS-enforced client for user operations.

### `createAdminClient(): SupabaseClient`

Create admin client for webhook handlers.

### User Operations

- `getUserByAuthId(userId)`
- `createUser(data)`
- `updateUserByAuthId(userId, updates)`
- `deleteUserByAuthId(userId)`

### Purchase Intent Operations

- `createPurchaseIntent(data)`
- `getPurchaseIntentById(id)`
- `updatePurchaseIntent(id, updates)`

### Webhook Operations

- `hasWebhookEventBeenProcessed(eventId)`
- `recordWebhookEvent(data)`

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Testing

```bash
nx test db
```

## Related

- **[`@uth/auth/server`](../auth/server/README.md)** - User provisioning
- **[`@uth/payments/server`](../payments/server/README.md)** - Subscription management
- **[Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)** - Official docs
