# @uth/auth/server

Provider-agnostic server-side authentication SDK for Next.js API routes and Server Components.

## Purpose

`@uth/auth/server` provides a stable API for server-side user management and JWT validation. It abstracts provider implementation details (Clerk, Firebase) and works seamlessly with `@uth/db` for user provisioning.

## Key Features

- **Provider Agnostic**: Supports Clerk and Firebase
- **Type-Safe**: Full TypeScript support
- **User Management**: Get, create, update, delete users
- **JWT Validation**: Verify and decode auth tokens
- **Supabase Integration**: Generate JWT tokens for Supabase RLS

## High-Level Design

```
┌─────────────────────────────────────────────────┐
│  API Route / Server Component                   │
│  const user = await getCurrentUser();           │
│  const users = await getUsersByEmail(email);    │
│  const token = await getSupabaseJWT(authToken); │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Public API (auth-operations.ts)                │
│  - getCurrentUser()                             │
│  - getUsersByEmail()                            │
│  - createUser() / updateUser() / deleteUser()   │
│  - getSupabaseJWT()                             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Provider Adapters                              │
│  ├─ ClerkAuthServerAdapter                      │
│  ├─ FirebaseAuthServerAdapter                   │
│  └─ MockAuthServerAdapter (testing)             │
└─────────────────────────────────────────────────┘
```

## Usage

### Get Current User (Clerk)

```typescript
import { getCurrentUser } from '@uth/auth/server';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { userId } = await auth();
  const user = await getCurrentUser(userId);

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json({ user });
}
```

### Get Users by Email

```typescript
import { getUsersByEmail } from '@uth/auth/server';

const users = await getUsersByEmail('user@example.com');
if (users.length > 0) {
  console.log('User exists:', users[0].uid);
}
```

### Generate Supabase JWT

```typescript
import { getSupabaseJWT } from '@uth/auth/server';

// Get JWT token from Clerk session
const clerkToken = await getToken({ template: 'supabase' });

// Convert to Supabase-compatible JWT
const supabaseToken = await getSupabaseJWT(clerkToken);

// Use with Supabase client
const supabase = createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${supabaseToken}` } },
});
```

### Create User

```typescript
import { createUser } from '@uth/auth/server';

const user = await createUser({
  email: 'user@example.com',
  password: 'securePassword123',
  emailVerified: false,
});
```

## API Reference

### `getCurrentUser(userId?): Promise<AuthUser | null>`

Get current authenticated user. With Clerk, pass userId from `auth()`.

### `getUsersByEmail(email): Promise<AuthUser[]>`

Find users by email address.

### `createUser(data): Promise<AuthUser>`

Create a new user account.

### `updateUser(userId, updates): Promise<void>`

Update user profile.

### `deleteUser(userId): Promise<void>`

Delete a user account.

### `getSupabaseJWT(authToken): Promise<string>`

Convert auth provider JWT to Supabase-compatible JWT.

### `verifyIdToken(token): Promise<DecodedToken>`

Verify and decode a JWT token.

## Environment Variables

**Clerk (Current):**

```bash
CLERK_SECRET_KEY=sk_...
```

**Firebase (Legacy):**

```bash
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

## Testing

```bash
nx test auth-server
```

Uses `MockAuthServerAdapter` for testing without external dependencies.

## Dependencies

- `@clerk/backend` - Clerk SDK (current provider)
- `firebase-admin` - Firebase Admin SDK (legacy provider)

## Related

- **[`@uth/auth/client`](../client/README.md)** - Client-side authentication
- **[`@uth/db`](../../db/README.md)** - User database operations
- **[Clerk + Supabase Integration](https://clerk.com/docs/integrations/databases/supabase)** - Official guide
