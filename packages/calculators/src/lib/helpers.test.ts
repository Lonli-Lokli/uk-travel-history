import { describe, it, expect } from 'vitest';
import { isValidDate, hasOverlappingTrips, calculateTripDurations } from './helpers';
import { TripRecord } from './shapes';

describe('Helpers - String-based Date Operations', () => {
  describe('isValidDate', () => {
    it('should validate ISO date strings (YYYY-MM-DD)', () => {
      expect(isValidDate('2024-01-15')).toBe(true);
      expect(isValidDate('2023-12-31')).toBe(true);
      expect(isValidDate('2024-02-29')).toBe(true); // Leap year
    });

    it('should reject invalid ISO date strings', () => {
      expect(isValidDate('2024-13-01')).toBe(false); // Invalid month
      expect(isValidDate('2024-01-32')).toBe(false); // Invalid day
      expect(isValidDate('2023-02-29')).toBe(false); // Not a leap year
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('')).toBe(false);
    });

    it('should reject non-ISO formats', () => {
      expect(isValidDate('15/01/2024')).toBe(false); // DD/MM/YYYY
      expect(isValidDate('01-15-2024')).toBe(false); // MM-DD-YYYY
      expect(isValidDate('2024/01/15')).toBe(false); // Wrong separator
    });

    it('should handle edge cases', () => {
      expect(isValidDate('2024-02-29')).toBe(true); // Valid leap year
      expect(isValidDate('2024-02-30')).toBe(false); // Invalid date
      expect(isValidDate('2024-00-01')).toBe(false); // Invalid month
      expect(isValidDate('2024-01-00')).toBe(false); // Invalid day
    });

    it('should reject non-string inputs', () => {
      expect(isValidDate(null as any)).toBe(false);
      expect(isValidDate(undefined as any)).toBe(false);
      expect(isValidDate(123 as any)).toBe(false);
      expect(isValidDate({} as any)).toBe(false);
    });

    it('should handle dates at boundaries', () => {
      expect(isValidDate('2024-01-01')).toBe(true);
      expect(isValidDate('2024-12-31')).toBe(true);
      expect(isValidDate('2000-01-01')).toBe(true);
      expect(isValidDate('2099-12-31')).toBe(true);
    });
  });

  describe('hasOverlappingTrips', () => {
    it('should detect overlapping trips using ISO strings', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2024-01-01', inDate: '2024-01-10', outRoute: '', inRoute: '' },
        { id: '2', outDate: '2024-01-05', inDate: '2024-01-15', outRoute: '', inRoute: '' },
      ];

      expect(hasOverlappingTrips(trips)).toBe(true);
    });

    it('should not detect overlapping for adjacent trips', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2024-01-01', inDate: '2024-01-10', outRoute: '', inRoute: '' },
        { id: '2', outDate: '2024-01-11', inDate: '2024-01-20', outRoute: '', inRoute: '' },
      ];

      expect(hasOverlappingTrips(trips)).toBe(false);
    });

    it('should detect touching trips as overlap', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2024-01-01', inDate: '2024-01-10', outRoute: '', inRoute: '' },
        { id: '2', outDate: '2024-01-10', inDate: '2024-01-20', outRoute: '', inRoute: '' },
      ];

      expect(hasOverlappingTrips(trips)).toBe(true);
    });

    it('should handle trips spanning year boundaries', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2023-12-20', inDate: '2024-01-05', outRoute: '', inRoute: '' },
        { id: '2', outDate: '2024-01-01', inDate: '2024-01-10', outRoute: '', inRoute: '' },
      ];

      expect(hasOverlappingTrips(trips)).toBe(true);
    });

    it('should handle multiple non-overlapping trips', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2024-01-01', inDate: '2024-01-05', outRoute: '', inRoute: '' },
        { id: '2', outDate: '2024-02-01', inDate: '2024-02-05', outRoute: '', inRoute: '' },
        { id: '3', outDate: '2024-03-01', inDate: '2024-03-05', outRoute: '', inRoute: '' },
      ];

      expect(hasOverlappingTrips(trips)).toBe(false);
    });

    it('should handle empty trip list', () => {
      expect(hasOverlappingTrips([])).toBe(false);
    });

    it('should handle single trip', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2024-01-01', inDate: '2024-01-10', outRoute: '', inRoute: '' },
      ];

      expect(hasOverlappingTrips(trips)).toBe(false);
    });
  });

  describe('calculateTripDurations', () => {
    it('should calculate durations using ISO date strings', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2024-01-01', inDate: '2024-01-05', outRoute: '', inRoute: '' },
      ];

      const result = calculateTripDurations(trips);

      expect(result[0].calendarDays).toBe(4);
      expect(result[0].fullDays).toBe(3); // Excluding departure and return
    });

    it('should handle same-day trips', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2024-01-01', inDate: '2024-01-01', outRoute: '', inRoute: '' },
      ];

      const result = calculateTripDurations(trips);

      expect(result[0].calendarDays).toBe(0);
      expect(result[0].fullDays).toBe(0);
    });

    it('should handle next-day trips', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2024-01-01', inDate: '2024-01-02', outRoute: '', inRoute: '' },
      ];

      const result = calculateTripDurations(trips);

      expect(result[0].calendarDays).toBe(1);
      expect(result[0].fullDays).toBe(0); // No full days between
    });

    it('should handle trips spanning year boundaries', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2023-12-20', inDate: '2024-01-05', outRoute: '', inRoute: '' },
      ];

      const result = calculateTripDurations(trips);

      // Dec 20 to Jan 5 = 16 calendar days, 15 full days
      expect(result[0].calendarDays).toBe(16);
      expect(result[0].fullDays).toBe(15);
    });

    it('should handle leap year dates', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2024-02-28', inDate: '2024-03-01', outRoute: '', inRoute: '' },
      ];

      const result = calculateTripDurations(trips);

      // Feb 28 to Mar 1 (2024 is leap year) = 2 calendar days, 1 full day (Feb 29)
      expect(result[0].calendarDays).toBe(2);
      expect(result[0].fullDays).toBe(1);
    });

    it('should mark incomplete trips (missing dates)', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2024-01-01', inDate: '', outRoute: '', inRoute: '' },
        { id: '2', outDate: '', inDate: '2024-01-10', outRoute: '', inRoute: '' },
      ];

      const result = calculateTripDurations(trips);

      expect(result[0].isIncomplete).toBe(true);
      expect(result[0].calendarDays).toBeNull();
      expect(result[0].fullDays).toBeNull();

      expect(result[1].isIncomplete).toBe(true);
      expect(result[1].calendarDays).toBeNull();
      expect(result[1].fullDays).toBeNull();
    });

    it('should mark incomplete trips (invalid dates)', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: 'invalid', inDate: '2024-01-10', outRoute: '', inRoute: '' },
        { id: '2', outDate: '2024-01-01', inDate: 'invalid', outRoute: '', inRoute: '' },
      ];

      const result = calculateTripDurations(trips);

      expect(result[0].isIncomplete).toBe(true);
      expect(result[1].isIncomplete).toBe(true);
    });

    it('should handle multiple trips with mixed completeness', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2024-01-01', inDate: '2024-01-05', outRoute: '', inRoute: '' },
        { id: '2', outDate: '2024-02-01', inDate: '', outRoute: '', inRoute: '' },
        { id: '3', outDate: '2024-03-01', inDate: '2024-03-10', outRoute: '', inRoute: '' },
      ];

      const result = calculateTripDurations(trips);

      expect(result[0].isIncomplete).toBe(false);
      expect(result[0].fullDays).toBe(3);

      expect(result[1].isIncomplete).toBe(true);
      expect(result[1].fullDays).toBeNull();

      expect(result[2].isIncomplete).toBe(false);
      expect(result[2].fullDays).toBe(8);
    });

    it('should preserve original trip data', () => {
      const trips: TripRecord[] = [
        { id: 'trip1', outDate: '2024-01-01', inDate: '2024-01-05', outRoute: 'LHR', inRoute: 'CDG' },
      ];

      const result = calculateTripDurations(trips);

      expect(result[0].id).toBe('trip1');
      expect(result[0].outDate).toBe('2024-01-01');
      expect(result[0].inDate).toBe('2024-01-05');
      expect(result[0].outRoute).toBe('LHR');
      expect(result[0].inRoute).toBe('CDG');
    });
  });

  describe('Performance with String Operations', () => {
    it('should handle large number of trips efficiently', () => {
      const trips: TripRecord[] = [];
      for (let i = 1; i <= 1000; i++) {
        const day = String(i % 28 + 1).padStart(2, '0');
        trips.push({
          id: `trip-${i}`,
          outDate: `2024-01-${day}`,
          inDate: `2024-01-${day}`,
          outRoute: 'Test',
          inRoute: 'Test',
        });
      }

      const start = Date.now();
      const result = calculateTripDurations(trips);
      const duration = Date.now() - start;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });

  describe('Timezone Independence', () => {
    it('should produce consistent results with ISO strings', () => {
      const trips: TripRecord[] = [
        { id: '1', outDate: '2024-01-01', inDate: '2024-01-05', outRoute: '', inRoute: '' },
      ];

      // Calculate multiple times
      const result1 = calculateTripDurations(trips);
      const result2 = calculateTripDurations(trips);
      const result3 = calculateTripDurations(trips);

      // All results should be identical
      expect(result1[0].calendarDays).toBe(result2[0].calendarDays);
      expect(result2[0].calendarDays).toBe(result3[0].calendarDays);
      expect(result1[0].fullDays).toBe(result2[0].fullDays);
      expect(result2[0].fullDays).toBe(result3[0].fullDays);

      // Values should be correct
      expect(result1[0].calendarDays).toBe(4);
      expect(result1[0].fullDays).toBe(3);
    });
  });
});
