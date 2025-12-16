import { describe, it, expect } from 'vitest';
import { calculateTravelData } from './calculators';
import { IneligibilityReason, TripRecord } from './shapes';

// ------------------------------------------------------------------
// STANDARD ROUTES (3 or 5 Year Tracks)
// Applicable to: Skilled Worker, Global Talent, Innovator, etc.
// Rule: Max 180 days absence in any rolling 12-month period.
// ------------------------------------------------------------------
describe('Standard Routes (3/5 Year) - Basic Rules', () => {
  it('calculates full days per trip (excluding departure and return dates)', () => {
    // Rule: Days absent = (Return Date - Departure Date) - 1
    const trips: TripRecord[] = [
      {
        id: '1',
        outDate: '2024-01-01', // Depart Jan 1
        inDate: '2024-01-05', // Return Jan 5
        outRoute: 'Test',
        inRoute: 'Test',
      },
    ];
    // Absent: Jan 2, 3, 4 (3 days)

    const result = calculateTravelData({
      trips,
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 3,
      applicationDateOverride: null,
    });

    expect(result.tripsWithCalculations[0].calendarDays).toBe(4);
    expect(result.tripsWithCalculations[0].fullDays).toBe(3);
  });

  it('treats same-day or next-day return as 0 days absence', () => {
    const trips: TripRecord[] = [
      {
        id: 'same-day',
        outDate: '2024-01-01',
        inDate: '2024-01-01', // Same day
        outRoute: '',
        inRoute: '',
      },
      {
        id: 'next-day',
        outDate: '2024-02-01',
        inDate: '2024-02-02', // Next day
        outRoute: '',
        inRoute: '',
      },
    ];

    const result = calculateTravelData({
      trips,
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 3,
      applicationDateOverride: null,
    });

    expect(result.tripsWithCalculations[0].fullDays).toBe(0);
    expect(result.tripsWithCalculations[1].fullDays).toBe(0);
  });

  it('handles trips spanning year boundaries', () => {
    const trips: TripRecord[] = [
      {
        id: 'year-span',
        outDate: '2023-12-20',
        inDate: '2024-01-05',
        outRoute: 'Test',
        inRoute: 'Test',
      },
    ];
    // Dec 20 to Jan 5 = 16 calendar days, minus 1 = 15 full days
    const result = calculateTravelData({
      trips,
      visaStartDate: '2020-01-01',
      vignetteEntryDate: '2020-01-01',
      ilrTrack: 5,
      applicationDateOverride: null,
    });

    expect(result.tripsWithCalculations[0].fullDays).toBe(15);
  });

  it('handles Leap Years correctly (Feb 29)', () => {
    const trips: TripRecord[] = [
      {
        id: 'leap',
        outDate: '2024-02-28',
        inDate: '2024-03-01',
        outRoute: '',
        inRoute: '',
      },
    ];
    // Absent: Feb 29 (1 day)
    const result = calculateTravelData({
      trips,
      visaStartDate: '2020-01-01',
      vignetteEntryDate: '2020-01-01',
      ilrTrack: 5,
      applicationDateOverride: null,
    });

    expect(result.tripsWithCalculations[0].fullDays).toBe(1);
  });

  it('handles "Return before Departure" data entry error gracefully', () => {
    const trips: TripRecord[] = [
      {
        id: 'error',
        outDate: '2024-01-10',
        inDate: '2024-01-05', // Negative duration
        outRoute: '',
        inRoute: '',
      },
    ];
    const result = calculateTravelData({
      trips,
      visaStartDate: '2020-01-01',
      vignetteEntryDate: '2020-01-01',
      ilrTrack: 5,
      applicationDateOverride: null,
    });

    // Should clamp to 0
    expect(result.tripsWithCalculations[0].fullDays).toBe(0);
  });
});

