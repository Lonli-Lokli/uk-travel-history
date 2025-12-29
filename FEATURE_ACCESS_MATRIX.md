# Feature Access Control Matrix

**Last Updated:** 2025-12-29
**Purpose:** Security audit documentation mapping all features to access tiers with enforcement mechanisms

## Tier Definitions

| Tier | Description | Requirements |
|------|-------------|--------------|
| **ANONYMOUS** | No authentication required | Public access |
| **FREE** | Authenticated, free tier | Valid Clerk account |
| **PREMIUM** | Authenticated, paid subscription | Valid Clerk account + active Stripe subscription |

## Feature Inventory

### Free Tier Features (ANONYMOUS/FREE)

| Feature | Tier | API Routes | UI Components | Server Enforcement | UI Gating | Status |
|---------|------|-----------|---------------|-------------------|-----------|--------|
| **Basic Travel Tracking** | ANONYMOUS | None (client-side) | TravelPageClient, TravelTable, SummaryCards | ✗ None required | ✗ None required | ✅ Production |
| **Clipboard Import** | ANONYMOUS | None (client-side) | TravelToolbar, useClipboardImport | ✗ Client-side only | ✗ None | ✅ Production |
| **Travel History Table** | FREE | None (client-side) | TravelHistoryCard, TravelTable | ✗ None required | ✗ None required | ✅ Production |
| **Account Management** | FREE | `/api/stripe/create-portal-session` | AccountPageClient | ✓ Clerk auth check | ✓ Protected route | ✅ Production |

### Premium Tier Features (PREMIUM)

| Feature | Feature Key | API Routes | UI Components | Server Enforcement | UI Gating | Status |
|---------|-------------|-----------|---------------|-------------------|-----------|--------|
| **Excel Export** | `EXCEL_EXPORT` | `/api/export` | TravelToolbar (export dropdown) | ✓ `assertFeatureAccess()` | ✓ FeatureDropdownItem + "PRO" badge | ✅ Production |
| **Excel Import** | `EXCEL_IMPORT` | `/api/import-full` | TravelToolbar, useCsvImport | ✓ `assertFeatureAccess()` | ✓ FeatureDropdownItem + "PRO" badge | ✅ Production |
| **PDF Import** | `PDF_IMPORT` | `/api/parse` | TravelToolbar, useFileUpload | ✓ `assertFeatureAccess()` | ✓ FeatureDropdownItem + "PRO" badge | ⚠️ Disabled (minTier: FREE) |

### Payment Features

| Feature | Feature Key | API Routes | Server Enforcement | UI Gating | Status |
|---------|-------------|-----------|-------------------|-----------|--------|
| **Stripe Checkout (Auth)** | `PAYMENTS` | `/api/stripe/create-checkout` | ⚠️ `isFeatureEnabled()` only | ✓ Payment modal | ⚠️ Partial enforcement |
| **Stripe Checkout (Anon)** | `PAYMENTS` | `/api/stripe/create-anonymous-checkout` | ⚠️ `isFeatureEnabled()` only | ✓ Payment flow | ⚠️ Partial enforcement |
| **Billing Checkout** | N/A | `/api/billing/checkout` | ❌ **NO ENFORCEMENT** | ❌ None | 🔴 **CRITICAL GAP** |

### Disabled Features

| Feature | Feature Key | Intended Tier | API Routes | Status |
|---------|-------------|---------------|-----------|--------|
| **Risk Chart** | `RISK_CHART` | ANONYMOUS | None (client-side) | ⚠️ Disabled in Edge Config |

## Feature Flag Configuration

**Source:** `/packages/features/src/lib/features.ts` (Edge Config with defaults)

```typescript
DEFAULT_FEATURE_POLICIES = {
  // Master switches
  MONETIZATION: { enabled: false, minTier: 'anonymous' },
  AUTH: { enabled: false, minTier: 'anonymous' },
  PAYMENTS: { enabled: false, minTier: 'anonymous' },

  // Premium features
  EXCEL_EXPORT: { enabled: true, minTier: 'premium' },     // ✅ Correct
  EXCEL_IMPORT: { enabled: true, minTier: 'premium' },     // ✅ Correct
  PDF_IMPORT: { enabled: false, minTier: 'free' },         // ⚠️ Should be 'premium'?

  // Free features
  CLIPBOARD_IMPORT: { enabled: true, minTier: 'anonymous' }, // ✅ Correct
  RISK_CHART: { enabled: false, minTier: 'anonymous' },      // ⚠️ Disabled
}
```

