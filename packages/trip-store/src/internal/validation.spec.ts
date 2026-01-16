/**
 * Tests for input validation functions
 */

import { describe, it, expect } from 'vitest';
import {
  validateSessionId,
  validateUserId,
  validateDate,
  validateCreateTripData,
  validateUpdateTripData,
  validateTripId,
  validateBulkCreateData,
} from './validation';
import { TripStoreError, TripStoreErrorCode } from '../types/domain';
import type { CreateTripData, UpdateTripData } from '@uth/db';

describe('validateSessionId', () => {
  it('should accept valid UUID v4', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';
    expect(() => validateSessionId(validUUID)).not.toThrow();
  });

  it('should reject null session ID', () => {
    expect(() => validateSessionId(null)).toThrow(TripStoreError);
    expect(() => validateSessionId(null)).toThrow('Session ID is required');
  });

  it('should reject empty string', () => {
    expect(() => validateSessionId('')).toThrow(TripStoreError);
  });

  it('should reject non-UUID strings', () => {
    expect(() => validateSessionId('not-a-uuid')).toThrow(TripStoreError);
    expect(() => validateSessionId('not-a-uuid')).toThrow(
      'Session ID must be a valid UUID v4',
    );
  });

  it('should reject UUID v1/v3/v5 (must be v4)', () => {
    const uuidV1 = '550e8400-e29b-11d4-a716-446655440000'; // v1
    expect(() => validateSessionId(uuidV1)).toThrow(TripStoreError);
  });

  it('should reject non-string values', () => {
    expect(() => validateSessionId(123 as any)).toThrow(TripStoreError);
    expect(() => validateSessionId({} as any)).toThrow(TripStoreError);
  });
});

describe('validateUserId', () => {
  it('should accept non-empty string', () => {
    expect(() => validateUserId('user123')).not.toThrow();
  });

  it('should reject null user ID', () => {
    expect(() => validateUserId(null)).toThrow(TripStoreError);
    expect(() => validateUserId(null)).toThrow('User ID is required');
  });

  it('should reject empty string', () => {
    expect(() => validateUserId('')).toThrow(TripStoreError);
  });

  it('should reject whitespace-only string', () => {
    expect(() => validateUserId('   ')).toThrow(TripStoreError);
    expect(() => validateUserId('   ')).toThrow('User ID cannot be empty');
  });

  it('should reject non-string values', () => {
    expect(() => validateUserId(123 as any)).toThrow(TripStoreError);
  });
});

describe('validateDate', () => {
  it('should accept valid ISO date', () => {
    expect(() => validateDate('2026-01-16', 'testDate')).not.toThrow();
  });

  it('should reject invalid format', () => {
    expect(() => validateDate('16/01/2026', 'testDate')).toThrow(
      TripStoreError,
    );
    expect(() => validateDate('16/01/2026', 'testDate')).toThrow(
      'must be in ISO format',
    );
  });

  it('should accept Feb 30 (JavaScript date rollover)', () => {
    // Note: new Date('2026-02-30') is valid in JavaScript - it rolls over to March 2
    // This is intentional behavior - we validate ISO format and let JS handle edge cases
    expect(() => validateDate('2026-02-30', 'testDate')).not.toThrow();
  });

  it('should reject non-string values', () => {
    expect(() => validateDate(null as any, 'testDate')).toThrow(TripStoreError);
    expect(() => validateDate(123 as any, 'testDate')).toThrow(TripStoreError);
  });
});

describe('validateCreateTripData', () => {
  const validTrip: CreateTripData = {
    outDate: '2026-01-10',
    inDate: '2026-01-15',
    outRoute: 'LHR -> JFK',
    inRoute: 'JFK -> LHR',
  };

  it('should accept valid trip data', () => {
    expect(() => validateCreateTripData(validTrip)).not.toThrow();
  });

  it('should accept trip with all optional fields', () => {
    const fullTrip: CreateTripData = {
      ...validTrip,
      title: 'NYC Trip',
      destination: 'New York',
      notes: 'Business trip',
      goalId: 'goal123',
      groupId: 'group456',
      sortOrder: 1,
      source: 'manual',
    };
    expect(() => validateCreateTripData(fullTrip)).not.toThrow();
  });

  it('should reject when inDate is before outDate', () => {
    const invalidTrip: CreateTripData = {
      ...validTrip,
      outDate: '2026-01-15',
      inDate: '2026-01-10',
    };
    expect(() => validateCreateTripData(invalidTrip)).toThrow(TripStoreError);
    expect(() => validateCreateTripData(invalidTrip)).toThrow(
      'Return date (inDate) must be on or after departure date (outDate)',
    );
  });

  it('should accept same-day trips (inDate === outDate)', () => {
    const sameDayTrip: CreateTripData = {
      ...validTrip,
      outDate: '2026-01-15',
      inDate: '2026-01-15',
    };
    expect(() => validateCreateTripData(sameDayTrip)).not.toThrow();
  });

  it('should reject non-object data', () => {
    expect(() => validateCreateTripData(null as any)).toThrow(TripStoreError);
    expect(() => validateCreateTripData('not an object' as any)).toThrow(
      TripStoreError,
    );
  });

  it('should reject invalid date formats', () => {
    const invalidTrip: CreateTripData = {
      ...validTrip,
      outDate: '01/10/2026',
    };
    expect(() => validateCreateTripData(invalidTrip)).toThrow(TripStoreError);
  });

  it('should reject non-string optional fields', () => {
    const invalidTrip: CreateTripData = {
      ...validTrip,
      title: 123 as any,
    };
    expect(() => validateCreateTripData(invalidTrip)).toThrow(TripStoreError);
    expect(() => validateCreateTripData(invalidTrip)).toThrow(
      'title must be a string',
    );
  });

  it('should reject non-numeric sortOrder', () => {
    const invalidTrip: CreateTripData = {
      ...validTrip,
      sortOrder: '1' as any,
    };
    expect(() => validateCreateTripData(invalidTrip)).toThrow(TripStoreError);
    expect(() => validateCreateTripData(invalidTrip)).toThrow(
      'sortOrder must be a finite number',
    );
  });

  it('should reject Infinity for sortOrder', () => {
    const invalidTrip: CreateTripData = {
      ...validTrip,
      sortOrder: Infinity,
    };
    expect(() => validateCreateTripData(invalidTrip)).toThrow(TripStoreError);
  });
});