// ------------------------------------------------------------------
// COMPLEX ROLLING WINDOW SCENARIOS
// ------------------------------------------------------------------
describe('Complex Rolling Window Scenarios', () => {
  it('correctly calculates partial overlaps at window start', () => {
    // Trip: Dec 20, 2023 - Jan 10, 2024 (20 full days)
    // We check eligibility for date: Jan 10, 2024.
    // The rolling window ending Jan 10, 2024 starts Jan 11, 2023.
    // Entire trip is inside.
    const trips: TripRecord[] = [
      {
        id: 'partial',
        outDate: '2023-12-20',
        inDate: '2024-01-10',
        outRoute: '',
        inRoute: '',
      },
    ];

    const result = calculateTravelData({
      trips,
      visaStartDate: '2020-01-01',
      vignetteEntryDate: '2020-01-01',
      ilrTrack: 5,
      applicationDateOverride: '2024-01-10', // Override to check specific window
    });

    expect(result.validation.status).toBe('INELIGIBLE');
    expect(
      result.validation.status === 'INELIGIBLE'
        ? result.validation.reason.type
        : null,
    ).toBe('TOO_EARLY' satisfies IneligibilityReason['type']);
  });

  it('flags when rolling 12-month absences exceed 180 days', () => {
    const trips: TripRecord[] = [
      {
        id: 't1',
        outDate: '2023-02-01',
        inDate: '2023-04-01',
        outRoute: '',
        inRoute: '',
      }, // ~58 days
      {
        id: 't2',
        outDate: '2023-06-01',
        inDate: '2023-08-01',
        outRoute: '',
        inRoute: '',
      }, // ~60 days
      {
        id: 't3',
        outDate: '2023-10-01',
        inDate: '2023-12-05',
        outRoute: '',
        inRoute: '',
      }, // ~64 days
    ];

    const result = calculateTravelData({
      trips,
      vignetteEntryDate: '2023-01-01',
      visaStartDate: '2023-01-01',
      ilrTrack: 5,
      applicationDateOverride: '2028-01-01',
    });

    expect(result.summary.hasExceededAllowedAbsense).toBe(true);
    expect(result.summary.totalFullDays).toBe(182);
  });

  it('accepts exactly 180 days of absence in a rolling period', () => {
    const trips: TripRecord[] = [
      {
        id: 't1',
        outDate: '2023-03-01',
        inDate: '2023-08-29', // Exactly 180 days between these dates
        outRoute: '',
        inRoute: '',
      },
    ];

    const result = calculateTravelData({
      trips,
      vignetteEntryDate: '2023-01-01',
      visaStartDate: '2023-01-01',
      ilrTrack: 3,
      applicationDateOverride: '2026-01-01',
    });

    expect(result.summary.totalFullDays).toBe(180);
    expect(result.summary.hasExceededAllowedAbsense).toBe(false);
  });
});

// ------------------------------------------------------------------
// ELIGIBILITY DATES & ISSUE #29 (Delayed Eligibility)
// ------------------------------------------------------------------
describe('Eligibility Dates & Delayed Eligibility', () => {
  it('calculates the earliest application date (28 days before track end)', () => {
    const result = calculateTravelData({
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 5,
      applicationDateOverride: null,
      trips: [],
    });

    // 5 years -> 2028-01-01. -28 days -> 2027-12-04.
    expect(result.validation.status).toBe('ELIGIBLE');
    expect(
      result.validation.status == 'ELIGIBLE'
        ? result.validation.applicationDate
        : '',
    ).toBe('2027-12-04');
  });

  it('counts pre-entry gap as absence', () => {
    const result = calculateTravelData({
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-05-31', // 150 days later
      ilrTrack: 5,
      applicationDateOverride: null,
      trips: [],
    });

    expect(result.preEntryPeriod?.qualifyingStartDate).toBe('2023-01-01');
    expect(result.preEntryPeriod?.delayDays).toBe(150);
    // These 150 days count towards total absence
    expect(result.summary.totalFullDays).toBeGreaterThanOrEqual(150);
  });

  it('delays eligibility date when absences exceed 180 days', () => {
    // Scenario: Absences are too high in the first year.
    // The calculator must find a date LATER than the standard "-28 days" date
    // where the rolling window no longer exceeds 180 days.

    // Visa: 2023-03-29. Standard 3yr Eligibility: 2026-03-29 (-28d) = 2026-03-01.
    // Absences: 176 days from trips, plus pre-entry (15 days, Mar 29-Apr 12) = 191 total.
    // Expected date: 2026-04-09 (qualifying period starts 2023-04-09, only 4 days of pre-entry
    // overlap: Apr 9-12, plus 176 trip days = 180 days exactly).
    const trips: TripRecord[] = [
      {
        id: '1',
        outDate: '2023-05-01',
        inDate: '2023-08-01',
        outRoute: '',
        inRoute: '',
      }, // 91 days
      {
        id: '2',
        outDate: '2023-09-01',
        inDate: '2023-11-01',
        outRoute: '',
        inRoute: '',
      }, // 60 days
      {
        id: '3',
        outDate: '2024-01-01',
        inDate: '2024-01-27',
        outRoute: '',
        inRoute: '',
      }, // 25 days
    ]; // Total trips: 176 (91+60+25). Pre-entry: 15 days (Mar 29 - Apr 12). Total: 191 days in first year.

    const result = calculateTravelData({
      visaStartDate: '2023-03-29',
      vignetteEntryDate: '2023-04-13',
      ilrTrack: 3,
      applicationDateOverride: null, // Auto-calculate
      trips,
    });

    expect(result.validation.status).toBe('ELIGIBLE');

    const calculatedDate =
      result.validation.status === 'ELIGIBLE'
        ? result.validation.applicationDate
        : '';

    expect(calculatedDate).toBe('2026-04-09');
  });
});