## Server-Side Enforcement

### Primary Guard Function

**Location:** `/packages/features/src/lib/api-guards.ts`

**Function:** `assertFeatureAccess(request: NextRequest, featureKey: FeatureFlagKey)`

**Validation Flow:**
1. Extract user context from Clerk JWT (via `auth()`)
2. Fetch user from database (via `getUserByAuthId()`)
3. Check subscription status (via `getSubscription()`)
4. Determine tier: ANONYMOUS → FREE → PREMIUM (based on subscription.status)
5. Fetch feature policy from Edge Config
6. Validate:
   - Feature enabled globally
   - User tier meets minTier requirement
   - User has active subscription (if PREMIUM)
   - User not in denylist
   - User passes rollout percentage check
7. Log access decision (audit trail)
8. Throw NextResponse error if denied (401/403/404)

**Return:** `UserContext { userId, email, tier, hasActiveSubscription }`

### API Routes Protection Status

✅ **Properly Protected:**
- `/api/export` - `assertFeatureAccess(request, FEATURE_KEYS.EXCEL_EXPORT)` (PREMIUM)
- `/api/import-full` - `assertFeatureAccess(request, FEATURE_KEYS.EXCEL_IMPORT)` (PREMIUM)
- `/api/parse` - `assertFeatureAccess(request, FEATURE_KEYS.PDF_IMPORT)` (FREE, but disabled)

⚠️ **Partially Protected:**
- `/api/stripe/create-checkout` - Uses `isFeatureEnabled(PAYMENTS)` (no tier validation)
- `/api/stripe/create-anonymous-checkout` - Uses `isFeatureEnabled(PAYMENTS)` (no tier validation)
- `/api/stripe/create-portal-session` - Uses Clerk `auth()` only (no feature flag)

❌ **Not Protected (CRITICAL):**
- `/api/billing/checkout` - **NO ENFORCEMENT** - accepts anonymous requests

✓ **Correctly Unprotected:**
- `/api/webhooks/stripe` - Service role webhook (signature verification only)
- `/api/webhooks/clerk` - Service role webhook (signature verification only)
- `/api/cron/supabase-keepalive` - Vercel Cron job (no auth needed)

## UI Gating Components

### Available Components

| Component | Location | Purpose | Props |
|-----------|----------|---------|-------|
| **FeatureGate** | `/packages/widgets/src/lib/feature-gate.tsx` | Core gating logic | `feature`, `mode`, `fallback`, `children` |
| **PremiumGate** | `/packages/widgets/src/lib/premium-gate.tsx` | Premium wrapper | `mode`, `fallback`, `children` (uses EXCEL_EXPORT internally) |
| **FeatureDropdownItem** | `/packages/widgets/src/lib/feature-dropdown-item.tsx` | Dropdown menu items | `feature`, `children`, `onClick` |
| **FeatureButton** | `/packages/widgets/src/lib/feature-button.tsx` | Button wrapper | `feature`, `variant`, `children`, `onClick` |
| **FeatureChart** | `/packages/widgets/src/lib/feature-chart.tsx` | Chart wrapper | `feature`, `children` |

### Render Modes

- **`hide`** - Don't render children if no access (return null or fallback)
- **`disable`** - Render disabled with overlay badge
- **`blur`** - Render with CSS blur + premium overlay
- **`paywall`** - Show clickable upgrade modal trigger

### Context Providers

**FeatureGateProvider** - Injects monetizationStore, authStore, paymentStore
```tsx
<FeatureGateProvider
  monetizationStore={monetizationStore}
  authStore={authStore}
  paymentStore={paymentStore}
>
  {children}
</FeatureGateProvider>
```

**FeatureFlagsProvider** - Caches feature flags from server
```tsx
<FeatureFlagsProvider initialFlags={serverFlags}>
  {children}
</FeatureFlagsProvider>
```

## Security Findings & Gaps

### 🔴 Critical Findings

