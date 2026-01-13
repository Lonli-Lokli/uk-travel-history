# UK Travel History Parser

[![CI](https://github.com/Lonli-Lokli/uk-travel-history/actions/workflows/ci.yml/badge.svg)](https://github.com/Lonli-Lokli/uk-travel-history/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Lonli-Lokli/uk-travel-history/branch/master/graph/badge.svg)](https://codecov.io/gh/Lonli-Lokli/uk-travel-history)
[![Vercel](https://img.shields.io/badge/deployed-vercel-black?logo=vercel)](https://busel.uk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

A professional Next.js web application for tracking UK travel history and calculating ILR (Indefinite Leave to Remain) eligibility using the official UK Home Office backward counting algorithm. Designed for individuals needing to calculate their time spent outside the UK for immigration and residency purposes.

## Features

- PDF Import: Upload Home Office SAR (Subject Access Request) documents to auto-populate travel history
- Vignette & Visa Tracking: Track vignette entry dates and visa start dates
- ILR Track Selection: Choose your ILR qualifying period (2, 3, 5, or 10 years)
- Auto-Calculated Application Date: Automatically calculates earliest application date (28 days before required period ends)
- UK Home Office Algorithm: Uses official backward counting method to assess ILR eligibility
- Rolling 12-Month Absence Check: Monitors every rolling 12-month period for 180-day limit compliance
- Editable Table: Click any cell to edit dates and routes inline
- Add/Delete Trips: Manually add trips or remove incorrect entries
- Live Calculations: Full days outside UK calculated automatically per Home Office guidance v8.0
- 180-Day Warning: Visual alerts when rolling period exceeds 180-day limit
- Excel Export: Download formatted spreadsheet with all data, calculations, and compliance status
- Mobile-First: Responsive design with card view on mobile, table on desktop
- Professional UI: Clean, minimalist design using shadcn/ui components

## Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Runtime**: React 19
- **State Management**: MobX (observer pattern)
- **Authentication**: Clerk (public sign-up model)
- **Database**: Supabase (PostgreSQL with RLS)
- **Payments**: Stripe (subscriptions + one-time)
- **Table**: TanStack React Table v8
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Charts**: Highcharts
- **PDF Parsing**: pdf-parse
- **Excel Generation**: ExcelJS
- **Date Handling**: dayjs
- **Error Tracking**: Sentry
- **Monorepo**: Nx

## Architecture

This is an Nx monorepo with a layered architecture following domain-driven design principles.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js App                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Server Components (RSC)                         │  │
│  │  - Pages with appFlow.page() generators          │  │
│  │  - API Routes (/api/*)                           │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Client Components                               │  │
│  │  - MobX Stores (reactive state)                  │  │
│  │  - UI Components (shadcn/ui)                     │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Shared Packages (@uth/*)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Flow      │  │  Auth        │  │  Payments    │  │
│  │  (control)  │  │  (client/    │  │  (client/    │  │
│  │             │  │   server)    │  │   server)    │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Features   │  │   Stores     │  │   Widgets    │  │
│  │  (flags)    │  │   (MobX)     │  │  (React)     │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │     DB      │  │      UI      │  │    Utils     │  │
│  │  (Supabase) │  │  (shadcn/ui) │  │  (helpers)   │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
│  ┌─────────────┐  ┌──────────────┐                    │
│  │   Parser    │  │  Calculators │                    │
│  │    (PDF)    │  │  (ILR logic) │                    │
│  └─────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              External Services                          │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │  Clerk   │  │ Supabase │  │      Stripe        │   │
│  │  (Auth)  │  │   (DB)   │  │    (Payments)      │   │
│  └──────────┘  └──────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Package Responsibilities

**Core Infrastructure:**

- **[`@uth/flow`](./packages/flow/README.md)** - Generator-based control flow for Server Components
- **[`@uth/features`](./packages/features/README.md)** - Feature flag system (env + Vercel Edge Config)
- **[`@uth/db`](./packages/db/README.md)** - Supabase client with RLS, user provisioning, schema
- **[`@uth/utils`](./packages/utils/README.md)** - Shared utilities (logger, date helpers, validation)

**Authentication & Payments:**

- **[`@uth/auth/client`](./packages/auth/client/README.md)** - Client-side auth (React hooks, Clerk adapter)
- **[`@uth/auth/server`](./packages/auth/server/README.md)** - Server-side auth (user management, JWT validation)
- **[`@uth/payments/client`](./packages/payments/client/README.md)** - Client-side payments (Stripe checkout UI)
- **[`@uth/payments/server`](./packages/payments/server/README.md)** - Server-side payments (webhooks, subscriptions)

**State & UI:**

- **[`@uth/stores`](./packages/stores/README.md)** - MobX stores (travel, auth, payment, navigation)
- **[`@uth/widgets`](./packages/widgets/README.md)** - React widgets (feature gates, providers)
- **[`@uth/ui`](./packages/ui/README.md)** - shadcn/ui components + Radix primitives

**Domain Logic:**

- **[`@uth/calculators`](./packages/calculators/README.md)** - ILR calculations (backward counting, rolling periods)
- **[`@uth/parser`](./packages/parser/README.md)** - PDF parsing (Home Office SAR documents)

### Security Model

**Three-Layer Defense:**

1. **Route Protection** (`proxy.ts` middleware)
   - Clerk authentication for protected routes
   - Public routes: `/`, `/travel`, `/about`, `/terms`, `/status`
   - Protected routes: `/account`, `/api/billing/*`

2. **API Authorization** (feature-based)
   - Subscription tier validation via `@uth/features`
   - Type-safe user access via `getCurrentUser()`

3. **Database RLS** (Supabase Row Level Security)
   - User-scoped clients (anon key + Clerk JWT)
   - Admin clients (service_role key, webhooks only)
   - Column-level restrictions on entitlement fields

## Prerequisites

- Node.js 20+
- npm, yarn, or pnpm

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Lonli-Lokli/uk-travel-history.git
cd uk-travel-history

# Install dependencies
npm install

# Run development server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

```
uk-travel-history/
├── apps/
│   └── uk-travel-history/
│       └── src/
│           ├── app/
│           │   ├── api/
│           │   │   ├── parse/route.ts      # PDF parsing endpoint
│           │   │   └── export/route.ts     # Excel export endpoint
│           │   ├── page.tsx                # Home/landing page
│           │   ├── travel/
│           │   │   └── page.tsx            # Travel tracker page
│           │   └── layout.tsx              # Root layout with metadata
│           └── components/
│               ├── LandingPage.tsx         # Home page with instructions
│               ├── TravelPageClient.tsx    # Main travel tracker
│               ├── Header.tsx              # Navigation header
│               ├── SummaryCards.tsx        # Stats cards with tooltips
│               ├── CompoundStatCard.tsx    # Multi-value card component
│               ├── VisaDetailsCard.tsx     # Visa/vignette inputs
│               ├── TravelHistoryCard.tsx   # Table wrapper
│               ├── RiskAreaChart.tsx       # Rolling absence chart
│               └── ValidationStatusCard.tsx # Eligibility validation
├── packages/
│   ├── calculators/                        # ILR calculation logic
│   │   └── src/lib/
│   │       ├── calculators.ts              # Core algorithms
│   │       └── shapes.ts                   # TypeScript types
│   ├── parser/                             # PDF parsing logic
│   │   └── src/lib/parser.ts
│   ├── ui/                                 # Shared UI components & store
│   │   └── src/
│   │       ├── stores/
│   │       │   └── travelStore.ts          # MobX state management
│   │       ├── TravelTable.tsx             # Editable table
│   │       └── [shadcn components]         # button, card, dialog, etc.
│   └── utils/                              # Shared utilities
└── docs/
    ├── UK-Home-Office-Continuous-Period-Rules.md
    └── calculating-continuous-period-v22.0ext.pdf
```

## Usage

### Step 1: Enter Visa Details

1. Enter your **Vignette Entry Date** or **Visa Start Date**
2. Select your **ILR Track** (2, 3, 5, or 10 years)
3. Optionally override the **Application Date** (auto-calculated by default)

### Step 2: Add Travel History

- **Import from PDF**: Upload a Home Office SAR travel history document
- **Manual Entry**: Click "Add Trip" to add entries manually
- **Edit**: Click any cell in the table to edit
- **Delete**: Click the trash icon to remove a trip

### Step 3: Review Compliance

- **Summary Cards**: View continuous days in UK, total absences, and rolling 12-month absence
- **180-Day Warning**: Visual alerts if any rolling period exceeds 180 days
- **Rolling Absence Chart**: Timeline showing absence patterns over time
- **Validation Card**: See eligibility status and reasons for ineligibility

### Step 4: Export

Click "Export Excel" to download a formatted spreadsheet with all data and calculations.

## Routes

- `/` - Home page with instructions and onboarding
- `/travel` - Travel history tracker with full functionality

## Calculation Methods (UK Home Office Guidance v8.0)

### Full Days Outside UK (Per Trip)

**Formula:** `Full Days = (Return Date − Departure Date) − 1`

- Excludes both the departure day and return day
- Only complete days spent abroad count
- This is the official UK Home Office method for residency calculations

**Example:**

- Departure: 15 January 2020
- Return: 20 January 2020
- Calculation: (20 Jan - 15 Jan) - 1 = **4 full days outside UK**

### UK Home Office Backward Counting Algorithm

The app uses the official Home Office backward counting method to assess ILR eligibility:

1. Auto-calculates earliest application date: Visa start + Required years - 28 days
2. Tests multiple assessment dates from application date through +28 days
3. Counts backward: For each assessment date, counts back by required years
4. Finds most beneficial period: Selects the assessment date with lowest maximum rolling absence
5. Verifies compliance: Checks that no rolling 12-month window exceeded 180 days

### Rolling 12-Month Absence Check

**Rule:** No more than 180 days' absences allowed in any consecutive 12-month period (for leave granted after 11 January 2018)

The app checks every rolling 12-month window from visa start to assessment date and counts only whole days (part-day absences excluded).

### Continuous Leave Calculation

**Formula:** `Days in UK = (Total days from entry to today) − (Total full days outside UK)`

This represents actual days physically present in the UK during the continuous period.

## Development

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint all projects
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

## Feature Flags

The application supports a two-layer feature flag system for controlled rollout of monetization features:

- **Environment Variables**: Simple boolean flags for basic enable/disable
- **Vercel Edge Config**: Dynamic flags with percentage-based rollouts and beta user targeting

For detailed documentation on setting up and using feature flags, see [docs/feature-flags.md](docs/feature-flags.md).

### Quick Start

```bash
# Copy environment example
cp apps/uk-travel-history/.env.local.example apps/uk-travel-history/.env.local

# Enable features for development
# Edit .env.local and set desired flags to 'true'
```

See [RFC-007](https://github.com/Lonli-Lokli/uk-travel-history/issues/52) for the complete feature flag specification.

## License

MIT
