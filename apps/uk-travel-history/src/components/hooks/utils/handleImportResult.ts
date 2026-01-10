import type { TripData } from '@uth/db';

/**
 * Shared utility for handling import results with tier-based persistence.
 *
 * For paid users (multi-goal tracking):
 * - Trips are already saved to DB by server
 * - Updates local tripsStore with saved trips using proper MobX action
 *
 * For free users:
 * - Trips are not saved to DB
 * - Hydrates trips in-memory via legacy travelStore
 *
 * @param result - The import result from server endpoint
 * @param result.trips - Array of trips (with DB IDs for paid users, without for free users)
 * @param result.metadata - Metadata about the import (includes `saved` flag)
 * @param additionalData - Optional additional data (visa details, etc.)
 * @returns Number of trips imported
 */
export async function handleImportResult(
  result: {
    trips: TripData[];
    metadata?: {
      saved?: boolean;
      tripCount?: number;
    };
  },
  additionalData?: {
    vignetteEntryDate?: string;
    visaStartDate?: string;
    ilrTrack?: 2 | 3 | 5 | 10;
  }
): Promise<number> {
  const trips = result.trips;

  // For paid users, trips are already saved to DB by server
  if (result.metadata?.saved) {
    // Lazy-load stores to avoid module boundary violation
    const { tripsStore } = await import('@uth/stores');
    // Update local store with saved trips using proper MobX action
    tripsStore.addTrips(trips);
    return trips.length;
  }

  // For free users, hydrate trips in-memory (legacy travelStore)
  const { travelStore } = await import('@uth/stores');

  const tripData = trips
    .map(
      (trip) =>
        `${trip.outDate},${trip.inDate},${trip.outRoute || ''},${trip.inRoute || ''}`
    )
    .join('\n');

  const csvText = `Date Out,Date In,Departure,Return\n${tripData}`;
  await travelStore.importFromCsv(csvText, 'append');

  // Also update visa details if present (legacy travelStore)
  if (additionalData?.vignetteEntryDate) {
    travelStore.setVignetteEntryDate(additionalData.vignetteEntryDate);
  }
  if (additionalData?.visaStartDate) {
    travelStore.setVisaStartDate(additionalData.visaStartDate);
  }
  if (additionalData?.ilrTrack) {
    travelStore.setILRTrack(additionalData.ilrTrack);
  }

  return trips.length;
}