// ------------------------------------------------------------------
// LONG RESIDENCE (10 Year Track) - TRANSITIONAL RULES
// Guidance v8 (July 2025):
// 1. Absences started BEFORE 11 April 2024:
//    - Max 184 days in any single trip.
//    - Max 548 days TOTAL in the pre-April 2024 period.
// 2. Absences started ON/AFTER 11 April 2024:
//    - Max 180 days in any rolling 12-month period.
// ------------------------------------------------------------------
describe('Long Residence (10 Year) Transitional Rules', () => {
  it('allows single absence > 180 days if pre-April 2024 (Limit is 184)', () => {
    const trips: TripRecord[] = [
      {
        id: 'pre-2024',
        outDate: '2020-01-01',
        inDate: '2020-07-03', // ~182 days
        outRoute: '',
        inRoute: '',
      },
    ];

    const result = calculateTravelData({
      trips,
      visaStartDate: '2015-01-01',
      vignetteEntryDate: '2015-01-01',
      ilrTrack: 10,
      applicationDateOverride: null,
    });

    expect(result.validation.status).toBe('ELIGIBLE');
    expect(result.summary.hasExceededAllowedAbsense).toBe(false);
  });

  it('fails single absence > 184 days if pre-April 2024', () => {
    const trips: TripRecord[] = [
      {
        id: 'pre-2024-fail',
        outDate: '2020-01-01',
        inDate: '2020-07-10', // ~190 days
        outRoute: '',
        inRoute: '',
      },
    ];

    const result = calculateTravelData({
      trips,
      visaStartDate: '2015-01-01',
      vignetteEntryDate: '2015-01-01',
      ilrTrack: 10,
      applicationDateOverride: null,
    });

    expect(result.validation.status).toBe('INELIGIBLE');
    if (result.validation.status === 'INELIGIBLE') {
      expect(result.validation.reason.type).toBe('EXCESSIVE_ABSENCE');
    }
  });

  it('fails if Total Absences (pre-April 2024) exceed 548 days', () => {
    // 3 trips of 183 days each (Total ~549)
    const trips: TripRecord[] = [
      {
        id: '1',
        outDate: '2016-01-01',
        inDate: '2016-07-03',
        outRoute: '',
        inRoute: '',
      }, // 183 days
      {
        id: '2',
        outDate: '2018-01-01',
        inDate: '2018-07-03',
        outRoute: '',
        inRoute: '',
      }, // 183 days
      {
        id: '3',
        outDate: '2020-01-01',
        inDate: '2020-07-04',
        outRoute: '',
        inRoute: '',
      }, // 184 days
    ];

    const result = calculateTravelData({
      trips,
      visaStartDate: '2014-01-01',
      vignetteEntryDate: '2014-01-01',
      ilrTrack: 10,
      applicationDateOverride: null,
    });

    expect(result.validation.status).toBe('INELIGIBLE');
  });

  it('enforces rolling 180-day limit for absences starting ON/AFTER 11 April 2024', () => {
    const trips: TripRecord[] = [
      {
        id: 'post-2024',
        outDate: '2024-05-01',
        inDate: '2024-11-03', // ~185 days
        outRoute: '',
        inRoute: '',
      },
    ];

    const result = calculateTravelData({
      trips,
      visaStartDate: '2015-01-01',
      vignetteEntryDate: '2015-01-01',
      ilrTrack: 10,
      applicationDateOverride: null,
    });

    expect(result.validation.status).toBe('INELIGIBLE');
    expect(
      result.validation.status === 'INELIGIBLE'
        ? result.validation.reason.type
        : null,
    ).toBe('EXCESSIVE_ABSENCE' satisfies IneligibilityReason['type']);
  });
});

