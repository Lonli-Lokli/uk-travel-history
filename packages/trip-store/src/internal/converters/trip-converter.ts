/**
 * Type converters between domain types and database types for trips
 * Handles conversion of Date objects <-> ISO strings
 */

import type { TripData, CreateTripData, UpdateTripData } from '@uth/db';
import type {
  Trip,
  CreateTripInput,
  UpdateTripInput,
} from '../../types/trip-domain';

/**
 * Convert database trip to domain trip
 * Converts Date objects to ISO strings
 */
export function tripFromDb(dbTrip: TripData): Trip {
  return {
    id: dbTrip.id,
    userId: dbTrip.userId,
    goalId: dbTrip.goalId,
    title: dbTrip.title,
    outDate: dbTrip.outDate, // Already ISO string in DB
    inDate: dbTrip.inDate, // Already ISO string in DB
    outRoute: dbTrip.outRoute,
    inRoute: dbTrip.inRoute,
    destination: dbTrip.destination,
    notes: dbTrip.notes,
    groupId: dbTrip.groupId,
    sortOrder: dbTrip.sortOrder,
    source: dbTrip.source,
    createdAt: dbTrip.createdAt, // Already ISO string in DB
    updatedAt: dbTrip.updatedAt, // Already ISO string in DB
  };
}

/**
 * Convert domain trip to database trip
 * Converts ISO strings to Date objects (if needed by DB layer)
 */
export function tripToDb(trip: Trip): TripData {
  return {
    id: trip.id,
    userId: trip.userId,
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
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

/**
 * Convert domain create input to DB create data
 */
export function createTripInputToDb(input: CreateTripInput): CreateTripData {
  return {
    goalId: input.goalId,
    title: input.title,
    outDate: input.outDate,
    inDate: input.inDate,
    outRoute: input.outRoute,
    inRoute: input.inRoute,
    destination: input.destination,
    notes: input.notes,
    groupId: input.groupId,
    sortOrder: input.sortOrder,
    source: input.source,
  };
}

/**
 * Convert domain update input to DB update data
 */
export function updateTripInputToDb(input: UpdateTripInput): UpdateTripData {
  return {
    title: input.title,
    outDate: input.outDate,
    inDate: input.inDate,
    outRoute: input.outRoute,
    inRoute: input.inRoute,
    destination: input.destination,
    notes: input.notes,
    groupId: input.groupId,
    sortOrder: input.sortOrder,
  };
}
