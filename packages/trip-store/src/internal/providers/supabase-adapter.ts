/**
 * Supabase adapter for trip storage
 * Wraps @uth/db operations for persistent storage
 */

import type { TripStoreProvider } from './interface';
import type {
  TripData,
  CreateTripData,
  UpdateTripData,
} from '@uth/db';
import {
  getTrips as dbGetTrips,
  getTripById as dbGetTripById,
  createTrip as dbCreateTrip,
  updateTrip as dbUpdateTrip,
  deleteTrip as dbDeleteTrip,
  bulkCreateTrips as dbBulkCreateTrips,
} from '@uth/db';
import { TripStoreError, TripStoreErrorCode } from '../../types/domain';

/**
 * Supabase implementation of the trip store provider
 * Uses @uth/db for persistent storage with RLS
 */
export class SupabaseTripAdapter implements TripStoreProvider {
  async getTrips(userId: string): Promise<TripData[]> {
    try {
      return await dbGetTrips(userId);
    } catch (error) {
      throw new TripStoreError(
        TripStoreErrorCode.PROVIDER_ERROR,
        `Failed to get trips for user ${userId}`,
        error,
      );
    }
  }

  async getTripById(userId: string, tripId: string): Promise<TripData | null> {
    try {
      return await dbGetTripById(tripId);
    } catch (error) {
      throw new TripStoreError(
        TripStoreErrorCode.PROVIDER_ERROR,
        `Failed to get trip ${tripId}`,
        error,
      );
    }
  }

  async createTrip(userId: string, data: CreateTripData): Promise<TripData> {
    try {
      return await dbCreateTrip(userId, data);
    } catch (error) {
      throw new TripStoreError(
        TripStoreErrorCode.PROVIDER_ERROR,
        `Failed to create trip for user ${userId}`,
        error,
      );
    }
  }

  async updateTrip(
    userId: string,
    tripId: string,
    data: UpdateTripData,
  ): Promise<TripData> {
    try {
      return await dbUpdateTrip(tripId, data);
    } catch (error) {
      throw new TripStoreError(
        TripStoreErrorCode.PROVIDER_ERROR,
        `Failed to update trip ${tripId}`,
        error,
      );
    }
  }

  async deleteTrip(userId: string, tripId: string): Promise<void> {
    try {
      await dbDeleteTrip(tripId);
    } catch (error) {
      throw new TripStoreError(
        TripStoreErrorCode.PROVIDER_ERROR,
        `Failed to delete trip ${tripId}`,
        error,
      );
    }
  }

  async bulkCreateTrips(
    userId: string,
    trips: CreateTripData[],
  ): Promise<TripData[]> {
    try {
      // Note: dbBulkCreateTrips expects goalId, but for migration we may not have one
      // Create trips individually if no goalId is provided
      const results: TripData[] = [];
      for (const tripData of trips) {
        const trip = await dbCreateTrip(userId, tripData);
        results.push(trip);
      }
      return results;
    } catch (error) {
      throw new TripStoreError(
        TripStoreErrorCode.PROVIDER_ERROR,
        `Failed to bulk create trips for user ${userId}`,
        error,
      );
    }
  }
}