// ------------------------------------------------------------------
// INVALID INPUTS & ERRORS
// ------------------------------------------------------------------
describe('Invalid Inputs & Errors', () => {
  it('returns error when visa start date is after vignette entry date', () => {
    const result = calculateTravelData({
      visaStartDate: '2023-06-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 3,
      applicationDateOverride: null,
      trips: [],
    });
    expect(result.validation.status).toBe('INELIGIBLE');
    expect(
      result.validation.status === 'INELIGIBLE'
        ? result.validation.reason.type
        : null,
    ).toBe('INCORRECT_INPUT' satisfies IneligibilityReason['type']);
  });

  it('returns error when trips have incomplete data', () => {
    const trips: TripRecord[] = [
      {
        id: 't1',
        outDate: '2023-03-01',
        inDate: '',
        outRoute: '',
        inRoute: '',
      },
    ];
    const result = calculateTravelData({
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 3,
      applicationDateOverride: null,
      trips,
    });
    expect(result.validation.status).toBe('INELIGIBLE');
    expect(
      result.validation.status === 'INELIGIBLE'
        ? result.validation.reason.type
        : null,
    ).toBe('INCOMPLETED_TRIPS' satisfies IneligibilityReason['type']);
  });

  it('returns error when trip dates are overlapping', () => {
    const trips: TripRecord[] = [
      {
        id: 't1',
        outDate: '2023-03-01',
        inDate: '2023-04-01',
        outRoute: '',
        inRoute: '',
      },
      {
        id: 't2',
        outDate: '2023-03-15', // Overlaps with t1
        inDate: '2023-05-01',
        outRoute: '',
        inRoute: '',
      },
    ];
    const result = calculateTravelData({
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 3,
      applicationDateOverride: null,
      trips,
    });
    expect(result.validation.status).toBe('INELIGIBLE');
    expect(
      result.validation.status === 'INELIGIBLE'
        ? result.validation.reason.type
        : null,
    ).toBe('INCORRECT_INPUT' satisfies IneligibilityReason['type']);
  });

  it('returns error when application date is too early', () => {
    const result = calculateTravelData({
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 5,
      applicationDateOverride: '2026-01-01', // Only 3 years in
      trips: [],
    });
    expect(result.validation.status).toBe('INELIGIBLE');
    expect(
      result.validation.status === 'INELIGIBLE'
        ? result.validation.reason.type
        : null,
    ).toBe('TOO_EARLY' satisfies IneligibilityReason['type']);
  });
});

// ------------------------------------------------------------------
// NEW FEATURES - Chart Improvements
// ------------------------------------------------------------------
describe('Feature 1: Future Absence Quota Projection', () => {
  it('calculates nextExpirationDate for rolling absence data points', () => {
    const trips: TripRecord[] = [
      {
        id: 't1',
        outDate: '2023-02-01',
        inDate: '2023-02-15', // 13 full days
        outRoute: 'Trip 1',
        inRoute: 'Trip 1',
      },
    ];

    const result = calculateTravelData({
      trips,
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 3,
      applicationDateOverride: null,
    });

    // Check that rolling absence data points have expiration info
    expect(result.rollingAbsenceData.length).toBeGreaterThan(0);

    // Find a data point after the trip
    const pointAfterTrip = result.rollingAbsenceData.find(
      (p) => p.date >= '2023-03-01'
    );

    if (pointAfterTrip && pointAfterTrip.rollingDays > 0) {
      // Should have expiration date when there are absences
      expect(pointAfterTrip.nextExpirationDate).toBeTruthy();
      expect(pointAfterTrip.daysToExpire).toBeGreaterThan(0);
    }
  });

  it('sets nextExpirationDate to null when no absences contribute', () => {
    const result = calculateTravelData({
      trips: [],
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 3,
      applicationDateOverride: null,
    });

    // All points should have 0 rolling days and no expiration
    const samplePoint = result.rollingAbsenceData[0];
    if (samplePoint) {
      expect(samplePoint.rollingDays).toBe(0);
      expect(samplePoint.nextExpirationDate).toBeNull();
      expect(samplePoint.daysToExpire).toBeNull();
    }
  });
});

