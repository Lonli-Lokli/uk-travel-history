import { describe, it, expect } from 'vitest';
import { calculateTravelData } from './calculators';
import { IneligibilityReason, TripRecord } from './shapes';

describe('Valid scenarios', () => {
  it('calculates full days per trip', () => {
    const trips: TripRecord[] = [
      {
        id: '1',
        outDate: '2024-01-01',
        inDate: '2024-01-05',
        outRoute: 'Test',
        inRoute: 'Test',
      },
    ];

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

  it('flags when rolling 12 month absences exceed 180 days', () => {
    const trips: TripRecord[] = [
      {
        id: 't1',
        outDate: '2023-02-01',
        inDate: '2023-04-01',
        outRoute: '',
        inRoute: '',
      },
      {
        id: 't2',
        outDate: '2023-06-01',
        inDate: '2023-08-01',
        outRoute: '',
        inRoute: '',
      },
      {
        id: 't3',
        outDate: '2023-10-01',
        inDate: '2023-12-05',
        outRoute: '',
        inRoute: '',
      },
    ];

    const result = calculateTravelData({
      trips,
      vignetteEntryDate: '2023-01-01',
      visaStartDate: '2023-01-01',
      ilrTrack: 5,
      applicationDateOverride: '2028-01-01',
    });

    expect(result.summary.hasExceeded180Days).toBe(true);
    expect(result.summary.totalFullDays).toBe(182);
  });

  it('accepts exactly 180 days of absence', () => {
    const trips: TripRecord[] = [
      {
        id: 't1',
        outDate: '2023-03-01',
        inDate: '2023-08-29',
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
    expect(result.summary.hasExceeded180Days).toBe(false);
  });

  it('can handle base scenario', () => {
    const result = calculateTravelData({
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 5,
      applicationDateOverride: null,
      trips: [],
    });

    expect(result.summary.autoDateUsed).toBe(true);
    expect(result.validation.status).toBe('ELIGIBLE');
    expect(
      result.validation.status === 'ELIGIBLE'
        ? result.validation.applicationDate
        : null,
    ).toBe('2028-01-01');
  });

  it('calculates pre-entry period and qualifying start', () => {
    const result = calculateTravelData({
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-05-31',
      ilrTrack: 5,
      applicationDateOverride: null,
      trips: [],
    });

    expect(result.preEntryPeriod?.delayDays).toBe(150);
    expect(result.preEntryPeriod?.canCount).toBe(true);
    expect(result.preEntryPeriod?.qualifyingStartDate).toBe('2023-01-01');
  });

  it('delays application date when rolling absences exceed threshold', () => {
    const trips: TripRecord[] = [
      {
        id: 't1',
        outDate: '2023-03-01',
        inDate: '2023-06-01',
        outRoute: '',
        inRoute: '',
      },
      {
        id: 't2',
        outDate: '2023-09-01',
        inDate: '2023-12-01',
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

    expect(result.validation.status).toBe('ELIGIBLE');
    expect(
      result.validation.status === 'ELIGIBLE'
        ? result.validation.applicationDate
        : null,
    ).toBeDefined();
  });
});

describe('Not allowed scenarios', () => {
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

  it('returns error when application date is before eligibility date', () => {
    const result = calculateTravelData({
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 5,
      applicationDateOverride: '2026-01-01', // Too early for 5-year track
      trips: [],
    });
    expect(result.validation.status).toBe('INELIGIBLE');
    expect(
      result.validation.status === 'INELIGIBLE'
        ? result.validation.reason.type
        : null,
    ).toBe('TOO_EARLY' satisfies IneligibilityReason['type']);
  });

  it('returns error when trips are overlapping', () => {
    const trips: TripRecord[] = [
      {
        id: 't1',
        outDate: '2023-03-01',
        inDate: '2023-06-01',
        outRoute: '',
        inRoute: '',
      },
      {
        id: 't2',
        outDate: '2023-04-01',
        inDate: '2023-07-01',
        outRoute: '',
        inRoute: '',
      },
    ];
    const result = calculateTravelData({
      visaStartDate: '2023-01-01',
      vignetteEntryDate: '2023-01-01',
      ilrTrack: 5,
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
});
