/**
 * Migration utilities for moving trips from cache to Supabase
 * Used when a user upgrades from free to paid tier
 */

import type { TripData, CreateTripData } from '@uth/db';
import { getCacheAdapterDirect } from '../internal/provider-resolver';
import { SupabaseTripAdapter } from '../internal/providers/supabase-adapter';
import { setIfNotExists, deleteKey } from '@uth/cache';
import { logger } from '@uth/utils';

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
  /** Whether migration was skipped because another process is already migrating */
  skipped?: boolean;
}

/**
 * Migrate trips from cache to Supabase for a user
 * This is called when a user upgrades to a paid tier
 *
 * Uses a distributed lock to prevent concurrent migrations of the same session.
 * If another process is already migrating this session, returns immediately with skipped=true.
 *
 * @param sessionId Session ID containing cached trips
 * @param userId User ID to migrate trips to
 * @returns Migration result
 */
export async function migrateTripsFromCache(
  sessionId: string,
  userId: string,
): Promise<MigrationResult> {
  const lockKey = `migration:lock:${sessionId}`;
  const lockTTL = 30; // Lock expires after 30 seconds
  const cacheAdapter = getCacheAdapterDirect();
  const supabaseAdapter = new SupabaseTripAdapter();
  const errors: string[] = [];
  let migrated = 0;

  try {
    // Try to acquire lock
    const lockAcquired = await acquireLock(lockKey, lockTTL);
    if (!lockAcquired) {
      // Another process is already migrating this session
      return {
        migrated: 0,
        errors: [],
        success: true,
        skipped: true,
      };
    }

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
          logger.error('Failed to migrate individual trip', {
            extra: { userId, sessionId, error: message },
          });
        }
      }

      // Clear cache after migration attempt
      // CRITICAL DECISION: We clear cache even on partial failures to prevent data duplication
      // Rationale:
      // - If we keep cache on failure, users may see duplicate trips (some in cache, some in DB)
      // - Partial migrations are rare (individual trip validation errors)
      // - Complete failures (all trips fail) are also rare (DB connection issues, auth failures)
      // - Clearing ensures users always see a consistent state from Supabase
      // - For complete failures, users can re-upload/re-enter data (ephemeral data by design)
      if (migrated > 0 || cachedTrips.length > 0) {
        await cacheAdapter.clearTrips(sessionId);
        logger.info('Cleared cache after migration attempt', {
          extra: { sessionId, migrated, total: cachedTrips.length, errors: errors.length },
        });
      }

      return {
        migrated,
        errors,
        success: errors.length === 0,
      };
    } finally {
      // Always release lock, even if migration fails
      await releaseLock(lockKey);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Migration failed: ${message}`);
    // Ensure lock is released on critical error
    try {
      await releaseLock(lockKey);
    } catch {
      // Ignore lock release errors - lock will auto-expire
    }
    return {
      migrated,
      errors,
      success: false,
    };
  }
}

/**
 * Acquire a distributed lock using atomic SET NX (set if not exists)
 * This is now a single atomic operation to prevent race conditions
 * @param lockKey Lock key
 * @param ttl Lock TTL in seconds
 * @returns true if lock was acquired, false otherwise
 */
async function acquireLock(lockKey: string, ttl: number): Promise<boolean> {
  try {
    // Use atomic SET NX operation - this is a single Redis command
    // Returns true if lock was set, false if it already existed
    return await setIfNotExists(lockKey, 'locked', { ttl });
  } catch (error) {
    // On error, fail-safe: don't acquire lock
    logger.error('Failed to acquire migration lock', {
      extra: { lockKey, error: (error as Error).message },
    });
    return false;
  }
}

/**
 * Release a distributed lock
 * @param lockKey Lock key
 */
async function releaseLock(lockKey: string): Promise<void> {
  try {
    await deleteKey(lockKey);
  } catch (error) {
    // Log but don't throw - lock will auto-expire anyway
    logger.warn('Failed to release migration lock', {
      extra: { lockKey, error: (error as Error).message },
    });
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