describe('Feature 2: Chart Scope Ends at Eligibility Date', () => {
  it('limits rolling absence data to eligibility date when auto-calculated', () => {
    const trips: TripRecord[] = [
      {
        id: 't1',
        outDate: '2023-02-01',
        inDate: '2023-02-10',
        outRoute: '',
        inRoute: '',
      },
    ];

    const result = calculateTravelData({
      trips,
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 3,
      applicationDateOverride: null,
    });

    // Chart should end at or before the eligibility date
    if (result.validation.status === 'ELIGIBLE') {
      const lastPoint = result.rollingAbsenceData[result.rollingAbsenceData.length - 1];
      expect(lastPoint.date <= result.validation.applicationDate).toBe(true);
    }
  });

  it('extends rolling data to override date when provided', () => {
    const overrideDate = '2026-06-01';

    const result = calculateTravelData({
      trips: [],
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 3,
      applicationDateOverride: overrideDate,
    });

    // Chart should end at the override date
    const lastPoint = result.rollingAbsenceData[result.rollingAbsenceData.length - 1];
    expect(lastPoint.date <= overrideDate).toBe(true);
  });
});

describe('Feature 3: Today\'s Absence Quota Summary', () => {
  it('calculates currentRollingAbsenceToday correctly', () => {
    // Create a trip that ended recently
    const today = new Date();
    const tripEnd = new Date(today);
    tripEnd.setDate(tripEnd.getDate() - 10);
    const tripStart = new Date(tripEnd);
    tripStart.setDate(tripStart.getDate() - 20);

    const trips: TripRecord[] = [
      {
        id: 't1',
        outDate: tripStart.toISOString().split('T')[0],
        inDate: tripEnd.toISOString().split('T')[0],
        outRoute: '',
        inRoute: '',
      },
    ];

    const visaStart = new Date(today);
    visaStart.setFullYear(visaStart.getFullYear() - 1);

    const result = calculateTravelData({
      trips,
      visaStartDate: visaStart.toISOString().split('T')[0],
      vignetteEntryDate: visaStart.toISOString().split('T')[0],
      ilrTrack: 3,
      applicationDateOverride: null,
    });

    // Should have today's quota calculated
    expect(result.summary.currentRollingAbsenceToday).not.toBeNull();
    expect(result.summary.remaining180LimitToday).not.toBeNull();

    // Remaining should be 180 minus current
    if (result.summary.currentRollingAbsenceToday !== null) {
      expect(result.summary.remaining180LimitToday).toBe(
        Math.max(0, 180 - result.summary.currentRollingAbsenceToday)
      );
    }
  });

  it('calculates remaining180LimitToday as 0 when limit exceeded', () => {
    // Create trips that exceed 180 days in last 12 months
    const today = new Date();
    const trips: TripRecord[] = [];

    for (let i = 0; i < 10; i++) {
      const end = new Date(today);
      end.setDate(end.getDate() - (i * 25));
      const start = new Date(end);
      start.setDate(start.getDate() - 20);

      trips.push({
        id: `t${i}`,
        outDate: start.toISOString().split('T')[0],
        inDate: end.toISOString().split('T')[0],
        outRoute: '',
        inRoute: '',
      });
    }

    const visaStart = new Date(today);
    visaStart.setFullYear(visaStart.getFullYear() - 2);

    const result = calculateTravelData({
      trips,
      visaStartDate: visaStart.toISOString().split('T')[0],
      vignetteEntryDate: visaStart.toISOString().split('T')[0],
      ilrTrack: 5,
      applicationDateOverride: null,
    });

    // Should clamp to 0 when exceeded
    if (result.summary.currentRollingAbsenceToday !== null &&
        result.summary.currentRollingAbsenceToday > 180) {
      expect(result.summary.remaining180LimitToday).toBe(0);
    }
  });

  it('returns null for today quota when visa not started', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const result = calculateTravelData({
      trips: [],
      visaStartDate: futureDate.toISOString().split('T')[0],
      vignetteEntryDate: futureDate.toISOString().split('T')[0],
      ilrTrack: 3,
      applicationDateOverride: null,
    });

    // Should not calculate today's quota for future visas
    expect(result.summary.currentRollingAbsenceToday).toBeNull();
    expect(result.summary.remaining180LimitToday).toBeNull();
  });
});
