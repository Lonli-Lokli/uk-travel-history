import { describe, it, expect, beforeEach } from 'vitest';
import { DaysCounterRuleEngine } from './days-counter';
import type { TripRecord } from '@uth/calculators';
import type { DaysCounterConfig } from '../types';

describe('DaysCounterRuleEngine', () => {
  let engine: DaysCounterRuleEngine;

  beforeEach(() => {
    engine = new DaysCounterRuleEngine();
  });

  describe('Basic Properties', () => {
    it('should have correct goal type', () => {
      expect(engine.goalType).toBe('days_counter');
    });

    it('should have correct jurisdiction', () => {
      expect(engine.jurisdiction).toBe('global');
    });
  });

  describe('Display Info', () => {
    it('should return correct display information', () => {
      const info = engine.getDisplayInfo();

      expect(info.name).toBe('Days Counter');
      expect(info.icon).toBe('calculator');
      expect(info.description).toContain('Count days');
      expect(info.category).toBe('personal');
    });
  });

  describe('Config Validation', () => {
    it('should validate correct days counter config for days_away', () => {
      const validConfig: DaysCounterConfig = {
        type: 'days_counter',
        countDirection: 'days_away',
        referenceLocation: 'Home',
      };

      expect(engine.validateConfig(validConfig)).toBe(true);
    });

    it('should validate correct days counter config for days_present', () => {
      const validConfig: DaysCounterConfig = {
        type: 'days_counter',
        countDirection: 'days_present',
        referenceLocation: 'UK',
      };

      expect(engine.validateConfig(validConfig)).toBe(true);
    });

    it('should reject config without type', () => {
      const config = {
        countDirection: 'days_away',
        referenceLocation: 'Home',
      };

      expect(engine.validateConfig(config)).toBe(false);
    });

    it('should reject config without countDirection', () => {
      const config = {
        type: 'days_counter',
        referenceLocation: 'Home',
      };

      expect(engine.validateConfig(config)).toBe(false);
    });

    it('should reject config without referenceLocation', () => {
      const config = {
        type: 'days_counter',
        countDirection: 'days_away',
      };

      expect(engine.validateConfig(config)).toBe(false);
    });

    it('should reject invalid countDirection', () => {
      const config = {
        type: 'days_counter',
        countDirection: 'invalid',
        referenceLocation: 'Home',
      };

      expect(engine.validateConfig(config)).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(engine.validateConfig(null)).toBe(false);
      expect(engine.validateConfig(undefined)).toBe(false);
    });
  });

  describe('Calculate - Days Away', () => {
    const mockTrips: TripRecord[] = [
      {
        id: '1',
        outDate: '2024-01-05',
        inDate: '2024-01-15',
        outRoute: 'LHR - JFK',
        inRoute: 'JFK - LHR',
      },
      {
        id: '2',
        outDate: '2024-02-10',
        inDate: '2024-02-20',
        outRoute: 'LHR - CDG',
        inRoute: 'CDG - LHR',
      },
    ];

    const configDaysAway: DaysCounterConfig = {
      type: 'days_counter',
      countDirection: 'days_away',
      referenceLocation: 'Home',
    };

    it('should calculate days away correctly', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-03-01');

      const result = engine.calculate(
        mockTrips,
        configDaysAway,
        startDate,
        asOfDate,
      );

      expect(result.goalType).toBe('days_counter');
      expect(result.status).toBe('in_progress');
      expect(result.progressPercent).toBe(0); // No target
    });

    it('should include days away metric as primary', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-03-01');

      const result = engine.calculate(
        mockTrips,
        configDaysAway,
        startDate,
        asOfDate,
      );

      const primaryMetric = result.metrics.find(
        (m) => m.key === 'primary_count',
      );
      expect(primaryMetric).toBeDefined();
      expect(primaryMetric?.label).toContain('Days Away from Home');
      expect(primaryMetric?.value).toBeGreaterThan(0); // Should have some days
    });

    it('should include days present as secondary metric', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-03-01');

      const result = engine.calculate(
        mockTrips,
        configDaysAway,
        startDate,
        asOfDate,
      );

      const secondaryMetric = result.metrics.find(
        (m) => m.key === 'days_present',
      );
      expect(secondaryMetric).toBeDefined();
      expect(secondaryMetric?.label).toContain('Days in Home');
    });

    it('should calculate percentage correctly', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-01-31'); // 31 days total

      const result = engine.calculate(
        mockTrips,
        configDaysAway,
        startDate,
        asOfDate,
      );

      const percentageMetric = result.metrics.find((m) => m.key === 'percentage');
      expect(percentageMetric).toBeDefined();
      expect(percentageMetric?.unit).toBe('percent');
      expect(percentageMetric?.value).toBeGreaterThanOrEqual(0);
      expect(percentageMetric?.value).toBeLessThanOrEqual(100);
    });

    it('should handle no trips', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-01-31');

      const result = engine.calculate([], configDaysAway, startDate, asOfDate);

      const primaryMetric = result.metrics.find(
        (m) => m.key === 'primary_count',
      );
      expect(primaryMetric?.value).toBe(0); // No trips = 0 days away
    });

    it('should handle trips with incomplete dates', () => {
      const incompleteTrips: TripRecord[] = [
        {
          id: '1',
          outDate: '2024-01-05',
          inDate: '', // Missing return date
          outRoute: 'LHR - JFK',
          inRoute: 'JFK - LHR',
        },
      ];

      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-01-31');

      const result = engine.calculate(
        incompleteTrips,
        configDaysAway,
        startDate,
        asOfDate,
      );

      // Should handle gracefully
      expect(result).toBeDefined();
    });

    it('should exclude trips outside date range', () => {
      const tripsOutsideRange: TripRecord[] = [
        {
          id: '1',
          outDate: '2023-12-01',
          inDate: '2023-12-10',
          outRoute: 'LHR - JFK',
          inRoute: 'JFK - LHR',
        },
        {
          id: '2',
          outDate: '2024-03-01',
          inDate: '2024-03-10',
          outRoute: 'LHR - CDG',
          inRoute: 'CDG - LHR',
        },
      ];

      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-02-28');

      const result = engine.calculate(
        tripsOutsideRange,
        configDaysAway,
        startDate,
        asOfDate,
      );

      const primaryMetric = result.metrics.find(
        (m) => m.key === 'primary_count',
      );
      expect(primaryMetric?.value).toBe(0); // Both trips outside range
    });

    it('should clip trips that overlap date range boundaries', () => {
      const overlappingTrips: TripRecord[] = [
        {
          id: '1',
          outDate: '2023-12-25', // Starts before range
          inDate: '2024-01-05', // Ends in range
          outRoute: 'LHR - JFK',
          inRoute: 'JFK - LHR',
        },
        {
          id: '2',
          outDate: '2024-02-25', // Starts in range
          inDate: '2024-03-05', // Ends after range
          outRoute: 'LHR - CDG',
          inRoute: 'CDG - LHR',
        },
      ];

      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-02-29');

      const result = engine.calculate(
        overlappingTrips,
        configDaysAway,
        startDate,
        asOfDate,
      );

      // Should clip and calculate partial trips
      const primaryMetric = result.metrics.find(
        (m) => m.key === 'primary_count',
      );
      expect(primaryMetric?.value).toBeGreaterThan(0);
    });
  });

  describe('Calculate - Days Present', () => {
    const mockTrips: TripRecord[] = [
      {
        id: '1',
        outDate: '2024-01-05',
        inDate: '2024-01-15',
        outRoute: 'LHR - JFK',
        inRoute: 'JFK - LHR',
      },
    ];

    const configDaysPresent: DaysCounterConfig = {
      type: 'days_counter',
      countDirection: 'days_present',
      referenceLocation: 'UK',
    };

    it('should calculate days present correctly', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-01-31');

      const result = engine.calculate(
        mockTrips,
        configDaysPresent,
        startDate,
        asOfDate,
      );

      const primaryMetric = result.metrics.find(
        (m) => m.key === 'primary_count',
      );
      expect(primaryMetric).toBeDefined();
      expect(primaryMetric?.label).toContain('Days in UK');
      expect(primaryMetric?.value).toBeGreaterThan(0);
    });

    it('should include days away as secondary metric', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-01-31');

      const result = engine.calculate(
        mockTrips,
        configDaysPresent,
        startDate,
        asOfDate,
      );

      const secondaryMetric = result.metrics.find(
        (m) => m.key === 'days_away',
      );
      expect(secondaryMetric).toBeDefined();
      expect(secondaryMetric?.label).toContain('Days Away');
    });

    it('should sum days away + days present to total days', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-01-31');

      const result = engine.calculate(
        mockTrips,
        configDaysPresent,
        startDate,
        asOfDate,
      );

      const primaryMetric = result.metrics.find(
        (m) => m.key === 'primary_count',
      );
      const secondaryMetric = result.metrics.find(
        (m) => m.key === 'days_away',
      );
      const totalMetric = result.metrics.find(
        (m) => m.key === 'tracking_period',
      );

      const daysPresent = primaryMetric?.value as number;
      const daysAway = secondaryMetric?.value as number;
      const totalDays = totalMetric?.value as number;

      expect(daysPresent + daysAway).toBe(totalDays);
    });

    it('should handle zero trips (all days present)', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-01-31'); // 31 days

      const result = engine.calculate(
        [],
        configDaysPresent,
        startDate,
        asOfDate,
      );

      const primaryMetric = result.metrics.find(
        (m) => m.key === 'primary_count',
      );
      const totalMetric = result.metrics.find(
        (m) => m.key === 'tracking_period',
      );

      expect(primaryMetric?.value).toBe(totalMetric?.value); // All days present
    });
  });

  describe('Calculate - Edge Cases', () => {
    const config: DaysCounterConfig = {
      type: 'days_counter',
      countDirection: 'days_away',
      referenceLocation: 'Home',
    };

    it('should handle same start and end date', () => {
      const date = new Date('2024-01-01');

      const result = engine.calculate([], config, date, date);

      const totalMetric = result.metrics.find(
        (m) => m.key === 'tracking_period',
      );
      expect(totalMetric?.value).toBe(1); // 1 day (inclusive)
    });

    it('should always return status as in_progress', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-12-31');

      const result = engine.calculate([], config, startDate, asOfDate);

      expect(result.status).toBe('in_progress');
    });

    it('should never have eligibility date', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-12-31');

      const result = engine.calculate([], config, startDate, asOfDate);

      expect(result.eligibilityDate).toBeNull();
      expect(result.daysUntilEligible).toBeNull();
    });

    it('should never have warnings', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-12-31');

      const result = engine.calculate([], config, startDate, asOfDate);

      expect(result.warnings).toEqual([]);
    });

    it('should include tracking period metric', () => {
      const startDate = new Date('2024-01-01');
      const asOfDate = new Date('2024-01-31');

      const result = engine.calculate([], config, startDate, asOfDate);

      const trackingMetric = result.metrics.find(
        (m) => m.key === 'tracking_period',
      );
      expect(trackingMetric).toBeDefined();
      expect(trackingMetric?.label).toContain('Total Days Tracked');
      expect(trackingMetric?.value).toBe(31);
    });
  });
});
