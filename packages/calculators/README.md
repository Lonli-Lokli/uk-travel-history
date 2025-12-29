# @uth/calculators

ILR (Indefinite Leave to Remain) calculation algorithms per UK Home Office guidance.

## Purpose

Implements official UK Home Office backward counting algorithm for ILR eligibility assessment.

## Key Features

- **Backward Counting**: UK Home Office compliant algorithm
- **Rolling Periods**: 12-month absence tracking
- **Multiple Tracks**: Supports 2/3/5/10 year ILR paths
- **Validation**: Eligibility checking with detailed reasons

## Core Algorithms

### Full Days Outside UK

```typescript
fullDays = returnDate - departureDate - 1;
```

Excludes both departure and return days per Home Office guidance.

### Backward Counting Algorithm

1. Calculate assessment date: `visaStart + requiredYears - 28 days`
2. Test multiple assessment dates (application date through +28 days)
3. For each assessment date, count backward by required years
4. Find date with lowest maximum rolling absence
5. Verify no 12-month period exceeds 180 days

### Rolling 12-Month Absence

Checks every consecutive 12-month window from visa start to assessment date.

## API Reference

### `calculateFullDaysOutside(departure, return): number`

Calculate full days outside UK for a single trip.

### `calculateContinuousLeave(visaStart, trips): number`

Calculate continuous days in UK.

### `calculateBackwardCounting(params): ILREligibility`

Run full ILR eligibility assessment.

**Parameters:**

- `visaStartDate` - Visa start or vignette entry date
- `trips` - Array of departure/return trips
- `ilrTrack` - Qualifying period (2/3/5/10 years)
- `applicationDate` - Optional override

**Returns:**

```typescript
interface ILREligibility {
  isEligible: boolean;
  assessmentDate: Date;
  qualifyingPeriodStart: Date;
  totalDaysOutside: number;
  maxRolling12MonthAbsence: number;
  reasons: string[];
}
```

## Usage

```typescript
import { calculateBackwardCounting } from '@uth/calculators';

const result = calculateBackwardCounting({
  visaStartDate: new Date('2020-01-01'),
  trips: [
    { departure: new Date('2020-06-01'), return: new Date('2020-06-15') },
    { departure: new Date('2021-12-20'), return: new Date('2022-01-05') },
  ],
  ilrTrack: 5,
});

if (result.isEligible) {
  console.log('Eligible! Apply on:', result.assessmentDate);
} else {
  console.log('Not eligible:', result.reasons);
}
```

## Testing

```bash
nx test calculators
```

## References

- **[UK Home Office Guidance v22.0](../../docs/calculating-continuous-period-v22.0ext.pdf)** - Official rules
- **[`@uth/stores`](../stores/README.md)** - MobX integration
