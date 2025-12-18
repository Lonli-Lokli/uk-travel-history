# Feature Flag System

## Overview

The UK Travel History app uses **Vercel Edge Config** for runtime feature flags with instant kill-switch capability. This provides controlled rollout of monetization features **without requiring redeployment**.

### Key Benefits

- ✅ **Instant Updates**: Change flags in ~1 second globally (no redeploy)
- ✅ **Kill Switch**: Disable problematic features instantly in production
- ✅ **Gradual Rollout**: Enable features for 10%, 50%, then 100% of users
- ✅ **Beta Testing**: Target specific user IDs for early access
- ✅ **Type Safe**: Full TypeScript support with typed flag keys
- ✅ **Free**: Uses Vercel Edge Config (512KB storage, unlimited reads)

## Quick Start

### 1. Setup Vercel Edge Config

See [Vercel Edge Config Setup Guide](./vercel-edge-config-setup.md) for detailed instructions.

**TL;DR:**

1. Create Edge Config in Vercel Dashboard
2. Add initial configuration:

```json
{
  "features": {
    "firebase_auth_enabled": { "enabled": false },
    "monetization_enabled": { "enabled": false },
    "stripe_checkout_enabled": { "enabled": false },
    "excel_export_premium": { "enabled": false },
    "pdf_export_enabled": { "enabled": false },
    "cloud_sync_enabled": { "enabled": false },
    "upgrade_modal_enabled": { "enabled": false },
    "premium_badge_enabled": { "enabled": false }
  }
}
```

3. Connect to your project (set `EDGE_CONFIG` environment variable)

### 2. Add FeatureFlagsProvider to Your App

In your root layout (server component):

```typescript
// app/layout.tsx
import { getAllFeatureFlags, FeatureFlagsProvider } from '@uth/features';

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  // Fetch flags from Edge Config on the server
  const flags = await getAllFeatureFlags();

  return (
    <html>
      <body>
        <FeatureFlagsProvider flags={flags}>
          {children}
        </FeatureFlagsProvider>
      </body>
    </html>
  );
}
```

### 3. Use Feature Flags in Components

**Client Components:**

```typescript
'use client';
import { useFeatureFlags, FEATURE_KEYS } from '@uth/features';

export function LoginButton() {
  const { isFeatureEnabled } = useFeatureFlags();

  if (!isFeatureEnabled(FEATURE_KEYS.FIREBASE_AUTH_ENABLED)) {
    return null;
  }

  return <button>Sign In with Passkey</button>;
}
```

**Server Components:**

```typescript
import { isFeatureEnabled, FEATURE_KEYS } from '@uth/features';

export default async function DashboardPage() {
  const hasPremium = await isFeatureEnabled(
    FEATURE_KEYS.EXCEL_EXPORT_PREMIUM,
    userId
  );

  return (
    <div>
      {hasPremium && <PremiumFeatures />}
    </div>
  );
}
```

**API Routes:**

```typescript
// app/api/export/route.ts
import { isFeatureEnabled, FEATURE_KEYS } from '@uth/features';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { userId } = await auth(request);

  // Check if feature is enabled for this user
  const isEnabled = await isFeatureEnabled(FEATURE_KEYS.EXCEL_EXPORT_PREMIUM, userId);

  if (!isEnabled) {
    return NextResponse.json({ error: 'Feature not available' }, { status: 403 });
  }

  // Proceed with export
  return generateExcel();
}
```

## Available Feature Flags

| Flag Key                               | Default | Description                                  |
| -------------------------------------- | ------- | -------------------------------------------- |
| `FEATURE_KEYS.MONETIZATION_ENABLED`    | `false` | Master switch for all monetization features  |
| `FEATURE_KEYS.FIREBASE_AUTH_ENABLED`   | `false` | Enable Firebase authentication with passkeys |
| `FEATURE_KEYS.STRIPE_CHECKOUT_ENABLED` | `false` | Enable Stripe payment checkout               |
| `FEATURE_KEYS.EXCEL_EXPORT_PREMIUM`    | `false` | Require subscription for Excel export        |
| `FEATURE_KEYS.PDF_EXPORT_ENABLED`      | `false` | Enable PDF export feature                    |
| `FEATURE_KEYS.CLOUD_SYNC_ENABLED`      | `false` | Enable cloud sync feature                    |
| `FEATURE_KEYS.UPGRADE_MODAL_ENABLED`   | `false` | Show upgrade prompts for premium features    |
| `FEATURE_KEYS.PREMIUM_BADGE_ENABLED`   | `false` | Show premium badges in UI                    |

