/**
 * Trips Store - Manages trip data using MobX
 *
 * This store handles:
 * - Loading trips from the server
 * - Creating, updating, and deleting trips
 * - Filtering trips by goal
 * - Trip statistics and calculations
 */

import { makeAutoObservable, runInAction } from 'mobx';
import type { TripData, CreateTripData, UpdateTripData } from '@uth/db';

export class TripsStore {
  trips: TripData[] = [];
  isLoading = false;
  error: string | null = null;
  isHydrated = false;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Hydrate store with server-loaded data
   * This is called from Providers.tsx with data from AccessContext
   */
  hydrate(trips: TripData[] | null) {
    this.trips = trips || [];
    this.isHydrated = true;
  }

  /**
   * Create a new trip
   */
  async createTrip(tripData: CreateTripData): Promise<TripData | null> {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      });

      if (!response.ok) {
        throw new Error('Failed to create trip');
      }

      const data = await response.json();

      runInAction(() => {
        this.trips.push(data.trip);
        this.isLoading = false;
      });

      return data.trip;
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : 'Failed to create trip';
        this.isLoading = false;
      });
      return null;
    }
  }

  /**
   * Update an existing trip
   */
  async updateTrip(
    tripId: string,
    updates: UpdateTripData,
  ): Promise<TripData | null> {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update trip');
      }

      const data = await response.json();

      runInAction(() => {
        const index = this.trips.findIndex((t) => t.id === tripId);
        if (index !== -1) {
          this.trips[index] = data.trip;
        }
        this.isLoading = false;
      });

      return data.trip;
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : 'Failed to update trip';
        this.isLoading = false;
      });
      return null;
    }
  }

  /**
   * Delete a trip
   */
  async deleteTrip(tripId: string): Promise<boolean> {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete trip');
      }

      runInAction(() => {
        this.trips = this.trips.filter((t) => t.id !== tripId);
        this.isLoading = false;
      });

      return true;
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : 'Failed to delete trip';
        this.isLoading = false;
      });
      return false;
    }
  }

  /**
   * Bulk create trips (for imports)
   * @deprecated Use server-side import endpoints instead (e.g., /api/import/csv)
   * This method is kept for backward compatibility but should not be used directly.
   * Import endpoints now handle persistence automatically based on user tier.
   */
  async bulkCreateTrips(
    goalId: string,
    trips: Array<{
      outDate: string;
      inDate: string;
      outRoute?: string;
      inRoute?: string;
    }>,
  ): Promise<TripData[]> {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch('/api/trips/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId,
          trips,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to bulk create trips');
      }

      const data = await response.json();

      runInAction(() => {
        this.trips = [...this.trips, ...data.trips];
        this.isLoading = false;
      });

      return data.trips;
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : 'Failed to bulk create trips';
        this.isLoading = false;
      });
      throw error;
    }
  }

  /**
   * Get trips for a specific goal
   */
  getTripsForGoal(goalId: string): TripData[] {
    return this.trips.filter((t) => t.goalId === goalId);
  }

  /**
   * Calculate total days away
   */
  get totalDaysAway(): number {
    return this.trips.reduce((total, trip) => {
      const outDate = new Date(trip.outDate);
      const inDate = new Date(trip.inDate);
      const days = Math.floor(
        (inDate.getTime() - outDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return total + Math.max(0, days - 1); // Full days calculation
    }, 0);
  }

  /**
   * Get total number of trips
   */
  get totalTrips(): number {
    return this.trips.length;
  }

  /**
   * Add multiple trips to the store (for import operations)
   * This is a proper MobX action for batch updates
   */
  addTrips(trips: TripData[]) {
    this.trips.push(...trips);
  }

  /**
   * Clear all trips (useful for testing)
   */
  clearTrips() {
    this.trips = [];
  }
}

// Singleton instance
export const tripsStore = new TripsStore();
