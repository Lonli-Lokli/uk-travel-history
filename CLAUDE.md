# Claude Project Context - UK Travel History Parser

## Project Overview

This is a Next.js application designed to help users track their UK travel history, vignette entry dates, and visa start dates. The primary use case is for individuals who need to calculate their time spent outside the UK for immigration/residency purposes.

## Key Requirements

### Core Functionality

1. **Travel History Tracking**: Parse and manage trips in/out of the UK
2. **Vignette Entry Dates**: Track when vignette entries occurred
3. **Visa Start Dates**: Track visa commencement dates
4. **Days Calculation**: Calculate full days outside UK (excluding departure and return days)

### Data Sources

- PDF uploads from UK Home Office SAR (Subject Access Request) documents
- Manual entry for all data types

## Tech Stack & Architecture

### Framework & Libraries

- **Next.js 16** (App Router with `proxy.ts` middleware)
- **MobX** for state management (observer pattern)
- **TanStack React Table v8** for table functionality
- **shadcn/ui + Radix UI** for components
- **Tailwind CSS** for styling
- **pdf-parse** for PDF parsing
- **ExcelJS** for Excel export

### Authentication & Payments (Issue #100)

- **Clerk** for authentication (public sign-up model)
  - Modal-based sign-in/sign-up via `<SignInButton>` and `<SignUpButton>`
  - JWT tokens used for Supabase RLS authentication
  - Webhook handler at `/api/webhooks/clerk` for user provisioning
- **Supabase** for database with Row Level Security (RLS)
  - User-scoped clients use anon key + Clerk JWT (RLS enforced)
  - Admin clients use service_role key (webhooks only, bypasses RLS)
  - Factory functions: `createUserScopedClient()`, `createAdminClient()`
  - **Migrations**: GitHub is source of truth (see Database Migrations section below)
- **Stripe** for payments
  - Subscription tiers: free, monthly, yearly, lifetime
  - Webhook handler at `/api/webhooks/stripe` for subscription lifecycle
  - Customer Portal integration for subscription management

### Project Structure

```
apps/uk-travel-history/
├── src/app/
│   ├── api/
│   │   ├── parse/route.ts      # PDF parsing endpoint
│   │   └── export/route.ts     # Excel export endpoint
│   ├── page.tsx                # Home/landing page
│   ├── travel/
│   │   └── page.tsx            # Travel tracker page
│   └── layout.tsx
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── LandingPage.tsx         # Home page with instructions
│   ├── TravelPageClient.tsx    # Main travel tracker
│   ├── Header.tsx              # Navigation header
│   ├── SummaryCards.tsx        # Stats cards
│   ├── VisaDetailsCard.tsx     # Visa/vignette inputs
│   ├── TravelHistoryCard.tsx   # Table wrapper
│   └── TravelTable.tsx         # Editable table
├── stores/
│   └── travelStore.ts          # MobX state
└── lib/
    ├── parser.ts
    └── utils.ts
```

### Routing Structure

**Active Routes**:

- **`/`** (Home): Landing page with instructions and CTAs
- **`/travel`** (Travel Tracker): Main application (free tier access)
- **`/account`** (Account & Billing): Subscription management
- **`/sign-in`** and **`/sign-up`**: Clerk authentication pages
- **`/about`**: About page
- **`/terms`**: Terms and conditions
- **`/status`**: Feature flags dashboard

