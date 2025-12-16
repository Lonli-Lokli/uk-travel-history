import { differenceInDays, isValid, parseISO } from 'date-fns';
import { TripRecord, TripWithCalculations } from './shapes';

export const isValidDate = (date: string): boolean => {
  const dateObj = new Date(date);
  return isValid(dateObj);
};

const toMs = (d: string) => Date.parse(d + 'T00:00:00.000Z');

/** Returns true if any two trips overlap (inclusive: touching counts as overlap). */
export function hasOverlappingTrips(trips: TripRecord[]): boolean {
  const ranges = trips
    .map((t) => [toMs(t.outDate), toMs(t.inDate)] as const)
    .sort((a, b) => a[0] - b[0]);

  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i][0] <= ranges[i - 1][1]) return true;
  }
  return false;
}

export function calculateTripDurations(
  trips: TripRecord[],
): TripWithCalculations[] {
  return trips.map((trip) => {
    const isIncomplete =
      !trip.outDate ||
      !trip.inDate ||
      !isValidDate(trip.outDate) ||
      !isValidDate(trip.inDate);

    let calendarDays: number | null = null;
    let fullDays: number | null = null;

    if (!isIncomplete) {
      calendarDays = differenceInDays(
        parseISO(trip.inDate),
        parseISO(trip.outDate),
      );
      // Guidance: Exclude departure and return dates.
      fullDays = Math.max(0, calendarDays - 1);
    }

    return {
      ...trip,
      calendarDays,
      fullDays,
      isIncomplete,
    };
  });
}
