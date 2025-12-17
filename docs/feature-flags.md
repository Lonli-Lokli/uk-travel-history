# Feature Flag System

## Overview

The UK Travel History app uses a two-layer feature flag system to enable controlled rollout of monetization features:

1. **Environment Variables** (Compile-time): Simple boolean flags for basic enable/disable
2. **Vercel Edge Config** (Runtime): Dynamic flags with percentage-based rollouts and beta user targeting

This approach provides the benefits of feature flags without requiring expensive third-party services.

## Quick Start

### Development Setup

1. Copy the example environment file:
```bash
cp apps/uk-travel-history/.env.local.example apps/uk-travel-history/.env.local
```

2. Enable features you want to test:
```bash
# apps/uk-travel-history/.env.local
NEXT_PUBLIC_FF_MONETIZATION=true
NEXT_PUBLIC_FF_FIREBASE_AUTH=true
NEXT_PUBLIC_FF_STRIPE_CHECKOUT=true
```

3. Restart the development server:
```bash
npm run start
```

### Production Deployment

All feature flags default to **disabled** in production for safety. To enable:

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add the flags you want to enable with value `true`
3. Redeploy the application

## Architecture

### Layer 1: Environment Variables (Basic Flags)

```typescript
// packages/ui/src/config/featureFlags.ts
export const FEATURE_FLAGS = {
  MONETIZATION_ENABLED: process.env.NEXT_PUBLIC_FF_MONETIZATION === 'true',
  // ... more flags
} as const;
```

**Usage in Components:**
```typescript
import { FEATURE_FLAGS } from '@uth/ui';

export function Header() {
  return (
    <header>
      {FEATURE_FLAGS.MONETIZATION_ENABLED && (
        <PremiumBadge />
      )}
    </header>
  );
}
```

**Pros:**
- Zero latency (compiled at build time)
- Type-safe
- No external dependencies
- Works on all platforms

**Cons:**
- Requires redeployment to change
- No gradual rollouts
- No user targeting

### Layer 2: Vercel Edge Config (Advanced Flags)

```typescript
// packages/ui/src/lib/featureFlags.ts
import { isFeatureEnabled } from '@uth/ui';

// Server-side only (async)
const isEnabled = await isFeatureEnabled('excel_export', userId);
```

**Configuration Example:**
```json
{
  "features": {
    "excel_export": {
      "enabled": true,
      "rolloutPercentage": 50,
      "betaUsers": ["user_123", "user_456"]
    }
  }
}
```

**Pros:**
- Instant updates (no redeployment)
- Gradual rollouts (10%, 50%, 100%)
- Beta user targeting
- Emergency kill switch

**Cons:**
- Async (server-side only)
- Requires Vercel Edge Config setup

## Available Feature Flags

### Master Flags

| Flag | Default | Description |
|------|---------|-------------|
| `NEXT_PUBLIC_FF_MONETIZATION` | `false` | Master switch for all monetization features |
| `NEXT_PUBLIC_FF_FIREBASE_AUTH` | `false` | Enable Firebase authentication |
| `NEXT_PUBLIC_FF_STRIPE_CHECKOUT` | `false` | Enable Stripe payment checkout |

### Premium Features

| Flag | Default | Description |
|------|---------|-------------|
| `NEXT_PUBLIC_FF_EXCEL_EXPORT_PREMIUM` | `false` | Require subscription for Excel export |
| `NEXT_PUBLIC_FF_PDF_EXPORT` | `false` | Enable PDF export feature |
| `NEXT_PUBLIC_FF_CLOUD_SYNC` | `false` | Enable cloud sync feature |

### UI Features

| Flag | Default | Description |
|------|---------|-------------|
| `NEXT_PUBLIC_FF_UPGRADE_MODAL` | `false` | Show upgrade prompts for premium features |
| `NEXT_PUBLIC_FF_PREMIUM_BADGE` | `false` | Show premium badges in UI |

## Usage Examples

### Example 1: Simple Boolean Check (Client-Side)