**Removed Routes** (as of Issue #100):

- ~~`/claim`~~ - Replaced by public sign-in/sign-up
- ~~`/registration`~~ - Replaced by Clerk webhook auto-provisioning
- ~~`/onboarding/passkey`~~ - Passkeys now optional

**Design Philosophy**: Clean navigation with public sign-up model. Users sign in/up via Clerk modals, then access free features immediately. Premium features require subscription upgrade via `/account` page.

## Development Guidelines

### When Working on This Project

1. **State Management**: All state changes must go through MobX store actions
2. **Table Edits**: Use TanStack Table's built-in editing capabilities
3. **Calculations**: The formula for full days is: `(Return Date - Departure Date) - 1`
4. **UI/UX**: Maintain mobile-first, responsive design (cards on mobile, table on desktop)
5. **Data Validation**: Ensure dates are valid and in correct format
6. **Security**: Follow the three-layer defense model (see Security Model section below)

### Security Model

The application uses a **three-layer defense** strategy for access control:

**Layer 1: Route Protection** (`proxy.ts`)

- Next.js 16 middleware authenticates requests via `clerkMiddleware()`
- Public routes: `/`, `/travel`, `/about`, `/terms`, `/status`
- Protected routes: `/account`, `/api/billing/*`, `/api/user/*`
- Webhook routes: `/api/webhooks/*`, `/api/webhooks/stripe`

**Layer 2: API Route Authorization**

- Feature-based authorization via `@uth/features` package
- Server-side validation of subscription tiers
- Use `getCurrentUser()` from `@uth/auth-server` for type-safe user access

**Layer 3: Database RLS Policies** (defined in `supabase/migrations/`)

- **Users table**: Can only read/update own profile
  - CRITICAL: Column-level restrictions prevent users from modifying entitlement fields
  - `subscription_tier`, `stripe_customer_id`, `role`, etc. can only be modified by service_role
- **Purchase intents**: Can only view own purchase history
- **Webhook events**: Service_role only (contains sensitive payment data)
- **Feature policies**: Public read access (for feature flag checks)

**Important Rules**:

- NEVER use `as any` type assertions with Supabase client (types are already defined)
- ALWAYS use `createUserScopedClient()` for user-facing operations (RLS enforced)
- ONLY use `createAdminClient()` in webhook handlers (bypasses RLS)
- Webhook handlers MUST verify signatures before processing

### Session-Based Storage for Anonymous/Free Users

**Overview**: The application uses HttpOnly session cookies to provide ephemeral storage for anonymous and free-tier users via the `@uth/trip-store` package.

**Storage Routing**:
- **Paid users** (monthly/yearly/lifetime): Data stored in Supabase with RLS
- **Free/anonymous users**: Data stored in Redis cache with session-based access
- **Automatic migration**: When users upgrade to paid, cached data is migrated to Supabase

**Session Security Model**:

1. **Cookie Configuration**:
   - Cookie name: `uth_session_id`
   - HttpOnly: `true` (prevents JavaScript access)
   - Secure: `true` in production (HTTPS only)
   - SameSite: `lax` (CSRF protection)
   - No expiry (session cookie - expires on browser close)

2. **Session ID Format**:
   - UUID v4 (cryptographically random)
   - Validated on every request via `validateSessionId()`
   - Example: `550e8400-e29b-41d4-a716-446655440000`

3. **Cache TTL**:
   - All cached data expires at midnight UTC (end of day)
   - Prevents indefinite data accumulation
   - Users see "ephemeral data expired" message if they return after midnight

4. **Known Security Limitations**:
   ⚠️ **Session Hijacking Risk**: Session cookies alone do not prevent hijacking if stolen (e.g., via XSS on HTTP, network sniffing). This is an acceptable risk for **ephemeral, non-sensitive travel data** that expires daily.

   **Why this is acceptable**:
   - Data is temporary (24hr TTL)
   - Data is not sensitive (public travel dates)
   - Users are encouraged to upgrade to paid tier for persistent storage
   - Session cookies expire on browser close

   **What we DO protect against**:
   - ✅ CSRF attacks (SameSite=lax)
   - ✅ JavaScript access (HttpOnly)
   - ✅ Man-in-the-middle on HTTPS (Secure flag in prod)
   - ✅ Indefinite data retention (midnight TTL)

   **What we DON'T protect against** (intentionally):
   - ❌ Session hijacking via stolen cookies (would require client fingerprinting, which adds complexity for ephemeral data)
   - ❌ Concurrent request race conditions during migration (mitigated via distributed locking, see below)

5. **Migration Safety**:
   - **Distributed locking**: Uses Redis-based locks to prevent race conditions
   - Lock key: `migration:lock:{sessionId}`
   - Lock TTL: 30 seconds (auto-expires if migration crashes)
   - **Idempotent behavior**: Cache always clears after migration attempt (even partial failures)
   - **Skipped migrations**: If lock exists, migration returns `{ skipped: true }` immediately

**Implementation Files**:
- `packages/trip-store/src/internal/session-manager.ts` - Session cookie management
- `packages/trip-store/src/public/migration.ts` - Cache-to-Supabase migration with locking
- `packages/trip-store/src/internal/validation.ts` - Input validation (session IDs, trip data)

**Best Practices**:
- Always validate session IDs before cache lookups
- Never log session IDs or cache keys (contains pseudo-PII)
- Use `@uth/trip-store` operations instead of direct cache access
- Document any changes to session security model here

### Database Migrations

GitHub is the **single source of truth** for database schema. Never make schema changes directly in Supabase Dashboard.

**Structure:**
```
supabase/
├── migrations/          # SQL migrations (applied in order)
├── seed.sql            # Reference data (subscription_statuses, feature_policies)
├── tests/database/     # pgTAP tests
└── config.toml         # Local dev config
```

**Workflow:**
1. **PR to `master`**: CI runs `supabase db reset` + `supabase test db` on fresh local DB
2. **Merge to `master`**: CD runs `supabase db push` to apply migrations to production

**Local Development:**
```bash
npx supabase start          # Start local Supabase
npx supabase db reset       # Reset DB + apply migrations + seed
npx supabase test db        # Run pgTAP tests
npx supabase db lint        # Check for schema issues
```

**Creating New Migrations:**
```bash
npx supabase migration new <name>   # Creates timestamped .sql file
# Edit the file, then test locally with db reset
```

### SDK Usage Guidelines

This project uses abstraction packages to encapsulate third-party services. **You MUST use these SDKs instead of importing underlying client libraries directly.** This provides better encapsulation, testability, and flexibility.

#### General Principles

1. **NEVER import third-party clients directly** in application code:
   - ❌ `import { createClient } from '@supabase/supabase-js'`
   - ❌ `import { currentUser } from '@clerk/nextjs'`
   - ❌ `import Stripe from 'stripe'`

2. **ALWAYS use the SDK packages** provided in this monorepo:
   - ✅ `import { db } from '@uth/db'`
   - ✅ `import { getCurrentUser } from '@uth/auth-server'`
   - ✅ `import { getStripeClient } from '@uth/payments'`

3. **DO NOT expose underlying types** from SDKs:
   - ❌ Exporting Supabase-specific types from `@uth/db`
   - ✅ Define domain types in SDK packages and export those instead

#### Auth Package (`@uth/auth-server`, `@uth/auth-client`)

**Server-Side Usage**:
```typescript
import { getCurrentUser, requireAuth } from '@uth/auth-server';

// Get current user (returns null if not authenticated)
const user = await getCurrentUser();

// Require authentication (throws if not authenticated)
const user = await requireAuth();
```

**Client-Side Usage**:
```typescript
import { useUser, useAuth } from '@uth/auth-client';

// Access user in React components
const { user, isLoaded } = useUser();
const { signOut } = useAuth();
```

**What NOT to do**:
```typescript
// ❌ Don't import Clerk directly
import { auth, currentUser } from '@clerk/nextjs';
import { useUser } from '@clerk/nextjs';

// ❌ Don't expose Clerk types
export type { User } from '@clerk/nextjs/server';
```

#### Database Package (`@uth/db`)

**Reading Data**:
```typescript
import { db } from '@uth/db';

// Get all feature policies
const policies = await db.getAllFeaturePolicies();

// Get specific feature policy
const policy = await db.getFeaturePolicyByKey('premium-export');

// Get user profile
const profile = await db.getUserProfile(userId);
```

**Writing Data**:
```typescript
import { db } from '@uth/db';

// Update user profile
await db.updateUserProfile(userId, {
  subscription_tier: 'monthly',
});

// Create records
await db.createPurchaseIntent({
  user_id: userId,
  stripe_checkout_session_id: sessionId,
});
```

**What NOT to do**:
```typescript
// ❌ Don't create Supabase clients directly
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, key);

// ❌ Don't import Supabase types
import type { Database } from '@uth/db/internal/providers/supabase.types';

// ❌ Don't expose Supabase client from functions
export function getClient() {
  return createClient(url, key); // WRONG!
}

// ✅ Use DB operations instead
import { db } from '@uth/db';
const data = await db.getSomething();
```

**Type Safety**:
```typescript
// ✅ Use domain types from SDK
import type { FeaturePolicy, UserProfile } from '@uth/db';

// ❌ Don't import internal Supabase types
import type { Tables } from '@uth/db/internal/providers/supabase.types';
```

#### Payments Package (`@uth/payments`)

**Server-Side Usage**:
```typescript
import { getStripeClient, createCheckoutSession } from '@uth/payments';

// Create checkout session
const session = await createCheckoutSession({
  userId: user.id,
  priceId: 'price_xyz',
  successUrl: '/success',
  cancelUrl: '/cancel',
});

// Access Stripe client (only when SDK doesn't provide needed operation)
const stripe = getStripeClient();
const customer = await stripe.customers.retrieve(customerId);
```

**What NOT to do**:
```typescript
// ❌ Don't create Stripe client directly
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ❌ Don't expose Stripe types
export type { Stripe } from 'stripe';
```

#### Benefits of Using SDKs

1. **Encapsulation**: Implementation details (Supabase, Clerk, Stripe) are hidden
2. **Testability**: Easy to mock SDK functions in tests
3. **Flexibility**: Can swap underlying providers without changing application code
4. **Type Safety**: Domain types are consistent across the codebase
5. **Security**: SDK enforces correct client usage (user-scoped vs admin)

#### Migration Pattern

When refactoring code to use SDKs:

1. **Identify direct imports** of third-party clients
2. **Find corresponding SDK operation** (or add it if missing)
3. **Update imports** to use SDK package
4. **Replace client calls** with SDK function calls
5. **Update tests** to mock SDK instead of third-party client

**Example Migration**:
```typescript
// Before (❌ Direct Supabase usage)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);
const { data } = await supabase
  .from('feature_policies')
  .select('*')
  .eq('key', 'premium-export')
  .single();

// After (✅ Using DB SDK)
import { db } from '@uth/db';

const policy = await db.getFeaturePolicyByKey('premium-export');
```

#### When to Extend SDKs

If you need an operation not provided by the SDK:

1. **Add the operation to the SDK package** (preferred)
2. **Update the provider interface** to include the new operation
3. **Implement in all adapters** (Supabase, Mock, etc.)
4. **Export from SDK public API**
5. **Use in application code**

**DO NOT** bypass the SDK by importing the underlying client directly.

### Code Style

- Use TypeScript for type safety
- Follow existing component patterns (shadcn/ui conventions)
- Keep components small and focused
- Use Tailwind utility classes (avoid custom CSS when possible)

### Common Tasks

#### Adding New Data Fields

When adding fields like vignette entry date or visa start date:

1. Update the data model in `stores/travelStore.ts`
2. Add columns to table in `TravelTable.tsx`
3. Update PDF parser if data can be extracted from PDFs
4. Update Excel export to include new fields
5. Update UI forms/inputs for manual entry

#### PDF Parsing

- Parser is in `lib/parser.ts`
- API endpoint: `app/api/parse/route.ts`
- Currently parses travel history from Home Office SAR documents
- May need extension to parse vignette/visa dates if available in PDFs

#### Excel Export

- Export logic in `app/api/export/route.ts`
- Uses ExcelJS to generate formatted spreadsheets
- Should include all tracked data: trips, vignette dates, visa dates

## Monitoring & Error Tracking

- **Sentry** is configured for error tracking
- Instrumentation files: `instrumentation-client.ts`, `instrumentation.ts`
- Check Sentry dashboard for production errors

## Current State

### Recently Modified Files

- **Routing & Pages**:
  - `app/page.tsx` - Home/landing page (NEW routing structure)
  - `app/travel/page.tsx` - Travel tracker page (NEW route)
  - `components/LandingPage.tsx` - Landing page component
  - `components/TravelPageClient.tsx` - Travel tracker component
  - `components/Header.tsx` - Updated with home link navigation
- **Features**:
  - `stores/travelStore.ts` - Vignette/visa dates, continuous leave, rolling 12-month checks
  - `components/VisaDetailsCard.tsx` - Input fields for vignette/visa dates
  - `components/SummaryCards.tsx` - Continuous leave display with 180-day warning
  - `app/api/export/route.ts` - Enhanced Excel export with all calculations

### Recent Changes

- ✅ **Routing**: Separated home and travel pages with Next.js App Router
- ✅ **Landing Page**: Professional onboarding with SAR request instructions
- ✅ **Navigation**: Query params for deep linking (import/add actions)
- ✅ Added vignette entry date and visa start date tracking
- ✅ Implemented continuous leave calculation per Home Office guidance
- ✅ Added rolling 12-month absence check (180-day limit)
- ✅ Visual warning when 180-day limit exceeded
- ✅ Enhanced Excel export with complete visa/vignette information
- ✅ Follows UK Home Office guidance v22.0 for ILR calculations

## Important Notes

### Date Handling & Calculations

#### Date Storage and Display

- All dates stored in ISO format (YYYY-MM-DD)
- Display format: DD/MM/YYYY (UK context)

#### Absence Calculation (per UK Home Office Guidance v22.0)

The application follows the official UK Home Office guidance for calculating continuous periods:

1. **Full Days Outside UK**:
   - Formula: `(Return Date − Departure Date) − 1`
   - Excludes both departure day and return day
   - Only complete days spent abroad count
   - This is the standard method for UK residency calculations

2. **Continuous Leave (Days in UK)**:
   - Formula: `(Total days since start date) − (Total full days outside UK)`
   - Start date is either vignette entry date OR visa start date
   - Represents actual days physically present in the UK

3. **Rolling 12-Month Absence Check**:
   - Per Home Office rules: "No more than 180 days' absences are allowed in a consecutive 12-month period"
   - The app checks EVERY rolling 12-month period from the start date
   - Only **whole days** count (part-day absences <24hrs are excluded)
   - If any 12-month window exceeds 180 days, the continuous period may be broken

#### Key Rules from Home Office Guidance

- **180-day limit**: Maximum absence in any rolling 12-month period
- **Whole days only**: Part-day absences (same-day return) don't count
- **Rolling basis**: For leave granted after 11 January 2018, absences are considered on a rolling basis
- **Continuous period**: Must be spent lawfully in the UK with valid leave

### Performance Considerations

- PDF parsing can be slow for large documents
- Consider showing loading states
- Table virtualization may be needed for users with extensive travel history

### Security

- File uploads should be validated (file type, size)
- PDF parsing should be sandboxed (potential security risk)
- No sensitive data should be logged

## Testing Strategy

- Manual testing for PDF import functionality
- Test calculation logic with edge cases (same-day trips, etc.)
- Test Excel export with various data combinations
- Mobile responsiveness testing

## Deployment

- Deploy target: Vercel
- Environment variables needed:
  - Sentry DSN (if using Sentry)
  - Any API keys for future integrations

## Future Considerations

1. **Data Persistence**: Currently appears to be client-side only; may need database
2. **Multi-user Support**: Authentication and user accounts
3. **Advanced Calculations**: Different visa types, continuous residence rules
4. **PDF Template Support**: Support for different PDF formats/sources
5. **Data Import/Export**: Support for CSV, JSON formats
6. **Backup/Restore**: Allow users to save/load their data

## Questions to Ask Before Making Changes

1. Does this change affect the day calculation logic?
   - If yes: Does it comply with UK Home Office guidance v22.0?
   - Reference: `docs/calculating-continuous-period-v22.0ext.pdf`
2. Will this break existing PDF parsing?
3. Does the Excel export need updating?
4. Is this mobile-responsive?
5. Does this follow MobX patterns (actions for mutations)?
6. Are we maintaining type safety?
7. Does this affect the rolling 12-month absence calculation?
8. Should the 180-day warning logic be updated?

## Common Pitfalls to Avoid

- Don't mutate MobX state directly (always use actions)
- Don't break the responsive design (test mobile view)
- Don't change the calculation formula without confirming requirements
- Don't add dependencies without considering bundle size
- Don't skip error handling for file uploads/parsing
