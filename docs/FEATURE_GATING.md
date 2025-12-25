# Tiered UI Gating Standard

## Overview

This document describes the approved pattern for implementing tiered feature access in the UK Travel History Parser application. All future tiered features **MUST** follow this pattern to ensure security, correct per-user rendering, and cache safety.

## Architecture Principles

### 1. Defense in Depth

**UI gating is UX only** - it improves user experience but provides **no security**.

All security enforcement happens server-side:
- ✅ API routes validate authentication + subscription
- ✅ Premium features require server-side `requirePaidFeature()` check
- ✅ Fail-closed: defaults to blocking if config unavailable

Client-side UI gates:
- ❌ Can be bypassed (inspect element, API calls, etc.)
- ✅ Good for UX (show upgrade prompts, disable buttons)
- ✅ Prevent accidental clicks on unavailable features

### 2. Server-First Rendering

All feature gating decisions are made **server-side** and passed to the client:

```typescript
// ❌ WRONG: Client-only gating
'use client';
export function MyComponent() {
  const hasAccess = useMonetizationStore().hasFeatureAccess('premium_feature');
  // This can be bypassed!
}

// ✅ CORRECT: Server component passes flags to client
// Server Component (app/page.tsx)
import { getAllFeatureFlags } from '@uth/features';

export default async function Page() {
  const flags = await getAllFeatureFlags(userId);
  return <ClientComponent flags={flags} />;
}
```

### 3. Cache Safety

**CRITICAL**: User-specific content must NEVER be cached publicly.

Next.js App Router best practices:
- Server Components that access user data are automatically dynamic
- API routes with authentication checks are not cached
- Use `unstable_noStore()` or `no-store` cache directive when needed

## Implementation Checklist

When implementing a new tiered feature, follow these steps:

### Step 1: Define Feature in Constants

Add to `packages/features/src/lib/features.ts`:

```typescript
export const FEATURES = {
  // ... existing features
  MY_NEW_FEATURE: 'my_new_feature',
} as const;

export const TIER_CONFIG: Record<TierId, FeatureId[]> = {
  [TIERS.FREE]: [
    // Free tier features
  ],
  [TIERS.PREMIUM]: [
    FEATURES.MY_NEW_FEATURE, // Add here if premium
    // ... other premium features
  ],
};
```

### Step 2: Add to Edge Config

Update Vercel Edge Config (server-side only):

```json
{
  "features": {
    "my_new_feature": {
      "enabled": true,
      "rolloutPercentage": 100
    }
  },
  "premium_features": [
    "excel_export",
    "pdf_import",
    "my_new_feature"  // Add here if premium
  ]
}
```

### Step 3: Server-Side API Authorization

Protect API routes with `requirePaidFeature()`:

```typescript
// app/api/my-feature/route.ts
import { requirePaidFeature } from '@/middleware/serverAuth';
import { FEATURES } from '@uth/features';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: This check runs server-side and CANNOT be bypassed
    await requirePaidFeature(request, FEATURES.MY_NEW_FEATURE);

    // Feature logic here...
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return createAuthErrorResponse(error);
    }
    // Handle other errors...
  }
}
```

**What `requirePaidFeature()` does:**
1. Checks if feature is enabled via Edge Config
2. Verifies Firebase auth token
3. Checks Stripe subscription status
4. Verifies feature is in premium list OR user has active subscription
5. Throws `AuthError` if any check fails

### Step 4: Client-Side UI Gating

Use one of the provided components:

#### Option A: FeatureDropdownItem (for dropdown menus)

```typescript
import { FeatureDropdownItem } from '@uth/widgets';
import { FEATURES } from '@uth/features';

<DropdownMenu>
  <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
  <DropdownMenuContent>
    <FeatureDropdownItem
      feature={FEATURES.MY_NEW_FEATURE}
      onClick={handleFeatureClick}
    >
      <Icon name="star" />
      My Premium Feature
    </FeatureDropdownItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Behavior:**
- ✅ Has access: Shows normal menu item, calls `onClick`
- ❌ No access: Shows "Premium" badge, opens upgrade modal

#### Option B: FeatureGate (for arbitrary content)

```typescript
import { FeatureGate } from '@uth/widgets';
import { FEATURES } from '@uth/features';
import { monetizationStore, authStore, paymentStore } from '@uth/stores';

<FeatureGate
  feature={FEATURES.MY_NEW_FEATURE}
  mode="blur" // or "hide", "disable", "paywall"
  monetizationStore={monetizationStore}
  authStore={authStore}
  paymentStore={paymentStore}
>
  <PremiumComponent />