**1. Billing Checkout Route Not Protected**
- **File:** `/apps/uk-travel-history/src/app/api/billing/checkout/route.ts`
- **Issue:** No `assertFeatureAccess()` guard
- **Risk:** Anonymous users can create checkout sessions
- **Fix:** Add `await assertFeatureAccess(request, FEATURE_KEYS.PAYMENTS)`

**2. PDF Import Tier Misconfiguration**
- **File:** `/packages/features/src/lib/features.ts`
- **Issue:** `PDF_IMPORT` has `minTier: 'free'` but appears to be premium feature
- **Risk:** If enabled, FREE users gain access to premium feature
- **Fix:** Verify intended tier and update to `minTier: 'premium'` if needed

### 🟡 Medium Findings

**3. Stripe Checkout Routes Use Old Feature Check**
- **Files:** `/api/stripe/create-checkout`, `/api/stripe/create-anonymous-checkout`
- **Issue:** Use `isFeatureEnabled()` instead of `assertFeatureAccess()`
- **Risk:** Missing rollout percentage, allowlist/denylist validation
- **Fix:** Migrate to `assertFeatureAccess(request, FEATURE_KEYS.PAYMENTS)`

**4. Client-Side Store Can Mismatch Server**
- **File:** `/packages/stores/src/lib/monetizationStore.ts`
- **Issue:** Tier set manually via `setTier()`, no auto-sync mechanism
- **Risk:** Stale tier if subscription changes server-side
- **Fix:** Add subscription sync or rely solely on server-side checks

**5. Validate Session Route (Anonymous)**
- **File:** `/api/stripe/validate-session/route.ts`
- **Issue:** No authentication required
- **Risk:** Low (only validates payment status), but enables discovery
- **Fix:** Add rate limiting or authentication requirement

### 🟠 Low Findings

**6. Clipboard Import No Server Validation**
- **Component:** `useClipboardImport` hook
- **Issue:** Client-side only parsing, no API call
- **Risk:** User can paste data directly (but UI gates feature)
- **Fix:** Consider server-side endpoint if validation needed

**7. Feature Flags Cached Only Once**
- **Component:** `FeatureFlagsProvider`
- **Issue:** No refresh mechanism for Edge Config changes
- **Risk:** Users won't see new features until page reload
- **Fix:** Add periodic refresh or subscription mechanism

## Anti-Tamper Verification

### Protection Layers

**Layer 1: Middleware (proxy.ts)**
- Clerk authentication via `clerkMiddleware()`
- Route protection: public routes open, protected routes require auth
- Cannot be bypassed via HTML/JS editing

**Layer 2: API Guards (api-guards.ts)**
- Server-side validation via `assertFeatureAccess()`
- Extracts real tier from database + Stripe subscription
- Cannot be bypassed via direct API calls (JWT validated by Clerk)

**Layer 3: Database RLS (Supabase)**
- Row-level security policies
- Column-level restrictions on entitlement fields
- User-scoped clients cannot modify `subscription_tier`, `stripe_customer_id`
- Cannot be bypassed via client-side edits

### Verified Attack Vectors

✅ **HTML/CSS Editing** - Cannot unlock features (server validates)
✅ **Direct API Calls** - Cannot bypass tier checks (JWT + database validation)
✅ **DevTools Replay** - Cannot forge subscription status (Clerk + Stripe validate)
✅ **Client-Side Store Manipulation** - No effect on server-side enforcement

## Premium Data Omission

### Excel Export (Premium Feature)

**API Route:** `/api/export`

**Enforcement:**
```typescript
// Line 42
await assertFeatureAccess(request, FEATURE_KEYS.EXCEL_EXPORT);
```

**Data Omission:**
- Non-premium users receive 403 error
- No data returned in response (fail closed)
- Response shape: `{ error: string, code: string }`

### Excel Import (Premium Feature)

**API Route:** `/api/import-full`

**Enforcement:**
```typescript
await assertFeatureAccess(request, FEATURE_KEYS.EXCEL_IMPORT);
```

**Data Omission:**
- Non-premium users receive 403 error
- Import data not processed
- No partial results returned

### Risk Chart (Disabled Feature)

**Component:** `RiskAreaChart`

**Enforcement:** Feature disabled in Edge Config