## Advanced Usage

### Gradual Rollout (Percentage-Based)

Enable a feature for a percentage of users:

```json
{
  "features": {
    "excel_export_premium": {
      "enabled": true,
      "rolloutPercentage": 10
    }
  }
}
```

**Rollout Strategy:**

1. Start with 10% → Monitor metrics
2. Increase to 50% → Monitor for issues
3. Roll out to 100% → Full launch

### Beta User Targeting

Enable for specific users only:

```json
{
  "features": {
    "cloud_sync_enabled": {
      "enabled": true,
      "rolloutPercentage": 0,
      "betaUsers": ["firebase_uid_abc123", "firebase_uid_def456"]
    }
  }
}
```

### Combined: Beta Users + Gradual Rollout

```json
{
  "features": {
    "pdf_export_enabled": {
      "enabled": true,
      "rolloutPercentage": 25,
      "betaUsers": ["early_adopter_1", "early_adopter_2"]
    }
  }
}
```

- Beta users always get access (regardless of percentage)
- Other users have 25% chance based on consistent hashing

## API Reference

### Server-Side API

#### `isFeatureEnabled(featureKey, userId?)`

Check if a feature is enabled for a specific user.

```typescript
const isEnabled = await isFeatureEnabled(FEATURE_KEYS.FIREBASE_AUTH_ENABLED, userId);
```

**Parameters:**

- `featureKey: FeatureFlagKey` - The feature to check
- `userId?: string` - Optional user ID for rollout/beta logic

**Returns:** `Promise<boolean>`

#### `getAllFeatureFlags(userId?)`

Fetch all feature flags evaluated for a user.

```typescript
const flags = await getAllFeatureFlags(userId);
// Returns: Record<FeatureFlagKey, boolean>
```

Useful for passing to `FeatureFlagsProvider`:

```typescript
const flags = await getAllFeatureFlags();
return <FeatureFlagsProvider flags={flags}>{children}</FeatureFlagsProvider>;
```

### Client-Side API

#### `useFeatureFlags()`

React hook to access feature flags in client components.

```typescript
const { isFeatureEnabled, flags } = useFeatureFlags();

if (isFeatureEnabled(FEATURE_KEYS.MONETIZATION_ENABLED)) {
  // Show premium UI
}
```

**Returns:**

```typescript
{
  isFeatureEnabled: (key: FeatureFlagKey) => boolean;
  flags: Record<FeatureFlagKey, boolean>;
}
```

#### `withFeatureFlag(featureKey, Component, Fallback?)`

Higher-order component to conditionally render based on feature flag.

```typescript
const PremiumExportButton = withFeatureFlag(
  FEATURE_KEYS.EXCEL_EXPORT_PREMIUM,
  ExcelExportButton,
  () => <div>Coming soon!</div>
);
```

### Constants

#### `FEATURE_KEYS`

Typed constants for all feature flags (prevents typos).

```typescript
import { FEATURE_KEYS } from '@uth/features';

FEATURE_KEYS.MONETIZATION_ENABLED; // 'monetization_enabled'
FEATURE_KEYS.FIREBASE_AUTH_ENABLED; // 'firebase_auth_enabled'
// etc.
```

## Kill Switch Usage

### Emergency Disable (Production)

If a critical bug is discovered:

1. Go to Vercel Dashboard → Storage → Edge Config
2. Find the problematic feature
3. Set `enabled: false`
4. **Changes take effect in ~1 second globally**

Example:

```json
{
  "features": {
    "excel_export_premium": {
      "enabled": false // ← Changed from true
    }
  }
}
```

No redeployment needed! All servers pick up the change instantly.

### Canary Rollback

If you're doing a gradual rollout and see issues:

```json
{
  "features": {
    "new_feature": {
      "enabled": true,
      "rolloutPercentage": 10 // ← Reduce from 50 to 10
    }
  }
}
```

Users who already had access keep it (consistent hashing), but fewer new users get it.

## Migration from Old System

### Backward Compatibility

The old `FEATURE_FLAGS` object still works but is **deprecated**:

