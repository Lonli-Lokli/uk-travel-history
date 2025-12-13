import { describe, it, expect } from 'vitest';
import { calculateTravelData, TripRecord, ILRTrack } from './calculators';

const baseInput = {
  trips: [] as TripRecord[],
  vignetteEntryDate: '',
  visaStartDate: '',
  ilrTrack: null as ILRTrack | null,
  applicationDate: '',
};

const makeInput = (overrides: Partial<typeof baseInput>) => ({
  ...baseInput,
  ...overrides,
});

describe('calculateTravelData', () => {
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

    const result = calculateTravelData(
      makeInput({ trips, visaStartDate: '2023-01-01' }),
    );

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

    const result = calculateTravelData(
      makeInput({
        trips,
        visaStartDate: '2023-01-01',
        ilrTrack: 5,
        applicationDate: '2028-01-01',
      }),
    );

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

    const result = calculateTravelData(
      makeInput({
        trips,
        visaStartDate: '2023-01-01',
        ilrTrack: 3,
        applicationDate: '2026-01-01',
      }),
    );

    expect(result.summary.totalFullDays).toBe(180);
    expect(result.summary.hasExceeded180Days).toBe(false);
  });

  it('calculates pre-entry period and qualifying start', () => {
    const result = calculateTravelData(
      makeInput({
        visaStartDate: '2023-01-01',
        vignetteEntryDate: '2023-05-31',
      }),
    );

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

    const result = calculateTravelData(
      makeInput({
        trips,
        visaStartDate: '2023-01-01',
        ilrTrack: 3,
        applicationDate: '',
      }),
    );

    expect(result.calculatedApplicationDate).not.toBeNull();
  });

  it('returns empty rolling data without a start date', () => {
    const result = calculateTravelData(
      makeInput({ trips: [], visaStartDate: '', vignetteEntryDate: '' }),
    );

    expect(result.rollingAbsenceData).toEqual([]);
    expect(result.timelinePoints).toEqual([]);
    expect(result.tripBars).toEqual([]);
  });
});