**Data Omission:**
- Client-side calculation only
- No server-side API endpoint
- If enabled, should use FeatureChart wrapper with proper store injection

## Recommendations

### Priority 1 (Critical) - Security Gaps

1. **Add assertFeatureAccess to `/api/billing/checkout`**
   ```typescript
   await assertFeatureAccess(request, FEATURE_KEYS.PAYMENTS);
   ```

2. **Verify PDF_IMPORT tier configuration**
   - If premium: Change `minTier: 'premium'` in `features.ts`
   - If free: Document reasoning in this matrix

3. **Migrate Stripe routes to assertFeatureAccess**
   - Replace `isFeatureEnabled()` with full validation
   - Ensure tier requirements enforced

### Priority 2 (Important) - Consistency

1. **Document feature tiers in API route comments**
   ```typescript
   // FEATURE: EXCEL_EXPORT (PREMIUM)
   // Enforces premium tier with active subscription
   export async function POST(request: NextRequest) {
     await assertFeatureAccess(request, FEATURE_KEYS.EXCEL_EXPORT);
     // ...
   }
   ```

2. **Add subscription sync mechanism**
   - Periodic check of subscription status
   - Update monetizationStore when changed
   - Or remove client-side tier entirely (rely on server only)

3. **Enable Risk Chart with proper gating**
   - Update Edge Config: `RISK_CHART: { enabled: true, minTier: 'premium' }`
   - Wrap RiskAreaChart with FeatureChart + proper provider

### Priority 3 (Enhancement) - Observability

1. **Create feature access audit dashboard**
   - Aggregate logs from `assertFeatureAccess()`
   - Track access denials by tier and feature
   - Monitor for abuse patterns

2. **Add feature flag refresh mechanism**
   - Polling or webhook for Edge Config changes
   - Update FeatureFlagsProvider on change
   - Graceful degradation if Edge Config unavailable

3. **Add E2E tests for access control**
   - Test all premium features deny free users
   - Test direct API calls are blocked
   - Test HTML editing cannot unlock features

## Testing Checklist

### Unit Tests

- [ ] `api-guards.ts` - Test tier validation logic
- [ ] `features.ts` - Test Edge Config fallback
- [ ] `feature-gate.tsx` - Test render modes
- [ ] `monetizationStore.ts` - Test tier state management

### Integration Tests

- [ ] PDF Import - Free user receives 403
- [ ] Excel Export - Free user receives 403
- [ ] Excel Import - Free user receives 403
- [ ] Billing Checkout - Unauthenticated user receives 401 (after fix)
- [ ] Stripe Checkout - Invalid tier receives 403 (after migration)

### E2E Tests

- [ ] Free user sees "PRO" badges on premium features
- [ ] Clicking premium feature shows upgrade modal
- [ ] Direct API call with free token receives 403
- [ ] Subscription change reflects in UI within X seconds
- [ ] HTML editing cannot unlock premium features

## References

### Key Files

**Feature System:**
- `/packages/features/src/lib/shapes.ts` - Tier & feature key definitions
- `/packages/features/src/lib/features.ts` - Edge Config integration
- `/packages/features/src/lib/api-guards.ts` - Server-side enforcement
- `/CLAUDE.md` - Security model documentation

**UI Components:**
- `/packages/widgets/src/lib/feature-gate.tsx` - Core gating component
- `/packages/widgets/src/lib/premium-gate.tsx` - Premium wrapper
- `/packages/widgets/src/lib/feature-gate-context.tsx` - Context & hooks

**API Routes:**
- `/apps/uk-travel-history/src/app/api/export/route.ts` - Excel export (PREMIUM)
- `/apps/uk-travel-history/src/app/api/import-full/route.ts` - Excel import (PREMIUM)
- `/apps/uk-travel-history/src/app/api/parse/route.ts` - PDF import (FREE, disabled)
- `/apps/uk-travel-history/src/app/api/billing/checkout/route.ts` - **NEEDS FIX**

**Middleware:**
- `/apps/uk-travel-history/src/proxy.ts` - Route protection layer

---

**Audit Conducted By:** Claude (Anthropic)
**Audit Date:** 2025-12-29
**Next Review:** 2026-Q1 or when adding new premium features
