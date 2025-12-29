# @uth/features

Feature flag system with environment variables and Vercel Edge Config support.

## Purpose

Two-layer feature flag system for controlled rollout of features and monetization gates.

## Architecture

**Layer 1: Environment Variables** - Simple boolean flags
**Layer 2: Vercel Edge Config** - Dynamic flags with percentage rollouts and beta targeting

## Feature Keys

```typescript
export const FEATURE_KEYS = {
  AUTH: 'auth',
  PAYMENTS: 'payments',
  EXPORT_PREMIUM: 'export_premium',
  IMPORT_PREMIUM: 'import_premium',
} as const;
```

## Usage

### Server-Side (Next.js)

```typescript
import { isFeatureEnabled, FEATURE_KEYS } from '@uth/features';

export async function GET() {
  const authEnabled = await isFeatureEnabled(FEATURE_KEYS.AUTH);

  if (!authEnabled) {
    return Response.json({ error: 'Feature disabled' }, { status: 403 });
  }

  // Feature is enabled
}
```

### Server Components (with appFlow)

```typescript
import { appFlow, call } from '@uth/flow';
import { getAllFeatureFlags } from '@uth/features';

export default appFlow.page(async function* StatusPage() {
  const flags = yield* call(getAllFeatureFlags).orUI(<ErrorUI />);

  return <div>
    {flags.auth && <AuthSection />}
    {flags.payments && <PaymentsSection />}
  </div>;
});
```

### Client-Side (React)

```typescript
import { useFeatureFlags } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';

function MyComponent() {
  const { isFeatureEnabled } = useFeatureFlags();

  if (isFeatureEnabled(FEATURE_KEYS.EXPORT_PREMIUM)) {
    return <PremiumExportButton />;
  }

  return <FreeExportButton />;
}
```

## Environment Variables

**Simple Flags (Layer 1):**

```bash
NEXT_PUBLIC_FEATURE_AUTH=true
NEXT_PUBLIC_FEATURE_PAYMENTS=false
```

**Edge Config (Layer 2):**

```bash
EDGE_CONFIG=https://edge-config.vercel.com/...
```

## Edge Config Format

The feature policies are stored under the `feature-policies` key in Vercel Edge Config.

```json
{
  "feature-policies": {
    "auth": {
      "enabled": true,
      "minTier": "anonymous",
      "rolloutPercentage": 100
    },
    "pdf_import": {
      "enabled": true,
      "minTier": "premium",
      "rolloutPercentage": 50,
      "betaUsers": ["user_123", "user_456"],
      "allowlist": ["admin_user_id"],
      "denylist": ["blocked_user_id"]
    }
  }
}
```

### Policy Fields

- **enabled** (boolean): Global kill switch - if false, feature is disabled for everyone
- **minTier** (string): Minimum tier required - "anonymous", "free", or "premium"
- **rolloutPercentage** (number, optional): Percentage of users to enable (0-100)
- **betaUsers** (string[], optional): User IDs to bypass all restrictions
- **allowlist** (string[], optional): User IDs to bypass tier requirements
- **denylist** (string[], optional): User IDs to block regardless of tier

## API Reference

### Server-Side Access Control (IMPORTANT)

⚠️ **Security Warning**: Functions in this package check feature flags but **DO NOT** validate user tier or subscription status. For proper access control in API routes, use the guards from `@uth/features/server`:

```typescript
import { assertFeatureAccess, FEATURE_KEYS } from '@uth/features/server';

export async function POST(request: NextRequest) {
  // This validates tier, subscription, and all feature policies
  const userContext = await assertFeatureAccess(request, FEATURE_KEYS.PDF_IMPORT);

  // Safe to proceed - user has been validated
  return processPdfImport();
}
```

### `isFeatureEnabled(key, userId?): Promise<boolean>`

Check if a feature is enabled for a user.

**WARNING**: Does NOT check user tier or subscription. For access control, use `assertFeatureAccess()` from `@uth/features/server`.

### `getAllFeatureFlags(userId?): Promise<Record<FeatureFlagKey, boolean>>`

Get all feature flags as an object.

**WARNING**: Does NOT check user tier or subscription. For access control, use `assertFeatureAccess()` from `@uth/features/server`.

### `getFeaturePolicy(key): Promise<FeaturePolicy>`

Get raw feature policy configuration from Edge Config.

**WARNING**: Does NOT validate user tier or subscription. For access control, use `checkFeatureAccess()` from `@uth/features/server`.

## Rollout Strategy

1. **Development**: Enable via env vars
2. **Beta**: Enable in Edge Config with `beta_users`
3. **Gradual Rollout**: Increase `rollout_percentage` from 0 to 100
4. **Full Release**: Set `enabled: true` and `rollout_percentage: 100`

## Testing

```bash
nx test features
```

## Related

- **[`@uth/widgets`](../widgets/README.md)** - useFeatureFlags hook
- **[Vercel Edge Config](https://vercel.com/docs/storage/edge-config)** - Official docs
- **[RFC-007](https://github.com/Lonli-Lokli/uk-travel-history/issues/52)** - Feature flag spec