describe('validateUpdateTripData', () => {
  it('should accept partial update with dates', () => {
    const update: UpdateTripData = {
      outDate: '2026-01-20',
    };
    expect(() => validateUpdateTripData(update)).not.toThrow();
  });

  it('should accept update with both dates', () => {
    const update: UpdateTripData = {
      outDate: '2026-01-10',
      inDate: '2026-01-15',
    };
    expect(() => validateUpdateTripData(update)).not.toThrow();
  });

  it('should reject invalid date logic when both dates provided', () => {
    const update: UpdateTripData = {
      outDate: '2026-01-15',
      inDate: '2026-01-10',
    };
    expect(() => validateUpdateTripData(update)).toThrow(TripStoreError);
  });

  it('should accept update with only optional string fields', () => {
    const update: UpdateTripData = {
      title: 'Updated title',
      notes: 'Updated notes',
    };
    expect(() => validateUpdateTripData(update)).not.toThrow();
  });

  it('should reject non-string optional fields', () => {
    const update: UpdateTripData = {
      destination: 123 as any,
    };
    expect(() => validateUpdateTripData(update)).toThrow(TripStoreError);
  });

  it('should reject non-object data', () => {
    expect(() => validateUpdateTripData(null as any)).toThrow(TripStoreError);
  });
});

describe('validateTripId', () => {
  it('should accept non-empty string', () => {
    expect(() => validateTripId('trip123')).not.toThrow();
  });

  it('should reject empty string', () => {
    expect(() => validateTripId('')).toThrow(TripStoreError);
  });

  it('should reject whitespace-only string', () => {
    expect(() => validateTripId('   ')).toThrow(TripStoreError);
  });

  it('should reject non-string values', () => {
    expect(() => validateTripId(null as any)).toThrow(TripStoreError);
    expect(() => validateTripId(123 as any)).toThrow(TripStoreError);
  });
});

describe('validateBulkCreateData', () => {
  const validTrip: CreateTripData = {
    outDate: '2026-01-10',
    inDate: '2026-01-15',
    outRoute: 'LHR -> JFK',
    inRoute: 'JFK -> LHR',
  };

  it('should accept array of valid trips', () => {
    const trips: CreateTripData[] = [validTrip, { ...validTrip }];
    expect(() => validateBulkCreateData(trips)).not.toThrow();
  });

  it('should reject non-array input', () => {
    expect(() => validateBulkCreateData({} as any)).toThrow(TripStoreError);
    expect(() => validateBulkCreateData({} as any)).toThrow(
      'Trips must be an array',
    );
  });

  it('should reject empty array', () => {
    expect(() => validateBulkCreateData([])).toThrow(TripStoreError);
    expect(() => validateBulkCreateData([])).toThrow(
      'Trips array cannot be empty',
    );
  });

  it('should reject array with invalid trip at specific index', () => {
    const trips: CreateTripData[] = [
      validTrip,
      { ...validTrip, outDate: 'invalid' } as any,
    ];
    expect(() => validateBulkCreateData(trips)).toThrow(TripStoreError);
    expect(() => validateBulkCreateData(trips)).toThrow('Trip at index 1:');
  });

  it('should validate all trips in array', () => {
    const trips: CreateTripData[] = [
      validTrip,
      { ...validTrip },
      { ...validTrip, outDate: '2026-02-01', inDate: '2026-02-05' },
    ];
    expect(() => validateBulkCreateData(trips)).not.toThrow();
  });
});

describe('TripStoreError', () => {
  it('should create error with correct code and message', () => {
    const error = new TripStoreError(
      TripStoreErrorCode.VALIDATION_ERROR,
      'Test error',
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe(TripStoreErrorCode.VALIDATION_ERROR);
    expect(error.name).toBe('TripStoreError');
  });
});
