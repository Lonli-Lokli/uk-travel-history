# Claude Project Context - UK Travel History Parser

## Project Overview

This is a Next.js application designed to help users track their UK travel history, vignette entry dates, and visa start dates. The primary use case is for individuals who need to calculate their time spent outside the UK for immigration/residency purposes.

## Key Requirements

### Core Functionality
1. **Travel History Tracking**: Parse and manage trips in/out of the UK
2. **Vignette Issue & Entry Dates**: Track when entry clearance was issued and when person entered UK
3. **Pre-Entry Period Calculation**: Handle period between vignette issue and UK entry (per Home Office guidance)
4. **Visa Start Dates**: Track visa commencement dates
5. **Days Calculation**: Calculate full days outside UK (excluding departure and return days)

### Data Sources
- PDF uploads from UK Home Office SAR (Subject Access Request) documents
- Manual entry for all data types

## Tech Stack & Architecture

### Framework & Libraries
- **Next.js 14** (App Router)
- **MobX** for state management (observer pattern)
- **TanStack React Table v8** for table functionality
- **shadcn/ui + Radix UI** for components
- **Tailwind CSS** for styling
- **pdf-parse** for PDF parsing
- **ExcelJS** for Excel export

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
- **`/`** (Home): Landing page with instructions and CTAs
  - Shows empty state with "How to Get PDF" guide
  - Two action buttons that navigate to `/travel`
- **`/travel`** (Travel Tracker): Main application
  - Always shows full UI (cards, table, etc.)
  - Users interact with Import/Export buttons in header
  - Header logo links back to home

**Design Philosophy**: Clean navigation without hacky query params or setTimeout. Users are routed to the travel page where they naturally use the UI buttons.

## Development Guidelines

### When Working on This Project

1. **State Management**: All state changes must go through MobX store actions
2. **Table Edits**: Use TanStack Table's built-in editing capabilities
3. **Calculations**: The formula for full days is: `(Return Date - Departure Date) - 1`
4. **UI/UX**: Maintain mobile-first, responsive design (cards on mobile, table on desktop)
5. **Data Validation**: Ensure dates are valid and in correct format

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
  - `packages/ui/src/stores/travelStore.ts` - Vignette/visa dates, pre-entry period, continuous leave, rolling 12-month checks, backward counting
  - `apps/uk-travel-history/src/components/VisaDetailsCard.tsx` - Input fields for vignette issue/entry dates and visa dates
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
- ✅ **Pre-Entry Period Feature** (December 2025):
  - Added vignette issue date field separate from entry date
  - Implemented pre-entry period calculation (issue to entry delay)
  - Pre-entry period counts toward qualifying period if delay ≤ 180 days
  - Pre-entry days count as absence toward 180-day rolling limit
  - Backward counting with 28-day rule finds most beneficial assessment date
  - Comprehensive test coverage (85 tests passing)

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

2. **Pre-Entry Period Handling** (NEW):
   - When vignette issue date and entry date are both set, the system calculates the delay
   - Per Home Office guidance: "The period between entry clearance being issued and the applicant entering the UK may be counted toward the qualifying period"
   - **If delay ≤ 180 days**: The qualifying period starts from the vignette **issue date**, but the pre-entry period counts as absence toward the 180-day limit
   - **If delay > 180 days**: Only time after UK entry counts; qualifying period starts from **entry date**
   - Formula: `preEntryDays = vignetteEntryDate - vignetteIssueDate`
   - The pre-entry days are treated as absence for continuous leave calculation

3. **Continuous Leave (Days in UK)**:
   - Formula: `(Total days since start date) − (Total full days outside UK) − (Pre-entry days if applicable)`
   - Start date is determined by:
     - Vignette issue date (if pre-entry ≤ 180 days)
     - OR vignette entry date (if no issue date or pre-entry > 180 days)
     - OR visa start date (fallback)
   - Represents actual days physically present in the UK

4. **Rolling 12-Month Absence Check**:
   - Per Home Office rules: "No more than 180 days' absences are allowed in a consecutive 12-month period"
   - The app checks EVERY rolling 12-month period from the start date
   - Only **whole days** count (part-day absences <24hrs are excluded)
   - If any 12-month window exceeds 180 days, the continuous period may be broken

5. **Backward Counting (28-Day Rule)**:
   - Per Home Office guidance: "Applicants can submit a settlement application up to 28 days before they would reach the end of the specified period"
   - The system automatically calculates the earliest application date: `(Start Date + Required Years - 28 days)`
   - When assessing eligibility, the system counts backward from the most beneficial date within the 28-day window:
     - Application date
     - Decision date (simulated by application date + up to 28 days)
     - Any date up to 28 days after application
   - The system selects the assessment date that results in the lowest absence count

#### Key Rules from Home Office Guidance
- **180-day limit**: Maximum absence in any rolling 12-month period
- **Whole days only**: Part-day absences (same-day return) don't count
- **Rolling basis**: For leave granted after 11 January 2018, absences are considered on a rolling basis
- **Continuous period**: Must be spent lawfully in the UK with valid leave
- **Pre-entry period**: Can count toward qualifying period if delay ≤ 180 days, but counts as absence toward 180-day limit
- **28-day early application**: Settlement applications can be submitted up to 28 days before the end of the required period

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
