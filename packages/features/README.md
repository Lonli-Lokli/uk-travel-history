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

```json
{
  "feature_flags": {
    "auth": {
      "enabled": true,
      "rollout_percentage": 100
    },
    "export_premium": {
      "enabled": true,
      "rollout_percentage": 50,
      "beta_users": ["user_123", "user_456"]
    }
  }
}
```

## API Reference

### `isFeatureEnabled(key, userId?): Promise<boolean>`

Check if a feature is enabled for a user.

### `getAllFeatureFlags(userId?): Promise<Record<FeatureFlagKey, boolean>>`

Get all feature flags as an object.

### `getFeatureFlagValue(key): Promise<FeatureFlagConfig | null>`

Get raw feature flag configuration.

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
