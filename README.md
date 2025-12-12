# UK Travel History Parser

[![CI](https://github.com/Lonli-Lokli/uk-travel-history/actions/workflows/ci.yml/badge.svg)](https://github.com/Lonli-Lokli/uk-travel-history/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Lonli-Lokli/uk-travel-history/branch/master/graph/badge.svg)](https://codecov.io/gh/Lonli-Lokli/uk-travel-history)
[![Vercel](https://img.shields.io/badge/deployed-vercel-black?logo=vercel)](https://uk-travel-history.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

A professional Next.js web application for tracking UK travel history and calculating ILR (Indefinite Leave to Remain) eligibility using the official UK Home Office backward counting algorithm. Designed for individuals needing to calculate their time spent outside the UK for immigration/residency purposes.

## Features

- **PDF Import**: Upload Home Office SAR (Subject Access Request) documents to auto-populate travel history
- **Vignette & Visa Tracking**: Track vignette entry dates and visa start dates
- **ILR Track Selection**: Choose your ILR qualifying period (2, 3, 5, or 10 years)
- **Auto-Calculated Application Date**: Automatically calculates earliest application date (28 days before required period ends)
- **UK Home Office Algorithm**: Uses official backward counting method to assess ILR eligibility
- **Rolling 12-Month Absence Check**: Monitors every rolling 12-month period for 180-day limit compliance
- **Editable Table**: Click any cell to edit dates and routes inline
- **Add/Delete Trips**: Manually add trips or remove incorrect entries
- **Live Calculations**: Full days outside UK calculated automatically per Home Office guidance v22.0
- **180-Day Warning**: Visual alerts when rolling period exceeds 180-day limit
- **Excel Export**: Download formatted spreadsheet with all data, calculations, and compliance status
- **Mobile-First**: Responsive design with card view on mobile, table on desktop
- **Professional UI**: Clean, minimalist design using shadcn/ui components

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **State Management**: MobX (observer pattern)
- **Table**: TanStack React Table v8
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **PDF Parsing**: pdf-parse
- **Excel Generation**: ExcelJS
- **Date Handling**: date-fns
- **Error Tracking**: Sentry (optional)

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/uk-travel-parser.git
cd uk-travel-parser

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

### Option 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/uk-travel-parser)

### Option 2: Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

## Project Structure

```
uk-travel-history/
├── apps/uk-travel-history/src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── parse/route.ts      # PDF parsing endpoint
│   │   │   └── export/route.ts     # Excel export endpoint
│   │   ├── page.tsx                # Home/landing page
│   │   ├── travel/
│   │   │   └── page.tsx            # Travel tracker page
│   │   └── layout.tsx
│   └── components/
│       ├── ui/                     # shadcn/ui components
│       ├── LandingPage.tsx         # Home page with instructions
│       ├── TravelPageClient.tsx    # Main travel tracker
│       ├── Header.tsx              # Navigation header
│       ├── SummaryCards.tsx        # Stats cards (continuous leave, rolling absences)
│       ├── VisaDetailsCard.tsx     # Visa/vignette inputs
│       ├── TravelHistoryCard.tsx   # Table wrapper
│       └── TravelTable.tsx         # Editable table
├── packages/ui/src/
│   ├── stores/
│   │   ├── travelStore.ts          # MobX state management
│   │   └── travelStore.test.ts     # 53 tests (all passing)
│   └── lib/
│       ├── parser.ts               # PDF parsing logic
│       └── utils.ts                # Utility functions
└── docs/
    ├── UK-Home-Office-Continuous-Period-Rules.md
    └── calculating-continuous-period-v22.0ext.pdf
```

## Usage

### Getting Started
1. Visit the home page (`/`) for instructions on requesting your travel history from the UK Home Office
2. Choose to either **Import from PDF** or **Add Travel Dates Manually**
3. You'll be taken to the travel tracker page (`/travel`)

### On the Travel Tracker Page

#### Step 1: Enter Visa Details
1. **Vignette Entry Date** or **Visa Start Date**: Enter when your UK visa began
2. **ILR Track**: Select your qualifying period (2, 3, 5, or 10 years)
3. **Application Date (Override)**: Optional - The app auto-calculates the earliest application date. Override only if you plan to apply on a different date.

#### Step 2: Add Travel History
1. **Import from PDF**: Upload a Home Office SAR travel history document (auto-populates trips)
2. **Manual Entry**: Click "Add Trip" to add entries manually
3. **Edit**: Click any cell in the table to edit dates or routes
4. **Delete**: Click the trash icon to remove a trip

#### Step 3: Review Compliance
- **Summary Cards**: View continuous days in UK, total absences, and maximum rolling 12-month absence
- **180-Day Warning**: Red warning appears if any rolling period exceeds 180 days
- **Rolling Absence Chart**: Visual timeline showing absence patterns over time

#### Step 4: Export
Click "Export Excel" to download a formatted spreadsheet with:
- All travel history
- Visa/vignette dates
- Calculated compliance metrics
- Rolling period analysis

### Routes
- `/` - Home page with instructions and onboarding
- `/travel` - Travel history tracker with full functionality

## Calculation Methods (UK Home Office Guidance v22.0)

### 1. Full Days Outside UK (Per Trip)

**Formula:** `Full Days = (Return Date − Departure Date) − 1`

- Excludes both the departure day and return day
- Only complete days spent abroad count
- This is the official UK Home Office method for residency calculations

**Example:**
- Departure: 15 January 2020
- Return: 20 January 2020
- Calculation: (20 Jan - 15 Jan) - 1 = **4 full days outside UK**

### 2. UK Home Office Backward Counting Algorithm

The app uses the **official Home Office backward counting method** to assess ILR eligibility:

1. **Auto-calculates earliest application date**: Visa start + Required years - 28 days
2. **Tests multiple assessment dates**: From application date through +28 days
3. **Counts backward**: For each assessment date, counts back by required years (e.g., 5 years)
4. **Finds most beneficial period**: Selects the assessment date with lowest maximum rolling absence
5. **Verifies compliance**: Checks that no rolling 12-month window exceeded 180 days

This matches exactly how the UK Home Office will evaluate your application.

**Example:**
- Visa start: 1 January 2020
- ILR track: 5 years
- Auto-calculated earliest application date: **4 December 2024** (5 years - 28 days)
- Assessment window: 4 Dec 2024 to 1 Jan 2025
- App selects the date with lowest maximum rolling absence

### 3. Rolling 12-Month Absence Check

**Rule:** No more than 180 days' absences allowed in any consecutive 12-month period (for leave granted after 11 January 2018)

The app:
- Checks **every** rolling 12-month window from visa start to assessment date
- Counts only **whole days** (part-day absences <24hrs excluded)
- Alerts if any window exceeds 180 days
- Uses the backward counting algorithm to find the most favorable assessment period

### 4. Continuous Leave Calculation

**Formula:** `Days in UK = (Total days since start date) − (Total full days outside UK)`

This represents actual days physically present in the UK during the continuous period.

### Rolling Period Overlap Calculation

When trips partially overlap with rolling 12-month windows:

1. **Define Absence Period**: Days BETWEEN departure and return (exclusive)
   - Absence Start = Departure Date + 1 day
   - Absence End = Return Date - 1 day

2. **Calculate Intersection**: Find overlap with the 12-month window
   - Intersection Start = MAX(Absence Start, Window Start)
   - Intersection End = MIN(Absence End, Window End)

3. **Count Days**: If valid (Start ≤ End), count inclusively
   - Days in Window = (Intersection End - Intersection Start) + 1

This ensures accurate calculation of partial trip overlaps.

## License

MIT