```typescript
// OLD (still works, but deprecated)
import { FEATURE_FLAGS } from '@uth/features';
if (FEATURE_FLAGS.FIREBASE_AUTH_ENABLED) { ... }

// NEW (recommended)
import { useFeatureFlags, FEATURE_KEYS } from '@uth/features';
const { isFeatureEnabled } = useFeatureFlags();
if (isFeatureEnabled(FEATURE_KEYS.FIREBASE_AUTH_ENABLED)) { ... }
```

### Migration Steps

1. **Add FeatureFlagsProvider** to your root layout (see Quick Start)
2. **Update components** to use `useFeatureFlags()` hook
3. **Update server code** to use `isFeatureEnabled(key, userId)`
4. **Remove environment variables** (no longer needed)
5. **Test** with Edge Config flags

### What's Different

| Old System (Env Vars)                     | New System (Edge Config)            |
| ----------------------------------------- | ----------------------------------- |
| `process.env.NEXT_PUBLIC_FF_MONETIZATION` | `FEATURE_KEYS.MONETIZATION_ENABLED` |
| Requires redeploy                         | Instant updates                     |
| Boolean only                              | Percentage rollouts + beta users    |
| Client-side only                          | Server + client                     |
| Type-unsafe strings                       | Type-safe constants                 |

## Best Practices

### 1. Always Validate Server-Side

Client-side checks are for UX only. **Always enforce access control server-side**:

```typescript
// ❌ Bad: Only checking client-side
if (FEATURE_FLAGS.EXCEL_EXPORT_PREMIUM) {
  await exportToExcel(); // Can be bypassed!
}

// ✅ Good: Server-side validation
export async function POST(request: Request) {
  const isEnabled = await isFeatureEnabled(FEATURE_KEYS.EXCEL_EXPORT_PREMIUM, userId);
  if (!isEnabled) {
    return new Response('Unauthorized', { status: 403 });
  }
  // Secure
}
```

### 2. Use Fail-Closed Strategy

If Edge Config is unavailable, features should default to **disabled**:

```typescript
// This is built-in - if Edge Config fails, features default to false
const isEnabled = await isFeatureEnabled(FEATURE_KEYS.NEW_FEATURE);
// Returns false on error
```

### 3. Monitor Flag Usage

Track when features are accessed for analytics:

```typescript
const { isFeatureEnabled } = useFeatureFlags();

useEffect(() => {
  if (isFeatureEnabled(FEATURE_KEYS.MONETIZATION_ENABLED)) {
    analytics.track('feature_flag_active', {
      flag: 'monetization_enabled',
    });
  }
}, []);
```

### 4. Document Flag Lifecycle

When adding new flags, document when they should be removed:

```typescript
// TODO: Remove after 2025-03-01 (full rollout complete)
EXCEL_EXPORT_PREMIUM: 'excel_export_premium',
```

### 5. Test Both States

Always test your app with flags both enabled and disabled:

```typescript
// In tests, mock the flags
setCachedFlags({
  [FEATURE_KEYS.MONETIZATION_ENABLED]: true, // Test enabled state
});

// Then test disabled state
setCachedFlags({
  [FEATURE_KEYS.MONETIZATION_ENABLED]: false,
});
```

## Troubleshooting

### Flag changes not taking effect

**Edge Config updates:**

- Wait ~5 seconds for cache to clear globally
- Check Vercel Edge Config dashboard for syntax errors

**Client-side:**

- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- Clear browser cache

### Edge Config not working

```bash
# Check if EDGE_CONFIG env var is set
echo $EDGE_CONFIG

# Verify in code
const available = await isEdgeConfigAvailable();
console.log('Edge Config available:', available);
```

### TypeScript errors

Make sure to import from the package:

```typescript
import { FEATURE_KEYS, useFeatureFlags } from '@uth/features';
```

Not from internal paths:

```typescript
// ❌ Don't do this
import { FEATURE_KEYS } from '@uth/features/src/lib/edgeConfigFlags';
```

## Cost Analysis

| Service                    | Cost        | Limits                         |
| -------------------------- | ----------- | ------------------------------ |
| Vercel Edge Config         | **Free**    | 512KB storage, unlimited reads |
| Alternative (LaunchDarkly) | $100+/month | Similar features               |

**Total: $0/month**

## Related Documentation

- [Vercel Edge Config Setup Guide](./vercel-edge-config-setup.md)
- [Vercel Edge Config Docs](https://vercel.com/docs/storage/edge-config)
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [RFC-007: Feature Flag System](https://github.com/Lonli-Lokli/uk-travel-history/issues/52)