```typescript
import { FEATURE_FLAGS, isFeatureEnabled } from '@uth/ui';

export function ExportButton() {
  // Compile-time check
  if (!FEATURE_FLAGS.EXCEL_EXPORT_PREMIUM) {
    return <button onClick={exportFree}>Export (Free)</button>;
  }

  // Runtime check
  if (!isFeatureEnabled('MONETIZATION_ENABLED')) {
    return <button onClick={exportFree}>Export (Free)</button>;
  }

  return <button onClick={exportPremium}>Export (Premium)</button>;
}
```

### Example 2: Server-Side with User Context

```typescript
// app/api/export/route.ts
import { isFeatureEnabled as checkEdgeConfig } from '@uth/ui';
import { requireFeature } from '@/middleware/auth';

export const POST = requireFeature('excel_export')(
  async (request, auth) => {
    // Check Edge Config for gradual rollout
    const isEnabled = await checkEdgeConfig('excel_export', auth.userId);

    if (!isEnabled) {
      return NextResponse.json(
        { error: 'This feature is not available yet' },
        { status: 503 }
      );
    }

    // Proceed with export
    const workbook = generateExcel(trips);
    return new NextResponse(workbook);
  }
);
```

### Example 3: Gradual Rollout (10% → 50% → 100%)

**Step 1: Enable for 10% of users**
```json
{
  "features": {
    "excel_export": {
      "enabled": true,
      "rolloutPercentage": 10
    }
  }
}
```

**Step 2: Increase to 50% after monitoring**
```json
{
  "features": {
    "excel_export": {
      "enabled": true,
      "rolloutPercentage": 50
    }
  }
}
```

**Step 3: Full rollout**
```json
{
  "features": {
    "excel_export": {
      "enabled": true,
      "rolloutPercentage": 100
    }
  }
}
```

### Example 4: Beta User Targeting

```json
{
  "features": {
    "cloud_sync": {
      "enabled": true,
      "rolloutPercentage": 0,
      "betaUsers": [
        "firebase_uid_abc123",
        "firebase_uid_def456"
      ]
    }
  }
}
```

## Setup Vercel Edge Config

### 1. Create Edge Config

1. Go to Vercel Dashboard
2. Navigate to Storage → Edge Config
3. Click "Create Edge Config"
4. Name it (e.g., `uk-travel-history-flags`)
5. Add initial configuration:

```json
{
  "features": {
    "excel_export": {
      "enabled": false,
      "rolloutPercentage": 0
    },
    "pdf_export": {
      "enabled": false,
      "rolloutPercentage": 0
    },
    "cloud_sync": {
      "enabled": false,
      "rolloutPercentage": 0
    }
  }
}
```

### 2. Connect to Project

1. In Vercel Dashboard, go to Project → Settings → Environment Variables
2. Add `EDGE_CONFIG` variable:
   - Key: `EDGE_CONFIG`
   - Value: `https://edge-config.vercel.com/ecfg_...` (from Edge Config settings)
   - Scope: Production, Preview, Development

### 3. Verify Setup

```typescript
// Test in API route
import { isEdgeConfigAvailable } from '@uth/ui';

export async function GET() {
  const available = await isEdgeConfigAvailable();
  return NextResponse.json({ edgeConfigAvailable: available });
}
```

## Rollout Strategy

### Phase 1: Internal Testing
- Set flags to `true` in Vercel **Preview Deployments** only
- Test with real Stripe/Firebase credentials
- Verify all functionality works end-to-end

### Phase 2: Beta Users (10%)
```json
{
  "features": {
    "monetization": {
      "enabled": true,
      "rolloutPercentage": 10
    }
  }
}
```

### Phase 3: Gradual Rollout (50%)
- Monitor error rates, conversion metrics
- Increase to 50% if metrics look good

### Phase 4: Full Launch (100%)
```bash
# Vercel Environment Variables
NEXT_PUBLIC_FF_MONETIZATION=true
```

## Emergency Rollback

If a critical bug is discovered:

