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
│   └── page.tsx
├── components/
│   ├── ui/                     # shadcn/ui components
│   └── TravelTable.tsx
├── stores/
│   └── travelStore.ts          # MobX state
└── lib/
    ├── parser.ts
    └── utils.ts
```

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
- `stores/travelStore.ts` - Added vignette/visa dates, continuous leave calculation, rolling 12-month checks
- `components/VisaDetailsCard.tsx` - NEW: Input fields for vignette entry date and visa start date
- `components/SummaryCards.tsx` - Added continuous leave display with 180-day warning
- `app/api/export/route.ts` - Enhanced Excel export with visa/vignette info and all calculations
- `instrumentation-client.ts` - Sentry client setup
- `next.config.js` - Next.js configuration
- `app/api/parse/route.ts` - PDF parsing endpoint

### Recent Changes
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
