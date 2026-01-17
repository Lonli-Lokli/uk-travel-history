/**
 * Provider interface for trip storage operations
 * This interface defines the contract that all trip storage providers must implement
 */

import type {
  TripData,
  CreateTripData,
  UpdateTripData,
} from '@uth/db';

/**
 * Trip store provider interface
 * All trip storage providers must implement this interface
 */
export interface TripStoreProvider {
  /**
   * Get all trips for an identifier (user ID or session ID)
   * @param identifier User ID or session ID
   * @returns Array of trips
   */
  getTrips(identifier: string): Promise<TripData[]>;

  /**
   * Get a specific trip by ID
   * @param identifier User ID or session ID
   * @param tripId Trip ID
   * @returns Trip data or null if not found
   */
  getTripById(identifier: string, tripId: string): Promise<TripData | null>;

  /**
   * Create a new trip
   * @param identifier User ID or session ID
   * @param data Trip creation data
   * @returns Created trip
   */
  createTrip(identifier: string, data: CreateTripData): Promise<TripData>;

  /**
   * Update an existing trip
   * @param identifier User ID or session ID
   * @param tripId Trip ID
   * @param data Trip update data
   * @returns Updated trip
   */
  updateTrip(
    identifier: string,
    tripId: string,
    data: UpdateTripData,
  ): Promise<TripData>;

  /**
   * Delete a trip
   * @param identifier User ID or session ID
   * @param tripId Trip ID
   */
  deleteTrip(identifier: string, tripId: string): Promise<void>;

  /**
   * Bulk create trips (for imports)
   * @param identifier User ID or session ID
   * @param trips Array of trip creation data
   * @returns Array of created trips
   */
  bulkCreateTrips(
    identifier: string,
    trips: CreateTripData[],
  ): Promise<TripData[]>;
}