</FeatureGate>
```

**Render Modes:**
- `hide`: Don't render at all (use `fallback` prop for replacement)
- `disable`: Show blurred with "Premium" badge overlay
- `blur`: Show heavily blurred with upgrade prompt
- `paywall`: Render normally but open upgrade modal on click

### Step 5: Add to Feature Metadata

Update `FEATURE_METADATA` in `packages/features/src/lib/features.ts`:

```typescript
export const FEATURE_METADATA: Record<FeatureId, FeatureMetadata> = {
  // ... existing features
  [FEATURES.MY_NEW_FEATURE]: {
    id: FEATURES.MY_NEW_FEATURE,
    name: 'My Premium Feature',
    description: 'Short description for pricing page',
    comingSoon: false, // Set true if not yet implemented
  },
};
```

## Server-Side Authorization Flow

```
┌─────────────────┐
│  Client Request │
│ (with JWT)      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ requirePaidFeature()        │
│ (serverAuth.ts)             │
├─────────────────────────────┤
│ 1. Check feature enabled    │◄── Vercel Edge Config
│    (Edge Config flags)      │    (remote, no redeploy)
│                             │
│ 2. Verify JWT               │◄── Firebase Admin SDK
│    (Firebase Auth)          │    (server-side only)
│                             │
│ 3. Get subscription         │◄── Stripe API
│    (Stripe)                 │    (server-side only)
│                             │
│ 4. Check premium list       │◄── Vercel Edge Config
│    (Edge Config)            │    ("premium_features")
│                             │
│ 5. Authorize:               │
│    - Free feature → Allow   │
│    - Premium + Active → Allow
│    - Premium + No Sub → 403 │
│    - Disabled feature → 403 │
└─────────┬───────────────────┘
          │
          ▼
    ┌─────────┐
    │ Allowed │
    └─────────┘
```

## Caching Strategy

### Server Components (Pages)

Next.js App Router automatically makes pages **dynamic** when they:
- Access cookies (e.g., auth tokens)
- Access headers
- Use `searchParams`
- Call server-side functions that opt out of caching

Our pages are **automatically dynamic** because `TravelPageClient` uses MobX stores that access `localStorage` (client-side).

**Verification:**
```bash
# After build, check .next/server/app
# Dynamic pages show: ƒ (Dynamic)
# Static pages show:  ○ (Static)
```

### API Routes

All protected API routes:
- ✅ Do NOT use `unstable_cache` for user-specific results
- ✅ Access `request` object (makes them dynamic)
- ✅ Return responses without `public` cache directives

**Example cache headers for API routes:**
```typescript
// ✅ CORRECT: No caching
return NextResponse.json({ data }, {
  headers: {
    'Cache-Control': 'private, no-store, max-age=0',
  },
});

// ❌ WRONG: Public caching
return NextResponse.json({ data }, {
  headers: {
    'Cache-Control': 'public, max-age=3600',
  },
});
```

### Edge Config Caching

Edge Config responses are cached by Vercel:
- Updates propagate globally within ~1 second
- No code redeployment required
- Safe for feature flags (not user-specific)

## Testing Strategy

### 1. Unit Tests

Test server-side authorization logic:

```typescript
// serverAuth.test.ts
describe('requirePaidFeature', () => {
  it('should allow access to free features without subscription', async () => {
    // Mock Edge Config to return feature as free
    // Verify no error thrown
  });

  it('should block premium features without active subscription', async () => {
    // Mock Edge Config to return feature as premium
    // Mock subscription as inactive
    // Verify AuthError thrown with 403 status
  });

  it('should allow premium features with active subscription', async () => {
    // Mock Edge Config to return feature as premium
    // Mock subscription as active
    // Verify no error thrown
  });
});
```

### 2. E2E Tests (Playwright)

Test complete user flows:

```typescript
// e2e/feature-gating.spec.ts
test('free user cannot access premium features', async ({ page }) => {
  // Visit page without auth
  await page.goto('/travel');

  // Attempt to use premium feature
  await page.click('[data-feature="excel_export"]');

  // Verify upgrade modal shown
  await expect(page.getByText('Upgrade to Premium')).toBeVisible();
});

