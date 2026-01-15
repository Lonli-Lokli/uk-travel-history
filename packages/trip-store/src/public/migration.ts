/**
 * Migration utilities for moving trips from cache to Supabase
 * Used when a user upgrades from free to paid tier
 */

import type { TripData, CreateTripData } from '@uth/db';
import { getCacheAdapterDirect } from '../internal/provider-resolver';
import { SupabaseTripAdapter } from '../internal/providers/supabase-adapter';

/**
 * Migration result
 */
export interface MigrationResult {
  /** Number of trips successfully migrated */
  migrated: number;
  /** Errors encountered during migration */
  errors: string[];
  /** Whether migration completed fully */
  success: boolean;
}

/**
 * Migrate trips from cache to Supabase for a user
 * This is called when a user upgrades to a paid tier
 *
 * @param sessionId Session ID containing cached trips
 * @param userId User ID to migrate trips to
 * @returns Migration result
 */
export async function migrateTripsFromCache(
  sessionId: string,
  userId: string,
): Promise<MigrationResult> {
  const cacheAdapter = getCacheAdapterDirect();
  const supabaseAdapter = new SupabaseTripAdapter();
  const errors: string[] = [];
  let migrated = 0;

  try {
    // Get trips from cache
    const cachedTrips = await cacheAdapter.getTrips(sessionId);

    if (cachedTrips.length === 0) {
      return {
        migrated: 0,
        errors: [],
        success: true,
      };
    }

    // Convert cached trips to create data
    // Note: We use 'migration' as a pseudo-source, but the DB expects specific values
    const createData: CreateTripData[] = cachedTrips.map((trip) => ({
      goalId: trip.goalId,
      title: trip.title,
      outDate: trip.outDate,
      inDate: trip.inDate,
      outRoute: trip.outRoute,
      inRoute: trip.inRoute,
      destination: trip.destination,
      notes: trip.notes,
      groupId: trip.groupId,
      sortOrder: trip.sortOrder,
      source: trip.source,
    }));

    // Bulk create trips in Supabase
    // We create them one by one to handle partial failures
    for (const tripData of createData) {
      try {
        await supabaseAdapter.createTrip(userId, tripData);
        migrated++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to migrate trip: ${message}`);
      }
    }

    // Clear cache only if all trips were migrated successfully
    if (errors.length === 0) {
      await cacheAdapter.clearTrips(sessionId);
    }

    return {
      migrated,
      errors,
      success: errors.length === 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Migration failed: ${message}`);
    return {
      migrated,
      errors,
      success: false,
    };
  }
}

/**
 * Check if a session has trips that need migration
 * @param sessionId Session ID to check
 * @returns true if there are trips in the cache for this session
 */
export async function hasCachedTrips(sessionId: string): Promise<boolean> {
  const cacheAdapter = getCacheAdapterDirect();
  return cacheAdapter.hasTrips(sessionId);
}

/**
 * Get count of cached trips for a session
 * @param sessionId Session ID to check
 * @returns Number of cached trips
 */
export async function getCachedTripCount(sessionId: string): Promise<number> {
  const cacheAdapter = getCacheAdapterDirect();
  const trips = await cacheAdapter.getTrips(sessionId);
  return trips.length;
}

/**
 * Clear cached trips for a session (without migrating)
 * Use with caution - this deletes data
 * @param sessionId Session ID to clear
 */
export async function clearCachedTrips(sessionId: string): Promise<void> {
  const cacheAdapter = getCacheAdapterDirect();
  await cacheAdapter.clearTrips(sessionId);
}
