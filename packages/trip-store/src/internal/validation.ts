/**
 * Input validation utilities for trip store operations
 * Validates session IDs, trip data, and other inputs to prevent security issues
 */

import type { CreateTripData, UpdateTripData } from '@uth/db';
import { TripStoreError, TripStoreErrorCode } from '../types/domain';

/**
 * UUID v4 regex pattern
 * Validates that a session ID is a valid UUID v4
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * ISO date format regex (YYYY-MM-DD)
 */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate that a session ID is a valid UUID v4
 * @param sessionId Session ID to validate
 * @throws TripStoreError if session ID is invalid
 */
export function validateSessionId(sessionId: string | null): void {
  if (!sessionId) {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'Session ID is required',
    );
  }

  if (typeof sessionId !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'Session ID must be a string',
    );
  }

  if (!UUID_V4_REGEX.test(sessionId)) {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'Session ID must be a valid UUID v4',
    );
  }
}

/**
 * Validate that a user ID is non-empty
 * @param userId User ID to validate
 * @throws TripStoreError if user ID is invalid
 */
export function validateUserId(userId: string | null): void {
  if (!userId) {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'User ID is required',
    );
  }

  if (typeof userId !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'User ID must be a string',
    );
  }

  if (userId.trim().length === 0) {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'User ID cannot be empty',
    );
  }
}

/**
 * Validate a date string (must be in ISO format YYYY-MM-DD)
 * @param date Date string to validate
 * @param fieldName Name of the field being validated (for error messages)
 * @throws TripStoreError if date is invalid
 */
export function validateDate(date: string, fieldName: string): void {
  if (!date || typeof date !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      `${fieldName} must be a non-empty string`,
    );
  }

  if (!ISO_DATE_REGEX.test(date)) {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      `${fieldName} must be in ISO format (YYYY-MM-DD)`,
    );
  }

  // Validate that the date is actually valid (not Feb 30, etc.)
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      `${fieldName} is not a valid date`,
    );
  }
}

/**
 * Validate trip creation data
 * @param data Trip creation data to validate
 * @throws TripStoreError if data is invalid
 */
export function validateCreateTripData(data: CreateTripData): void {
  if (!data || typeof data !== 'object') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'Trip data must be an object',
    );
  }

  // Validate required date fields
  validateDate(data.outDate, 'outDate');
  validateDate(data.inDate, 'inDate');

  // Validate date logic: inDate must be > outDate (same-day trips are invalid)
  // This aligns with UK immigration rules where only full days outside UK count
  const outDate = new Date(data.outDate);
  const inDate = new Date(data.inDate);

  if (inDate <= outDate) {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'Return date (inDate) must be after departure date (outDate). Same-day trips are invalid.',
    );
  }

  // Validate optional string fields (if present, must be strings)
  if (data.outRoute !== undefined && typeof data.outRoute !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'outRoute must be a string',
    );
  }

  if (data.inRoute !== undefined && typeof data.inRoute !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'inRoute must be a string',
    );
  }

  if (data.title !== undefined && typeof data.title !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'title must be a string',
    );
  }

  if (data.destination !== undefined && typeof data.destination !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'destination must be a string',
    );
  }

  if (data.notes !== undefined && typeof data.notes !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'notes must be a string',
    );
  }

  // Validate optional ID fields (if present, must be strings)
  if (data.goalId !== undefined && typeof data.goalId !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'goalId must be a string',
    );
  }

  if (data.groupId !== undefined && typeof data.groupId !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'groupId must be a string',
    );
  }

  // Validate optional numeric fields
  if (
    data.sortOrder !== undefined &&
    (typeof data.sortOrder !== 'number' || !Number.isFinite(data.sortOrder))
  ) {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'sortOrder must be a finite number',
    );
  }
}

/**
 * Validate trip update data
 * @param data Trip update data to validate
 * @throws TripStoreError if data is invalid
 */
export function validateUpdateTripData(data: UpdateTripData): void {
  if (!data || typeof data !== 'object') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'Trip data must be an object',
    );
  }

  // Validate date fields if present
  if (data.outDate !== undefined) {
    validateDate(data.outDate, 'outDate');
  }

  if (data.inDate !== undefined) {
    validateDate(data.inDate, 'inDate');
  }

  // Validate date logic if both dates are provided
  // Same-day trips are invalid (aligns with UK immigration rules)
  if (data.outDate && data.inDate) {
    const outDate = new Date(data.outDate);
    const inDate = new Date(data.inDate);

    if (inDate <= outDate) {
      throw new TripStoreError(
        TripStoreErrorCode.VALIDATION_ERROR,
        'Return date (inDate) must be after departure date (outDate). Same-day trips are invalid.',
      );
    }
  }

  // Validate optional string fields (same as create)
  if (data.outRoute !== undefined && typeof data.outRoute !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'outRoute must be a string',
    );
  }

  if (data.inRoute !== undefined && typeof data.inRoute !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'inRoute must be a string',
    );
  }

  if (data.title !== undefined && typeof data.title !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'title must be a string',
    );
  }

  if (data.destination !== undefined && typeof data.destination !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'destination must be a string',
    );
  }

  if (data.notes !== undefined && typeof data.notes !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'notes must be a string',
    );
  }

  // Note: goalId and groupId validation removed as they don't exist in TripData type

  // Validate optional numeric fields
  if (
    data.sortOrder !== undefined &&
    (typeof data.sortOrder !== 'number' || !Number.isFinite(data.sortOrder))
  ) {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'sortOrder must be a finite number',
    );
  }
}

/**
 * Validate trip ID
 * @param tripId Trip ID to validate
 * @throws TripStoreError if trip ID is invalid
 */
export function validateTripId(tripId: string): void {
  if (!tripId || typeof tripId !== 'string') {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'Trip ID must be a non-empty string',
    );
  }

  if (tripId.trim().length === 0) {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'Trip ID cannot be empty',
    );
  }
}

/**
 * Validate bulk create data (array of trip creation data)
 * @param trips Array of trip creation data
 * @throws TripStoreError if any trip is invalid
 */
export function validateBulkCreateData(trips: CreateTripData[]): void {
  if (!Array.isArray(trips)) {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'Trips must be an array',
    );
  }

  if (trips.length === 0) {
    throw new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'Trips array cannot be empty',
    );
  }

  // Validate each trip
  for (let i = 0; i < trips.length; i++) {
    try {
      validateCreateTripData(trips[i]);
    } catch (error) {
      if (error instanceof TripStoreError) {
        throw new TripStoreError(
          TripStoreErrorCode.VALIDATION_ERROR,
          `Trip at index ${i}: ${error.message}`,
        );
      }
      throw error;
    }
  }
}
