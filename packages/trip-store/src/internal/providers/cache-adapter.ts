/**
 * Cache adapter for trip storage
 * Uses @uth/cache for ephemeral storage with TTL
 */

import type { TripStoreProvider } from './interface';
import type {
  TripData,
  CreateTripData,
  UpdateTripData,
} from '@uth/db';
import { get, set, deleteKey, exists } from '@uth/cache';
import { TripStoreError, TripStoreErrorCode } from '../../types/domain';
import { getEndOfDayTTLSeconds } from '../session-manager';

const TRIPS_NAMESPACE = 'trips:session';

/**
 * Build cache key for a session's trips
 */
function buildCacheKey(sessionId: string): string {
  return `${TRIPS_NAMESPACE}:${sessionId}`;
}

/**
 * Generate a unique trip ID
 */
function generateTripId(): string {
  return crypto.randomUUID();
}

/**
 * Get current ISO timestamp
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Cache implementation of the trip store provider
 * Stores trips as JSON array with TTL expiring at end of day
 */
export class CacheTripAdapter implements TripStoreProvider {
  async getTrips(sessionId: string): Promise<TripData[]> {
    try {
      const key = buildCacheKey(sessionId);
      const trips = await get<TripData[]>(key);
      return trips ?? [];
    } catch (error) {
      // Fail open for cache reads - return empty array
      console.warn(`Failed to get trips from cache for session ${sessionId}:`, error);
      return [];
    }
  }

  async getTripById(sessionId: string, tripId: string): Promise<TripData | null> {
    try {
      const trips = await this.getTrips(sessionId);
      return trips.find((t) => t.id === tripId) ?? null;
    } catch (error) {
      throw new TripStoreError(
        TripStoreErrorCode.PROVIDER_ERROR,
        `Failed to get trip ${tripId} from cache`,
        error,
      );
    }
  }

  async createTrip(sessionId: string, data: CreateTripData): Promise<TripData> {
    try {
      const trips = await this.getTrips(sessionId);
      const now = getCurrentTimestamp();

      const newTrip: TripData = {
        id: generateTripId(),
        userId: sessionId, // Use session ID as pseudo-user ID
        goalId: data.goalId ?? null,
        title: data.title ?? null,
        outDate: data.outDate,
        inDate: data.inDate,
        outRoute: data.outRoute ?? null,
        inRoute: data.inRoute ?? null,
        destination: data.destination ?? null,
        notes: data.notes ?? null,
        groupId: data.groupId ?? null,
        sortOrder: data.sortOrder ?? trips.length,
        source: data.source ?? 'manual',
        createdAt: now,
        updatedAt: now,
      };

      trips.push(newTrip);
      await this.saveTrips(sessionId, trips);

      return newTrip;
    } catch (error) {
      throw new TripStoreError(
        TripStoreErrorCode.PROVIDER_ERROR,
        `Failed to create trip in cache for session ${sessionId}`,
        error,
      );
    }
  }

  async updateTrip(
    sessionId: string,
    tripId: string,
    data: UpdateTripData,
  ): Promise<TripData> {
    try {
      const trips = await this.getTrips(sessionId);
      const tripIndex = trips.findIndex((t) => t.id === tripId);

      if (tripIndex === -1) {
        throw new TripStoreError(
          TripStoreErrorCode.NOT_FOUND,
          `Trip ${tripId} not found in cache`,
        );
      }

      const updatedTrip: TripData = {
        ...trips[tripIndex],
        ...data,
        updatedAt: getCurrentTimestamp(),
      };

      trips[tripIndex] = updatedTrip;
      await this.saveTrips(sessionId, trips);

      return updatedTrip;
    } catch (error) {
      if (error instanceof TripStoreError) {
        throw error;
      }
      throw new TripStoreError(
        TripStoreErrorCode.PROVIDER_ERROR,
        `Failed to update trip ${tripId} in cache`,
        error,
      );
    }
  }

  async deleteTrip(sessionId: string, tripId: string): Promise<void> {
    try {
      const trips = await this.getTrips(sessionId);
      const filteredTrips = trips.filter((t) => t.id !== tripId);

      if (filteredTrips.length === trips.length) {
        // Trip wasn't found, but we don't need to error - idempotent delete
        return;
      }

      await this.saveTrips(sessionId, filteredTrips);
    } catch (error) {
      throw new TripStoreError(
        TripStoreErrorCode.PROVIDER_ERROR,
        `Failed to delete trip ${tripId} from cache`,
        error,
      );
    }
  }

  async bulkCreateTrips(
    sessionId: string,
    tripsData: CreateTripData[],
  ): Promise<TripData[]> {
    try {
      const existingTrips = await this.getTrips(sessionId);
      const now = getCurrentTimestamp();
      let sortOrder = existingTrips.length;

      const newTrips: TripData[] = tripsData.map((data) => ({
        id: generateTripId(),
        userId: sessionId,
        goalId: data.goalId ?? null,
        title: data.title ?? null,
        outDate: data.outDate,
        inDate: data.inDate,
        outRoute: data.outRoute ?? null,
        inRoute: data.inRoute ?? null,
        destination: data.destination ?? null,
        notes: data.notes ?? null,
        groupId: data.groupId ?? null,
        sortOrder: data.sortOrder ?? sortOrder++,
        source: data.source ?? 'manual',
        createdAt: now,
        updatedAt: now,
      }));

      const allTrips = [...existingTrips, ...newTrips];
      await this.saveTrips(sessionId, allTrips);

      return newTrips;
    } catch (error) {
      throw new TripStoreError(
        TripStoreErrorCode.PROVIDER_ERROR,
        `Failed to bulk create trips in cache for session ${sessionId}`,
        error,
      );
    }
  }

  /**
   * Save trips to cache with TTL
   */
  private async saveTrips(sessionId: string, trips: TripData[]): Promise<void> {
    const key = buildCacheKey(sessionId);
    const ttl = getEndOfDayTTLSeconds();
    await set(key, trips, { ttl });
  }

  /**
   * Check if a session has any trips
   */
  async hasTrips(sessionId: string): Promise<boolean> {
    const key = buildCacheKey(sessionId);
    return exists(key);
  }

  /**
   * Clear all trips for a session (used during migration)
   */
  async clearTrips(sessionId: string): Promise<void> {
    const key = buildCacheKey(sessionId);
    await deleteKey(key);
  }
}
