import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UKILRRuleEngine } from './uk-ilr';
import { calculateTravelData, type TripRecord } from '../internal';
import type { UKILRConfig } from '../types';

// Mock the calculateTravelData function
vi.mock('../internal', () => ({
  calculateTravelData: vi.fn((_params) => {
    // Return a realistic mock response based on input
    const hasExceeded = false;
    const totalDays = 100;
    const remaining = 80;

    return {
      summary: {
        totalFullDays: totalDays,
        continuousLeaveDays: 1000,
        maxAbsenceInAny12Months: 120,
        currentRollingAbsenceToday: 90,
        remaining180LimitToday: remaining,
        hasExceededAllowedAbsense: hasExceeded,
        ilrEligibilityDate: '2027-03-01',
        daysUntilEligible: 365,
      },
      validation: {
        status: hasExceeded ? 'INELIGIBLE' : 'ELIGIBLE',
        reason: hasExceeded
          ? { message: 'Exceeded absence limit' }
          : undefined,
      },
    };
  }),
}));

describe('UKILRRuleEngine', () => {
  let engine: UKILRRuleEngine;

  beforeEach(() => {
    engine = new UKILRRuleEngine();
    vi.clearAllMocks();
  });

  describe('Basic Properties', () => {
    it('should have correct goal type', () => {
      expect(engine.goalType).toBe('uk_ilr');
    });

    it('should have correct jurisdiction', () => {
      expect(engine.jurisdiction).toBe('uk');
    });
  });

  describe('Display Info', () => {
    it('should return correct display information', () => {
      const info = engine.getDisplayInfo();

      expect(info.name).toBe('UK Indefinite Leave to Remain');
      expect(info.icon).toBe('home');
      expect(info.description).toContain('continuous residence');
      expect(info.category).toBe('immigration');
    });
  });

  describe('Config Validation', () => {
    it('should validate correct UK ILR config', () => {
      const validConfig: UKILRConfig = {
        type: 'uk_ilr',
        trackYears: 5,
        visaStartDate: '2022-03-01',
      };

      expect(engine.validateConfig(validConfig)).toBe(true);
    });

    it('should accept valid track years (2, 3, 5, 10)', () => {
      const validYears = [2, 3, 5, 10];

      for (const years of validYears) {
        const config: UKILRConfig = {
          type: 'uk_ilr',
          trackYears: years,
          visaStartDate: '2022-03-01',
        };
        expect(engine.validateConfig(config)).toBe(true);
      }
    });

    it('should reject invalid track years', () => {
      const config = {
        type: 'uk_ilr',
        trackYears: 4, // Invalid
        visaStartDate: '2022-03-01',
      };

      expect(engine.validateConfig(config)).toBe(false);
    });

    it('should reject config without type', () => {
      const config = {
        trackYears: 5,
        visaStartDate: '2022-03-01',
      };

      expect(engine.validateConfig(config)).toBe(false);
    });

    it('should reject config without visaStartDate', () => {
      const config = {
        type: 'uk_ilr',
        trackYears: 5,
      };

      expect(engine.validateConfig(config)).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(engine.validateConfig(null)).toBe(false);
      expect(engine.validateConfig(undefined)).toBe(false);
    });
  });

  describe('Calculate', () => {
    const mockTrips: TripRecord[] = [
      {
        id: '1',
        outDate: '2024-01-01',
        inDate: '2024-01-10',
        outRoute: 'LHR - JFK',
        inRoute: 'JFK - LHR',
      },
      {
        id: '2',
        outDate: '2024-06-01',
        inDate: '2024-06-15',
        outRoute: 'LHR - CDG',
        inRoute: 'CDG - LHR',
      },
    ];

    const validConfig: UKILRConfig = {
      type: 'uk_ilr',
      trackYears: 5,
      visaStartDate: '2022-03-01',
    };

    it('should return calculation result', () => {
      const result = engine.calculate(
        mockTrips,
        validConfig,
        new Date('2022-03-01'),
      );

      expect(result).toBeDefined();
      expect(result.goalType).toBe('uk_ilr');
      expect(result.status).toBeDefined();
      expect(result.progressPercent).toBeDefined();
      expect(result.metrics).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
    });

    it('should include eligibility information', () => {
      const result = engine.calculate(
        mockTrips,
        validConfig,
        new Date('2022-03-01'),
      );

      expect(result.eligibilityDate).toBe('2027-03-01');
      expect(result.daysUntilEligible).toBe(365);
    });

    it('should include key metrics', () => {
      const result = engine.calculate(
        mockTrips,
        validConfig,
        new Date('2022-03-01'),
      );

      const metricKeys = result.metrics.map((m) => m.key);
      expect(metricKeys).toContain('total_days_outside');
      expect(metricKeys).toContain('continuous_leave');
      expect(metricKeys).toContain('max_rolling_absence');
      expect(metricKeys).toContain('current_rolling');
      expect(metricKeys).toContain('remaining_allowance');
    });

    it('should calculate progress percentage correctly', () => {
      const startDate = new Date('2022-03-01');
      const asOfDate = new Date('2023-03-01'); // 1 year later

      const result = engine.calculate(
        mockTrips,
        validConfig,
        startDate,
        asOfDate,
      );

      // After 1 year of 5-year track: 1/5 = 20%
      expect(result.progressPercent).toBeGreaterThan(0);
      expect(result.progressPercent).toBeLessThanOrEqual(100);
    });

    it('should cap progress at 100%', () => {
      // Config with visa start 10 years ago
      const configWithOldVisa: UKILRConfig = {
        type: 'uk_ilr',
        trackYears: 5,
        visaStartDate: '2015-03-01', // 10 years before asOfDate
      };

      const startDate = new Date('2015-03-01');
      const asOfDate = new Date('2025-03-01'); // 10 years later

      const result = engine.calculate(
        mockTrips,
        configWithOldVisa,
        startDate,
        asOfDate,
      );

      // 10 years / 5 years track = 200%, but should be capped at 100%
      expect(result.progressPercent).toBe(100);
    });

    it('should include requirements', () => {
      const result = engine.calculate(
        mockTrips,
        validConfig,
        new Date('2022-03-01'),
      );

      expect(result.requirements).toBeDefined();
      expect(result.requirements).toBeInstanceOf(Array);
      expect(result.requirements?.length).toBeGreaterThan(0);

      const reqKeys = result.requirements?.map((r) => r.key);
      expect(reqKeys).toContain('qualifying_period');
      expect(reqKeys).toContain('absence_limit');
    });

    it('should include warnings when remaining allowance is low', () => {
      // Mock calculateTravelData to return low remaining allowance
      vi.mocked(calculateTravelData).mockReturnValueOnce({
        summary: {
          totalFullDays: 150,
          continuousLeaveDays: 1000,
          maxAbsenceInAny12Months: 120,
          currentRollingAbsenceToday: 160,
          remaining180LimitToday: 20, // Low remaining
          hasExceededAllowedAbsense: false,
          ilrEligibilityDate: '2027-03-01',
          daysUntilEligible: 365,
        },
        validation: {
          status: 'ELIGIBLE',
        },
      });

      const result = engine.calculate(
        mockTrips,
        validConfig,
        new Date('2022-03-01'),
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].severity).toBe('warning');
      expect(result.warnings[0].title).toContain('Low Remaining Allowance');
    });

    it('should set status to limit_exceeded when absence exceeded', () => {
      // Mock calculateTravelData to return exceeded absence
      vi.mocked(calculateTravelData).mockReturnValueOnce({
        summary: {
          totalFullDays: 200,
          continuousLeaveDays: 800,
          maxAbsenceInAny12Months: 190, // Exceeded 180
          currentRollingAbsenceToday: 190,
          remaining180LimitToday: 0,
          hasExceededAllowedAbsense: true,
          ilrEligibilityDate: null,
          daysUntilEligible: null,
        },
        validation: {
          status: 'INELIGIBLE',
          reason: { message: 'Exceeded absence limit' },
        },
      });

      const result = engine.calculate(
        mockTrips,
        validConfig,
        new Date('2022-03-01'),
      );

      expect(result.status).toBe('limit_exceeded');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should set status to at_risk when approaching limit', () => {
      // Mock calculateTravelData to return near-limit absence
      vi.mocked(calculateTravelData).mockReturnValueOnce({
        summary: {
          totalFullDays: 140,
          continuousLeaveDays: 900,
          maxAbsenceInAny12Months: 160, // Near limit (>150)
          currentRollingAbsenceToday: 160,
          remaining180LimitToday: 20,
          hasExceededAllowedAbsense: false,
          ilrEligibilityDate: '2027-03-01',
          daysUntilEligible: 100,
        },
        validation: {
          status: 'INELIGIBLE',
        },
      });

      const result = engine.calculate(
        mockTrips,
        validConfig,
        new Date('2022-03-01'),
      );

      expect(result.status).toBe('at_risk');
    });

    it('should handle vignette entry date in config', () => {
      const configWithVignette: UKILRConfig = {
        type: 'uk_ilr',
        trackYears: 5,
        visaStartDate: '2022-03-01',
        vignetteEntryDate: '2022-02-15',
      };

      const result = engine.calculate(
        mockTrips,
        configWithVignette,
        new Date('2022-03-01'),
      );

      expect(result).toBeDefined();
      expect(result.goalType).toBe('uk_ilr');
    });

    it('should use visa start date as vignette if not provided', () => {
      const result = engine.calculate(
        mockTrips,
        validConfig,
        new Date('2022-03-01'),
      );

      // Should not throw and should calculate normally
      expect(result).toBeDefined();
    });
  });
});
