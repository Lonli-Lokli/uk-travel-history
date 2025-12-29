# @uth/auth/client

Provider-agnostic client-side authentication SDK for React applications.

## Purpose

`@uth/auth/client` provides a stable, type-safe API for authentication that abstracts away provider implementation details (Clerk, Firebase, etc.). This allows the application to switch authentication providers without changing consuming code.

## Key Features

- **Provider Agnostic**: Works with multiple auth providers (currently supports Clerk and Firebase)
- **Type-Safe**: Full TypeScript support with strong typing
- **React Hook**: `useAuth()` hook for reactive authentication state
- **Passkey Support**: Built-in passkey (WebAuthn) authentication
- **Error Handling**: Unified error codes across all providers

## High-Level Design

```
┌─────────────────────────────────────────────────┐
│  React Component                                │
│  const { user, loading } = useAuth();           │
│  await signIn(credentials);                     │
│  await signOut();                                │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Public API (auth-operations.ts)                │
│  - getCurrentUser()                             │
│  - signIn() / signOut()                         │
│  - getIdToken()                                  │
│  - onAuthStateChanged()                         │
│  - passkey operations                           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Provider Resolver                              │
│  - Detects auth provider from env               │
│  - Returns appropriate adapter                  │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Provider Adapters                              │
│  ├─ ClerkAuthClientAdapter                      │
│  └─ FirebaseAuthClientAdapter                   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  External Service (Clerk / Firebase)            │
└─────────────────────────────────────────────────┘
```

## Usage

### useAuth Hook

The primary way to consume authentication state in React components:

```typescript
import { useAuth } from '@uth/auth/client';

function MyComponent() {
  const { user, loading, error } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>Not authenticated</div>;

  return (
    <div>
      <h1>Welcome, {user.displayName}!</h1>
      <p>Email: {user.email}</p>
      <p>User ID: {user.uid}</p>
    </div>
  );
}
```

### Sign In

```typescript
import { signIn } from '@uth/auth/client';

async function handleSignIn(email: string, password: string) {
  try {
    const result = await signIn({ email, password });
    console.log('Signed in:', result.user.uid);
  } catch (error) {
    if (error.code === 'auth/invalid-credentials') {
      console.error('Invalid email or password');
    } else if (error.code === 'auth/user-not-found') {
      console.error('No account found with this email');
    }
  }
}
```

### Sign Out

```typescript
import { signOut } from '@uth/auth/client';

async function handleSignOut() {
  await signOut();
  // User is now signed out
}
```

### Passkey Authentication

```typescript
import { isPasskeySupported, signInWithPasskey, registerPasskey } from '@uth/auth/client';

// Check if passkeys are supported
if (isPasskeySupported()) {
  // Register a passkey for current user
  await registerPasskey('my-device-name');

  // Sign in with passkey
  const result = await signInWithPasskey();
}
```

### Get ID Token

```typescript
import { getIdToken } from '@uth/auth/client';

async function callApi() {
  const token = await getIdToken();

  const response = await fetch('/api/protected', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
```

### Auth State Listener

```typescript
import { onAuthStateChanged } from '@uth/auth/client';

// Subscribe to auth state changes
const unsubscribe = onAuthStateChanged((state) => {
  if (state.user) {
    console.log('User signed in:', state.user.uid);
  } else {
    console.log('User signed out');
  }
});

// Later, unsubscribe
unsubscribe();
```

## API Reference

### Types

#### `AuthUser`

```typescript
interface AuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
}
```

#### `AuthState`

```typescript
interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error?: AuthError;
}
```

#### `AuthError`

```typescript
class AuthError extends Error {
  code: AuthErrorCode;
  originalError?: unknown;
}

enum AuthErrorCode {
  INVALID_CREDENTIALS = 'auth/invalid-credentials',
  USER_NOT_FOUND = 'auth/user-not-found',
  EMAIL_IN_USE = 'auth/email-already-in-use',
  WEAK_PASSWORD = 'auth/weak-password',
  NETWORK_ERROR = 'auth/network-request-failed',
  PERMISSION_DENIED = 'auth/permission-denied',
  UNAUTHENTICATED = 'auth/unauthenticated',
  UNKNOWN = 'auth/unknown',
}
```

### Functions

#### `useAuth(): AuthState`

React hook that provides current authentication state.

#### `getCurrentUser(): AuthUser | null`

Get the currently signed-in user (synchronous).

#### `signIn(credentials): Promise<SignInResult>`

Sign in with email and password.

#### `signOut(): Promise<void>`

Sign out the current user.

#### `getIdToken(forceRefresh?: boolean): Promise<string | null>`

Get the ID token for the current user.

#### `onAuthStateChanged(callback): () => void`

Subscribe to authentication state changes. Returns unsubscribe function.

#### `createUser(credentials): Promise<SignInResult>`

Create a new user account.

#### `sendPasswordResetEmail(email): Promise<void>`

Send password reset email.

#### `updateProfile(profile): Promise<void>`

Update user profile (displayName, photoURL).

#### `isAuthConfigured(): boolean`

Check if authentication is configured and ready.

#### `isPasskeySupported(): boolean`

Check if passkeys (WebAuthn) are supported in current environment.

#### `signInWithPasskey(): Promise<SignInResult>`

Sign in using a passkey.

#### `registerPasskey(deviceName): Promise<void>`

Register a new passkey for the current user.

#### `registerPasskeyAnonymous(deviceName): Promise<void>`

Register a passkey without being signed in.

## Provider Support

### Current Provider: Clerk

The app currently uses Clerk for authentication. The Clerk adapter provides:

- Modal-based sign-in/sign-up UI
- JWT token generation for Supabase RLS
- User management and profiles
- Session management

**Environment Variables:**

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

### Legacy Provider: Firebase

Firebase support is maintained for backward compatibility.

**Environment Variables:**

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

## Error Handling

All errors are normalized to `AuthError` with consistent error codes:

```typescript
try {
  await signIn({ email, password });
} catch (error) {
  if (error instanceof AuthError) {
    switch (error.code) {
      case AuthErrorCode.INVALID_CREDENTIALS:
        showError('Invalid email or password');
        break;
      case AuthErrorCode.USER_NOT_FOUND:
        showError('No account found');
        break;
      case AuthErrorCode.NETWORK_ERROR:
        showError('Network error, please try again');
        break;
      default:
        showError('Authentication failed');
    }
  }
}
```

## Testing

```bash
nx test auth-client
```

## Dependencies

- `@clerk/nextjs` - Clerk SDK (current provider)
- `firebase` - Firebase SDK (legacy provider)
- `react` ^19.0.0

## Related Packages

- **[`@uth/auth/server`](../server/README.md)** - Server-side authentication
- **[`@uth/stores`](../../stores/README.md)** - MobX auth store
- **[`@uth/db`](../../db/README.md)** - User provisioning and database

## Architecture Notes

### Provider Pattern

The library uses the Adapter pattern to support multiple authentication providers:

1. **Provider Interface** (`AuthClientProvider`) - Defines required operations
2. **Provider Adapters** - Implement interface for specific provider (Clerk, Firebase)
3. **Provider Resolver** - Detects and returns appropriate adapter based on env vars
4. **Public API** - Stable API that delegates to resolved provider

This pattern allows switching providers by changing environment variables without modifying application code.

### Why Provider Agnostic?

- **Future-Proof**: Easy to migrate to different auth provider
- **Testing**: Can mock authentication without provider dependencies
- **Flexibility**: Support multiple providers simultaneously (e.g., during migration)
- **Abstraction**: Application code doesn't depend on provider-specific APIs