test('premium user can access premium features', async ({ page }) => {
  // Login with premium account
  await loginAsPremiumUser(page);

  // Visit page
  await page.goto('/travel');

  // Use premium feature
  await page.click('[data-feature="excel_export"]');

  // Verify feature works
  await expect(page.getByText('Export successful')).toBeVisible();
});
```

### 3. Cache Leak Tests

Verify no cross-user contamination:

```typescript
test('should not leak UI state between sessions', async ({ page, context }) => {
  // Session 1: Free user
  await page.goto('/travel');
  const hasPremiumUI1 = await page.locator('[data-premium]').count();

  // Clear session
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());

  // Session 2: Premium user
  await loginAsPremiumUser(page);
  await page.reload();
  const hasPremiumUI2 = await page.locator('[data-premium]').count();

  // Verify different UI states
  expect(hasPremiumUI1).not.toBe(hasPremiumUI2);
});
```

## Edge Config Management

### Configuration Keys

**Required Edge Config keys:**

```json
{
  "features": {
    "auth": { "enabled": false },
    "monetization": { "enabled": false },
    "excel_export": { "enabled": true },
    "pdf_import": { "enabled": true }
  },
  "premium_features": [
    "excel_export",
    "pdf_import"
  ]
}
```

**Feature flag structure:**
```typescript
{
  "enabled": boolean,           // Is feature available?
  "rolloutPercentage"?: number, // 0-100, gradual rollout
  "betaUsers"?: string[]        // User IDs for early access
}
```

### Safe Defaults

When Edge Config is unavailable, the app uses `DEFAULT_FEATURE_STATES`:

```typescript
export const DEFAULT_FEATURE_STATES: Record<FeatureFlagKey, boolean> = {
  MONETIZATION: false,  // Disable monetization by default
  AUTH: false,          // Disable auth by default
  EXCEL_EXPORT: true,   // Allow export by default
  PDF_IMPORT: false,    // Block PDF import by default (conservative)
};
```

**Fail-closed vs Fail-open:**
- Monetization/Auth flags: Fail-open (disabled = no enforcement)
- Feature availability: Fail-open (enabled = allow usage)
- Premium feature list: Fail-closed (unavailable = assume all premium)

## Monitoring & Observability

### Logging

All feature gating decisions are logged:

```typescript
// In requirePaidFeature()
logger.info('[Paid Feature] Premium feature accessed', {
  extra: {
    userId: authContext?.userId,
    featureId,
  },
});
```

**What to monitor:**
- Feature access denials (401/403 errors)
- Edge Config fetch failures
- Subscription verification failures
- Feature flag evaluation errors

### Metrics to Track

1. **Feature Usage:**
   - Count of premium feature attempts
   - Count of successful premium accesses
   - Count of upgrade modal impressions

2. **Authorization Failures:**
   - 401 Unauthorized (missing/invalid token)
   - 403 Forbidden (no subscription)
   - 403 Feature Disabled (Edge Config)

3. **Edge Config Health:**
   - Edge Config fetch latency
   - Edge Config availability percentage
   - Fallback to defaults count

## Security Considerations

### Common Vulnerabilities

❌ **Client-only gating:**
```typescript
// INSECURE: Can be bypassed
if (userStore.isPremium) {
  await fetch('/api/premium-feature');
}
```

✅ **Server-side validation:**
```typescript
// SECURE: Server always checks
export async function POST(req) {
  await requirePaidFeature(req, 'premium-feature');
  // Process request...
}
```

❌ **Trusting client-sent subscription status:**
```typescript
// INSECURE: Client can lie
const { isPremium } = await req.json();
if (isPremium) {
  // Grant access - BAD!
}
```

✅ **Verifying subscription server-side:**
```typescript
// SECURE: Always verify with Stripe
const subscription = await getSubscription(userId);
if (subscription.status === 'active') {
  // Grant access - GOOD!
}
```

### Rate Limiting

Premium API routes should implement rate limiting:

```typescript
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});

export async function POST(req: NextRequest) {
  const { userId } = await requirePaidFeature(req, 'feature');

  // Rate limit per user
  const { success } = await ratelimit.limit(userId);
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Process request...
}
```

## Troubleshooting

### Issue: Feature shows as premium when it should be free

**Cause:** Edge Config `premium_features` list includes the feature.

**Solution:**
1. Check Vercel Edge Config dashboard
2. Remove feature from `premium_features` array
3. Changes propagate in ~1 second

### Issue: Feature disabled even with active subscription

**Cause:** Edge Config feature flag is `enabled: false`.

**Solution:**
1. Check Vercel Edge Config dashboard
2. Set `features.my_feature.enabled = true`
3. No redeploy needed

### Issue: API returns 403 but UI shows access

**Cause:** Client-side feature check differs from server-side.

**Solution:**
1. Verify `monetizationStore` is synced with server flags
2. Check `getAllFeatureFlags()` is called server-side
3. Ensure client receives flags via props

### Issue: Premium UI leaked between users

**Cause:** Page is being statically cached.

**Solution:**
1. Verify page accesses dynamic data (cookies, headers)
2. Add `export const dynamic = 'force-dynamic'` to page
3. Check build output for `ƒ` (dynamic) vs `○` (static)

## References

- [Next.js Caching Guide](https://nextjs.org/docs/app/building-your-application/caching)
- [Vercel Edge Config Docs](https://vercel.com/docs/edge-config)
- [Firebase Auth Server SDK](https://firebase.google.com/docs/auth/admin)
- [Stripe Subscription API](https://stripe.com/docs/api/subscriptions)

## Changelog

- **2025-12-25**: Initial documentation created during Issue #93 audit
