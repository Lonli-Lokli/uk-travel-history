import { describe, it, expect } from 'vitest';
import { parseDate, parseTravelRecords, pairTrips, analyzeTravelHistory } from './parser';

describe('Parser - Date Handling', () => {
  describe('parseDate', () => {
    it('should parse DD/MM/YYYY format to ISO string', () => {
      expect(parseDate('15/01/2024')).toBe('2024-01-15');
      expect(parseDate('01/12/2023')).toBe('2023-12-01');
    });

    it('should parse YYYY-MM-DD format to ISO string', () => {
      expect(parseDate('2024-01-15')).toBe('2024-01-15');
      expect(parseDate('2023-12-01')).toBe('2023-12-01');
    });

    it('should parse DD-MM-YYYY format to ISO string', () => {
      expect(parseDate('15-01-2024')).toBe('2024-01-15');
      expect(parseDate('01-12-2023')).toBe('2023-12-01');
    });

    it('should handle leap year dates correctly', () => {
      expect(parseDate('29/02/2024')).toBe('2024-02-29'); // Valid leap year
      expect(parseDate('2024-02-29')).toBe('2024-02-29');
    });

    it('should return null for invalid leap year dates', () => {
      expect(parseDate('29/02/2023')).toBeNull(); // Not a leap year
      expect(parseDate('2023-02-29')).toBeNull();
    });

    it('should return null for invalid date formats', () => {
      expect(parseDate('invalid')).toBeNull();
      expect(parseDate('2024/01/15')).toBeNull(); // Wrong separator for YYYY format
      expect(parseDate('32/01/2024')).toBeNull(); // Invalid day
      expect(parseDate('15/13/2024')).toBeNull(); // Invalid month
    });

    it('should return null for empty or malformed strings', () => {
      expect(parseDate('')).toBeNull();
      expect(parseDate('   ')).toBeNull();
      expect(parseDate('not-a-date')).toBeNull();
    });

    it('should handle dates at year boundaries', () => {
      expect(parseDate('31/12/2023')).toBe('2023-12-31');
      expect(parseDate('01/01/2024')).toBe('2024-01-01');
    });

    it('should handle dates with leading zeros', () => {
      expect(parseDate('05/03/2024')).toBe('2024-03-05');
      expect(parseDate('2024-03-05')).toBe('2024-03-05');
    });
  });

  describe('parseTravelRecords', () => {
    it('should return ISO date strings in records', () => {
      const text = `15/01/2024 ABC123 Outbound LHR 0 CDG
20/01/2024 DEF456 Inbound CDG 0 LHR`;

      const records = parseTravelRecords(text);

      expect(records).toHaveLength(2);
      expect(records[0].date).toBe('2024-01-15');
      expect(records[1].date).toBe('2024-01-20');
      expect(typeof records[0].date).toBe('string');
      expect(typeof records[1].date).toBe('string');
    });

    it('should sort records by ISO date string', () => {
      const text = `20/01/2024 ABC123 Inbound CDG 0 LHR
15/01/2024 ABC123 Outbound LHR 0 CDG
10/02/2024 ABC123 Inbound CDG 0 LHR`;

      const records = parseTravelRecords(text);

      expect(records).toHaveLength(3);
      expect(records[0].date).toBe('2024-01-15');
      expect(records[1].date).toBe('2024-01-20');
      expect(records[2].date).toBe('2024-02-10');
    });

    it('should handle records spanning multiple years', () => {
      const text = `20/12/2023 ABC123 Outbound LHR 0 CDG
05/01/2024 ABC123 Inbound CDG 0 LHR`;

      const records = parseTravelRecords(text);

      expect(records).toHaveLength(2);
      expect(records[0].date).toBe('2023-12-20');
      expect(records[1].date).toBe('2024-01-05');
    });

    it('should deduplicate records based on date and direction', () => {
      const text = `15/01/2024 ABC123 Outbound LHR 0 CDG
15/01/2024 XYZ789 Outbound LHR 0 CDG
20/01/2024 ABC123 Inbound CDG 0 LHR`;

      const records = parseTravelRecords(text);

      // Should have only 2 records (duplicate outbound removed)
      expect(records).toHaveLength(2);
      expect(records[0].date).toBe('2024-01-15');
      expect(records[1].date).toBe('2024-01-20');
    });

    it('should handle empty input', () => {
      const records = parseTravelRecords('');
      expect(records).toHaveLength(0);
    });

    it('should skip lines with invalid dates', () => {
      const text = `invalid-date ABC123 Outbound LHR 0 CDG
15/01/2024 ABC123 Outbound LHR 0 CDG
20/01/2024 ABC123 Inbound CDG 0 LHR`;

      const records = parseTravelRecords(text);

      // Should skip the invalid line
      expect(records).toHaveLength(2);
      expect(records[0].date).toBe('2024-01-15');
    });
  });

  describe('pairTrips', () => {
    it('should return ISO date strings in trips', () => {
      const records = [
        { date: '2024-01-15', direction: 'Outbound' as const, route: 'LHR → CDG' },
        { date: '2024-01-20', direction: 'Inbound' as const, route: 'CDG → LHR' },
      ];

      const trips = pairTrips(records);

      expect(trips).toHaveLength(1);
      expect(trips[0].outDate).toBe('2024-01-15');
      expect(trips[0].inDate).toBe('2024-01-20');
      expect(typeof trips[0].outDate).toBe('string');
      expect(typeof trips[0].inDate).toBe('string');
    });

    it('should calculate calendar days correctly using ISO strings', () => {
      const records = [
        { date: '2024-01-15', direction: 'Outbound' as const, route: 'LHR → CDG' },
        { date: '2024-01-20', direction: 'Inbound' as const, route: 'CDG → LHR' },
      ];

      const trips = pairTrips(records);

      // Jan 15 to Jan 20 = 5 calendar days, 4 full days
      expect(trips[0].calendarDays).toBe(5);
      expect(trips[0].fullDays).toBe(4);
    });

    it('should handle same-day trips', () => {
      const records = [
        { date: '2024-01-15', direction: 'Outbound' as const, route: 'LHR → CDG' },
        { date: '2024-01-15', direction: 'Inbound' as const, route: 'CDG → LHR' },
      ];

      const trips = pairTrips(records);

      expect(trips[0].calendarDays).toBe(0);
      expect(trips[0].fullDays).toBe(0);
    });

    it('should handle trips spanning year boundaries', () => {
      const records = [
        { date: '2023-12-20', direction: 'Outbound' as const, route: 'LHR → CDG' },
        { date: '2024-01-05', direction: 'Inbound' as const, route: 'CDG → LHR' },
      ];

      const trips = pairTrips(records);

      // Dec 20 to Jan 5 = 16 calendar days, 15 full days
      expect(trips[0].calendarDays).toBe(16);
      expect(trips[0].fullDays).toBe(15);
    });

    it('should handle trips across leap year date', () => {
      const records = [
        { date: '2024-02-28', direction: 'Outbound' as const, route: 'LHR → CDG' },
        { date: '2024-03-01', direction: 'Inbound' as const, route: 'CDG → LHR' },
      ];

      const trips = pairTrips(records);

      // Feb 28 to Mar 1 (2024 is leap year) = 2 calendar days, 1 full day (Feb 29)
      expect(trips[0].calendarDays).toBe(2);
      expect(trips[0].fullDays).toBe(1);
    });

    it('should handle incomplete trips (no return)', () => {
      const records = [
        { date: '2024-01-15', direction: 'Outbound' as const, route: 'LHR → CDG' },
      ];

      const trips = pairTrips(records);

      expect(trips).toHaveLength(1);
      expect(trips[0].outDate).toBe('2024-01-15');
      expect(trips[0].inDate).toBeNull();
      expect(trips[0].calendarDays).toBeNull();
      expect(trips[0].fullDays).toBeNull();
    });

    it('should handle incomplete trips (no departure)', () => {
      const records = [
        { date: '2024-01-20', direction: 'Inbound' as const, route: 'CDG → LHR' },
      ];

      const trips = pairTrips(records);

      expect(trips).toHaveLength(1);
      expect(trips[0].outDate).toBeNull();
      expect(trips[0].inDate).toBe('2024-01-20');
      expect(trips[0].calendarDays).toBeNull();
      expect(trips[0].fullDays).toBeNull();
    });

    it('should handle multiple consecutive trips', () => {
      const records = [
        { date: '2024-01-15', direction: 'Outbound' as const, route: 'LHR → CDG' },
        { date: '2024-01-20', direction: 'Inbound' as const, route: 'CDG → LHR' },
        { date: '2024-02-01', direction: 'Outbound' as const, route: 'LHR → AMS' },
        { date: '2024-02-10', direction: 'Inbound' as const, route: 'AMS → LHR' },
      ];

      const trips = pairTrips(records);

      expect(trips).toHaveLength(2);
      expect(trips[0].outDate).toBe('2024-01-15');
      expect(trips[0].inDate).toBe('2024-01-20');
      expect(trips[1].outDate).toBe('2024-02-01');
      expect(trips[1].inDate).toBe('2024-02-10');
    });
  });

  describe('analyzeTravelHistory', () => {
    it('should return ISO date strings in full analysis', () => {
      const text = `15/01/2024 ABC123 Outbound LHR 0 CDG
20/01/2024 DEF456 Inbound CDG 0 LHR`;

      const result = analyzeTravelHistory(text);

      expect(result.records).toHaveLength(2);
      expect(result.trips).toHaveLength(1);
      expect(result.records[0].date).toBe('2024-01-15');
      expect(result.trips[0].outDate).toBe('2024-01-15');
      expect(result.trips[0].inDate).toBe('2024-01-20');
    });

    it('should calculate summary correctly with ISO dates', () => {
      const text = `15/01/2024 ABC123 Outbound LHR 0 CDG
20/01/2024 DEF456 Inbound CDG 0 LHR
01/02/2024 ABC123 Outbound LHR 0 AMS
10/02/2024 DEF456 Inbound AMS 0 LHR`;

      const result = analyzeTravelHistory(text);

      expect(result.summary.totalTrips).toBe(2);
      expect(result.summary.completeTrips).toBe(2);
      // Trip 1: Jan 15-20 = 4 full days (Jan 16,17,18,19)
      // Trip 2: Feb 1-10 = 8 full days (Feb 2,3,4,5,6,7,8,9)
      expect(result.summary.totalFullDays).toBe(12); // 4 + 8 days
    });

    it('should handle complex multi-year travel history', () => {
      const text = `20/12/2023 ABC123 Outbound LHR 0 CDG
05/01/2024 ABC123 Inbound CDG 0 LHR
15/01/2024 ABC123 Outbound LHR 0 AMS
20/01/2024 ABC123 Inbound AMS 0 LHR`;

      const result = analyzeTravelHistory(text);

      expect(result.trips).toHaveLength(2);
      expect(result.trips[0].outDate).toBe('2023-12-20');
      expect(result.trips[0].inDate).toBe('2024-01-05');
      expect(result.trips[1].outDate).toBe('2024-01-15');
      expect(result.trips[1].inDate).toBe('2024-01-20');
      expect(result.summary.totalFullDays).toBe(19); // 15 + 4 days
    });
  });

  describe('Date String Immutability', () => {
    it('should not modify date strings during processing', () => {
      const text = `15/01/2024 ABC123 Outbound LHR 0 CDG
20/01/2024 DEF456 Inbound CDG 0 LHR`;

      const result = analyzeTravelHistory(text);
      const originalOutDate = result.trips[0].outDate;
      const originalInDate = result.trips[0].inDate;

      // Process again
      const result2 = analyzeTravelHistory(text);

      expect(result2.trips[0].outDate).toBe(originalOutDate);
      expect(result2.trips[0].inDate).toBe(originalInDate);
    });

    it('should maintain consistent date format across multiple parses', () => {
      const text = `15/01/2024 ABC123 Outbound LHR 0 CDG`;

      const result1 = analyzeTravelHistory(text);
      const result2 = analyzeTravelHistory(text);
      const result3 = analyzeTravelHistory(text);

      expect(result1.records[0].date).toBe(result2.records[0].date);
      expect(result2.records[0].date).toBe(result3.records[0].date);
      expect(result1.records[0].date).toBe('2024-01-15');
    });
  });

  describe('Timezone Independence', () => {
    it('should produce same results regardless of system timezone', () => {
      // This test ensures our ISO string approach avoids timezone issues
      const text = `15/01/2024 ABC123 Outbound LHR 0 CDG
20/01/2024 DEF456 Inbound CDG 0 LHR`;

      const result = analyzeTravelHistory(text);

      // All dates should be in ISO format (YYYY-MM-DD) without time component
      expect(result.records[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.trips[0].outDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.trips[0].inDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Calendar days calculation should be consistent
      expect(result.trips[0].calendarDays).toBe(5);
      expect(result.trips[0].fullDays).toBe(4);
    });
  });
});