### Option 1: Edge Config (Instant)
1. Go to Vercel → Storage → Edge Config
2. Set `enabled: false` for the problematic feature
3. Changes take effect in ~1 second globally

### Option 2: Environment Variable (Requires Redeploy)
1. Go to Vercel → Project → Environment Variables
2. Change `NEXT_PUBLIC_FF_MONETIZATION` from `true` to `false`
3. Trigger redeployment
4. Changes take effect in ~30-60 seconds

## Best Practices

### 1. Fail Open for Availability
```typescript
try {
  const flags = await get('features');
  return flags?.excel_export?.enabled ?? true; // Default to enabled
} catch {
  return true; // Don't break app if Edge Config is down
}
```

### 2. Always Verify Server-Side
```typescript
// Client-side flag checks are for UI only
// Always enforce access control server-side
export const POST = requireFeature('excel_export')(handler);
```

### 3. Use Both Layers Together
```typescript
// Environment variable for compile-time control
if (!FEATURE_FLAGS.MONETIZATION_ENABLED) {
  return null; // Feature completely disabled
}

// Edge Config for runtime rollout
const isEnabled = await isFeatureEnabled('excel_export', userId);
if (!isEnabled) {
  return <ComingSoon />; // Not rolled out to this user yet
}
```

### 4. Document Flag Lifecycle
```typescript
export const FEATURE_FLAGS = {
  // TODO: Remove after 2025-03-01 (full rollout complete)
  EXCEL_EXPORT_PREMIUM: process.env.NEXT_PUBLIC_FF_EXCEL_EXPORT_PREMIUM === 'true',
};
```

## Monitoring

### Track Flag Usage in Analytics

```typescript
useEffect(() => {
  if (FEATURE_FLAGS.MONETIZATION_ENABLED) {
    analytics.track('feature_flag_active', {
      flag: 'monetization',
      userId: authStore.user?.uid,
    });
  }
}, []);
```

### Vercel Analytics Integration

Vercel Analytics will automatically show:
- % of page views with each flag enabled
- Conversion rates by flag state (A/B testing)
- Performance metrics by flag cohort

## Cost Analysis

| Service | Cost |
|---------|------|
| Vercel Environment Variables | **Free** (unlimited) |
| Vercel Edge Config | **Free** (512KB storage, unlimited reads) |
| LaunchDarkly (alternative) | $100+/month |

**Total: $0/month**

## Troubleshooting

### Flag not taking effect

1. **Environment variables**: Redeploy after changing
2. **Edge Config**: Wait ~5 seconds for cache to clear
3. **Client-side**: Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)

### Edge Config not working

```bash
# Check if EDGE_CONFIG is set
echo $EDGE_CONFIG

# Test connection
curl -H "Authorization: Bearer $EDGE_CONFIG_TOKEN" \
  https://edge-config.vercel.com/ecfg_.../item/features
```

### Type errors

Make sure to import from the package:
```typescript
import { FEATURE_FLAGS, isFeatureEnabled } from '@uth/ui';
```

## API Reference

### `FEATURE_FLAGS`
Compile-time feature flags object.

### `isFeatureEnabled(flag: FeatureFlagKey): boolean`
Check if a compile-time flag is enabled.

### `isMonetizationActive(): boolean`
Convenience helper for checking monetization flag.

### `getEnabledFlags(): FeatureFlagKey[]`
Get array of all enabled compile-time flags.

### `isFeatureEnabled(featureId: string, userId?: string): Promise<boolean>`
Check Edge Config for runtime feature flags with rollout logic.

### `isEnabledForUser(featureId: string, userId: string, percentage: number): Promise<boolean>`
Check if feature is enabled for a percentage of users.

### `getAllFeatureFlags(): Promise<EdgeConfigFlags | null>`
Get all Edge Config feature flags.

## Related Documentation

- [RFC-007: Feature Flag System](https://github.com/Lonli-Lokli/uk-travel-history/issues/52)
- [Vercel Edge Config Docs](https://vercel.com/docs/storage/edge-config)
- [Next.js Environment Variables](https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables)
