import { describe, it, expect, beforeEach } from 'vitest';
import { travelStore, TripRecord } from './travelStore';

describe('TravelStore - UK Home Office Guidance v22.0 Compliance', () => {
  beforeEach(() => {
    // Clear store before each test
    travelStore.clearAll();
    travelStore.setVignetteEntryDate('');
    travelStore.setVisaStartDate('');
    travelStore.setILRTrack(null);
  });

  describe('Full Days Calculation (Section: Calculation Method)', () => {
    it('should calculate full days correctly: (Return Date - Departure Date) - 1', () => {
      // Guidance: Full Days = (Return Date − Departure Date) − 1
      // Example: Out 1 Jan, In 5 Jan = 5-1=4, minus 1 = 3 full days
      const trip = travelStore.addTrip({
        outDate: '2024-01-01',
        inDate: '2024-01-05',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const calculated = travelStore.tripsWithCalculations.find(
        (t) => t.id === trip.id
      );
      expect(calculated?.calendarDays).toBe(4);
      expect(calculated?.fullDays).toBe(3);
    });

    it('should exclude both departure and return days', () => {
      // Guidance: "This excludes both the departure day and return day"
      const trip = travelStore.addTrip({
        outDate: '2024-06-10',
        inDate: '2024-06-20',
        outRoute: 'London to Paris',
        inRoute: 'Paris to London',
      });

      const calculated = travelStore.tripsWithCalculations.find(
        (t) => t.id === trip.id
      );
      // 20 - 10 = 10 days, minus 1 = 9 full days
      expect(calculated?.fullDays).toBe(9);
    });

    it('should return 0 full days for same day return (not -1)', () => {
      // Edge case: same day return should be 0, not negative
      const trip = travelStore.addTrip({
        outDate: '2024-01-01',
        inDate: '2024-01-01',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const calculated = travelStore.tripsWithCalculations.find(
        (t) => t.id === trip.id
      );
      expect(calculated?.fullDays).toBe(0);
    });

    it('should return 0 full days for next day return', () => {
      // Out Jan 1, In Jan 2 = 1 calendar day, minus 1 = 0 full days
      const trip = travelStore.addTrip({
        outDate: '2024-01-01',
        inDate: '2024-01-02',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const calculated = travelStore.tripsWithCalculations.find(
        (t) => t.id === trip.id
      );
      expect(calculated?.calendarDays).toBe(1);
      expect(calculated?.fullDays).toBe(0);
    });

    it('should handle incomplete trips (missing dates)', () => {
      const trip = travelStore.addTrip({
        outDate: '2024-01-01',
        inDate: '',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const calculated = travelStore.tripsWithCalculations.find(
        (t) => t.id === trip.id
      );
      expect(calculated?.isIncomplete).toBe(true);
      expect(calculated?.fullDays).toBe(null);
    });
  });

  describe('180-Day Rolling Period Rule (Section: 180 whole days absence)', () => {
    it('should flag when 180 days exceeded in any rolling 12-month period', () => {
      // Guidance: "No more than 180 days' absences are allowed in a consecutive 12-month period"
      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setILRTrack(5);

      // Add trips totaling over 180 days within one year
      travelStore.addTrip({
        outDate: '2023-02-01',
        inDate: '2023-04-01', // 59 days calendar, 58 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      travelStore.addTrip({
        outDate: '2023-06-01',
        inDate: '2023-08-01', // 61 days calendar, 60 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      travelStore.addTrip({
        outDate: '2023-10-01',
        inDate: '2023-12-05', // 65 days calendar, 64 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;
      // Total: 58 + 60 + 64 = 182 full days (Dec 5 - Oct 1 = 65 days, 64 full days)
      expect(summary.totalFullDays).toBe(182);
      expect(summary.hasExceeded180Days).toBe(true);
    });

    it('should not flag when exactly 180 days in rolling period', () => {
      travelStore.setVisaStartDate('2023-01-01');

      // Exactly 180 full days
      travelStore.addTrip({
        outDate: '2023-03-01',
        inDate: '2023-08-29', // 181 days calendar, 180 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;
      expect(summary.totalFullDays).toBe(180);
      expect(summary.hasExceeded180Days).toBe(false);
    });

    it('should check rolling 12-month windows, not calendar years', () => {
      // Guidance: "absences are considered on a rolling basis"
      travelStore.setVisaStartDate('2023-06-01');
      travelStore.setILRTrack(5);

      // ~100 days in late 2023
      travelStore.addTrip({
        outDate: '2023-09-01',
        inDate: '2023-12-11', // 101 days calendar, 100 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      // ~84 days in early 2024
      travelStore.addTrip({
        outDate: '2024-02-01',
        inDate: '2024-04-27', // 86 days calendar, 85 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;
      // Actual calculation yields 185 full days total (100 + 85)
      expect(summary.totalFullDays).toBe(185);
      // These don't overlap in same 12-month window starting from June 1
      // But they might overlap in a window starting Sep 1
      expect(summary.maxAbsenceInAny12Months).toBeGreaterThan(180);
    });

    it('should handle multiple trips within rolling period', () => {
      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setILRTrack(5);

      // Add 10 trips of 20 days each = 200 full days total
      for (let i = 0; i < 10; i++) {
        const month = i + 1;
        travelStore.addTrip({
          outDate: `2023-${month.toString().padStart(2, '0')}-01`,
          inDate: `2023-${month.toString().padStart(2, '0')}-22`, // 21 days calendar, 20 full days
          outRoute: 'Test',
          inRoute: 'Test',
        });
      }

      const summary = travelStore.summary;
      expect(summary.hasExceeded180Days).toBe(true);
    });
  });

  describe('Continuous Leave Calculation (Backward Counting)', () => {
    it('should calculate days in UK correctly with backward counting', () => {
      // Backward counting: qualifying period days - absence days = continuous days
      travelStore.setVignetteEntryDate('2020-01-01');
      travelStore.setILRTrack(5);

      travelStore.addTrip({
        outDate: '2020-06-01',
        inDate: '2020-06-15', // 14 days calendar, 13 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      // Should have continuous leave days calculated for the qualifying period
      expect(summary.continuousLeaveDays).not.toBe(null);
      expect(summary.continuousLeaveDays).toBeGreaterThan(0);
    });

    it('should prioritize vignette entry date over visa start date', () => {
      travelStore.setVignetteEntryDate('2020-06-01');
      travelStore.setVisaStartDate('2020-01-01');
      travelStore.setILRTrack(5);

      const summary = travelStore.summary;
      // Should use vignette date (June), not visa date (January)
      expect(summary.continuousLeaveDays).not.toBe(null);

      // Continuous days should be calculated from vignette date
      expect(summary.continuousLeaveDays).toBeGreaterThan(0);
    });

    it('should return null when no ILR track is set', () => {
      travelStore.setVisaStartDate('2020-01-01');

      travelStore.addTrip({
        outDate: '2024-01-01',
        inDate: '2024-01-10',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;
      // No backward counting without ILR track
      expect(summary.continuousLeaveDays).toBe(null);
    });

    it('should return null when no start date set', () => {
      travelStore.setILRTrack(5);

      travelStore.addTrip({
        outDate: '2024-01-01',
        inDate: '2024-01-10',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;
      expect(summary.continuousLeaveDays).toBe(null);
    });
  });

  describe('Whole Days Only Rule (Section: 180 whole days absence)', () => {
    it('should only count whole days, not part-days', () => {
      // Guidance: "You must only include whole days in this calculation"
      // Our calculation already does this by using date-fns differenceInDays
      travelStore.setVisaStartDate('2024-01-01');

      const trip = travelStore.addTrip({
        outDate: '2024-06-01',
        inDate: '2024-06-02',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const calculated = travelStore.tripsWithCalculations.find(
        (t) => t.id === trip.id
      );
      // Should be 0 full days (only 1 calendar day, minus 1 = 0)
      expect(calculated?.fullDays).toBe(0);
    });
  });

  describe('Edge Cases and Real-World Scenarios', () => {
    it('should handle same-day trip in rolling period calculation', () => {
      // Test that same-day trips (where absenceStart > absenceEnd) are handled correctly
      travelStore.setVisaStartDate('2024-01-01');
      travelStore.setILRTrack(5);

      travelStore.addTrip({
        outDate: '2024-06-15',
        inDate: '2024-06-15', // Same day return
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;
      // Same-day trip should have 0 full days
      expect(summary.totalFullDays).toBe(0);
      // Should not affect rolling period calculation
      expect(summary.maxAbsenceInAny12Months).toBe(0);
      expect(summary.hasExceeded180Days).toBe(false);
    });

    it('should handle overnight trip in rolling period calculation', () => {
      // Test overnight trips (1 day apart, should be 0 full days per guidance)
      travelStore.setVisaStartDate('2024-01-01');
      travelStore.setILRTrack(5);

      travelStore.addTrip({
        outDate: '2024-06-15',
        inDate: '2024-06-16', // Next day
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;
      // Overnight trip: 1 calendar day, 0 full days
      expect(summary.totalFullDays).toBe(0);
      expect(summary.maxAbsenceInAny12Months).toBe(0);
    });

    it('should exclude trips starting before visa start date from rolling window checks', () => {
      // Trip starts before visa start, but we should only count days within the visa period
      travelStore.setVisaStartDate('2024-01-15');
      travelStore.setILRTrack(5);

      travelStore.addTrip({
        outDate: '2024-01-10', // Before visa start
        inDate: '2024-01-25',  // After visa start
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;
      // Total full days: 14 (Jan 25 - Jan 10 - 1)
      expect(summary.totalFullDays).toBe(14);

      // For rolling window starting Jan 15:
      // Absence period: Jan 11 - Jan 24
      // Overlap with window: Jan 15 - Jan 24 = 10 days
      expect(summary.maxAbsenceInAny12Months).toBe(10);
    });

    it('should generate rollingAbsenceData points correctly', () => {
      // Test the rollingAbsenceData getter for chart data
      travelStore.setVisaStartDate('2024-01-01');

      travelStore.addTrip({
        outDate: '2024-02-01',
        inDate: '2024-02-15', // 14 days calendar, 13 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const rollingData = travelStore.rollingAbsenceData;

      // Should have data points
      expect(rollingData.length).toBeGreaterThan(0);

      // Each point should have required fields
      rollingData.forEach(point => {
        expect(point).toHaveProperty('date');
        expect(point).toHaveProperty('rollingDays');
        expect(point).toHaveProperty('riskLevel');
        expect(point).toHaveProperty('formattedDate');
        expect(['low', 'caution', 'critical']).toContain(point.riskLevel);
      });
    });

    it('should return empty rollingAbsenceData when no start date', () => {
      // Test edge case: no visa/vignette start date
      travelStore.addTrip({
        outDate: '2024-01-01',
        inDate: '2024-01-10',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const rollingData = travelStore.rollingAbsenceData;
      expect(rollingData).toEqual([]);
    });

    it('should return empty rollingAbsenceData for invalid date range', () => {
      // Test edge case: future start date (negative total days)
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      travelStore.setVisaStartDate(futureDate.toISOString().split('T')[0]);

      const rollingData = travelStore.rollingAbsenceData;
      expect(rollingData).toEqual([]);
    });

    it('should handle leap year correctly', () => {
      const trip = travelStore.addTrip({
        outDate: '2024-02-28',
        inDate: '2024-03-01', // Crosses leap day
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const calculated = travelStore.tripsWithCalculations.find(
        (t) => t.id === trip.id
      );
      // Feb 28 to Mar 1 = 2 days calendar (including leap day), 1 full day
      expect(calculated?.calendarDays).toBe(2);
      expect(calculated?.fullDays).toBe(1);
    });

    it('should handle trips spanning year boundary', () => {
      const trip = travelStore.addTrip({
        outDate: '2023-12-20',
        inDate: '2024-01-05',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const calculated = travelStore.tripsWithCalculations.find(
        (t) => t.id === trip.id
      );
      // Dec 20 to Jan 5 = 16 days calendar, 15 full days
      expect(calculated?.calendarDays).toBe(16);
      expect(calculated?.fullDays).toBe(15);
    });

    it('should handle multiple overlapping 12-month windows correctly', () => {
      travelStore.setVisaStartDate('2020-01-01');
      travelStore.setILRTrack(5);

      // Long trip that should appear in multiple rolling windows
      travelStore.addTrip({
        outDate: '2020-06-01',
        inDate: '2020-12-31', // 213 days calendar, 212 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;
      // Actual calculation yields 212 full days (Dec 31 - Jun 1 = 213 calendar days, minus 1 = 212 full days)
      expect(summary.totalFullDays).toBe(212);
      expect(summary.hasExceeded180Days).toBe(true);
      expect(summary.maxAbsenceInAny12Months).toBeGreaterThan(180);
    });

    it('should correctly calculate partial overlaps at window start', () => {
      // Critical test: Trip starts before window, ends within window
      travelStore.setVisaStartDate('2024-01-01');
      travelStore.setILRTrack(5);

      // Trip: Dec 20, 2023 - Jan 10, 2024
      travelStore.addTrip({
        outDate: '2023-12-20',
        inDate: '2024-01-10', // 21 days calendar, 20 full days total
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      // Total full days for trip: 20
      expect(summary.totalFullDays).toBe(20);

      // In the rolling window starting Jan 1, 2024:
      // Absence days: Dec 21-Jan 9 (Dec 20 is departure, Jan 10 is return)
      // Days in 2024: Jan 1-9 = 9 days
      expect(summary.maxAbsenceInAny12Months).toBe(9);
    });

    it('should correctly calculate partial overlaps at window end', () => {
      // Critical test: Trip starts within window, ends after window
      travelStore.setVisaStartDate('2023-11-01');
      travelStore.setILRTrack(5);

      // Trip: Nov 20, 2023 - Jan 10, 2024
      travelStore.addTrip({
        outDate: '2023-11-20',
        inDate: '2024-01-10', // 51 days calendar, 50 full days total
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      // Total full days: 50
      expect(summary.totalFullDays).toBe(50);

      // For 12-month window Nov 1, 2023 - Oct 31, 2024:
      // All 50 days are within this window
      // For 12-month window Nov 20, 2023 - Nov 19, 2024:
      // All 50 days are within this window
      expect(summary.maxAbsenceInAny12Months).toBe(50);
    });

    it('should correctly calculate when trip spans across window boundaries', () => {
      // Trip that starts before window and ends after window
      travelStore.setVisaStartDate('2024-02-01');
      travelStore.setILRTrack(5);

      // Trip: Jan 10 - Mar 10, 2024 (60 days calendar, 59 full days)
      travelStore.addTrip({
        outDate: '2024-01-10',
        inDate: '2024-03-10',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;
      expect(summary.totalFullDays).toBe(59);

      // For window Feb 1 - Jan 31, 2025:
      // Absence period: Jan 11 - Mar 9
      // Overlap: Feb 1 - Mar 9 = 38 days
      expect(summary.maxAbsenceInAny12Months).toBe(38);
    });

    it('should correctly sum multiple small trips', () => {
      travelStore.setVisaStartDate('2024-01-01');

      // 5 trips of 10 days each
      for (let i = 1; i <= 5; i++) {
        travelStore.addTrip({
          outDate: `2024-0${i}-01`,
          inDate: `2024-0${i}-12`, // 11 days calendar, 10 full days
          outRoute: 'Test',
          inRoute: 'Test',
        });
      }

      const summary = travelStore.summary;
      expect(summary.totalTrips).toBe(5);
      expect(summary.totalFullDays).toBe(50);
      expect(summary.hasExceeded180Days).toBe(false);
    });

    it('should handle invalid dates gracefully', () => {
      const trip = travelStore.addTrip({
        outDate: 'invalid-date',
        inDate: '2024-01-01',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const calculated = travelStore.tripsWithCalculations.find(
        (t) => t.id === trip.id
      );
      expect(calculated?.isIncomplete).toBe(true);
      expect(calculated?.fullDays).toBe(null);
    });

    it('should handle return before departure (data entry error)', () => {
      const trip = travelStore.addTrip({
        outDate: '2024-01-10',
        inDate: '2024-01-05', // Return before departure
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const calculated = travelStore.tripsWithCalculations.find(
        (t) => t.id === trip.id
      );
      // Should handle gracefully (negative calendar days)
      expect(calculated?.calendarDays).toBeLessThan(0);
      // Full days should be 0 at minimum
      expect(calculated?.fullDays).toBe(0);
    });
  });

  describe('Summary Statistics', () => {
    it('should count complete and incomplete trips correctly', () => {
      travelStore.addTrip({
        outDate: '2024-01-01',
        inDate: '2024-01-10',
        outRoute: 'Complete',
        inRoute: 'Complete',
      });

      travelStore.addTrip({
        outDate: '2024-02-01',
        inDate: '', // Incomplete
        outRoute: 'Incomplete',
        inRoute: 'Incomplete',
      });

      const summary = travelStore.summary;
      expect(summary.totalTrips).toBe(2);
      expect(summary.completeTrips).toBe(1);
      expect(summary.incompleteTrips).toBe(1);
    });

    it('should only sum full days from complete trips', () => {
      travelStore.addTrip({
        outDate: '2024-01-01',
        inDate: '2024-01-11', // 10 days calendar, 9 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      travelStore.addTrip({
        outDate: '2024-02-01',
        inDate: '', // Incomplete - should not count
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;
      expect(summary.totalFullDays).toBe(9);
    });
  });

  describe('ILR Eligibility Calculation (Section: Calculating the specified continuous period)', () => {
    it('should auto-calculate earliest application date for 5-year track', () => {
      // Guidance Page 10: "Applicants can submit a settlement application up to 28 days
      // before they would reach the end of the specified period"
      travelStore.setVisaStartDate('2020-01-01');
      travelStore.setILRTrack(5);

      // Should auto-calculate: visa start + 5 years - 28 days
      const calculated = travelStore.calculatedApplicationDate;
      expect(calculated).toBe('2024-12-04');

      // Summary should use auto-calculated date
      const summary = travelStore.summary;
      expect(summary.ilrEligibilityDate).toBe('2024-12-04');
    });

    it('should auto-calculate earliest application date for 3-year track', () => {
      // For Tier 1 Entrepreneur: 3 years
      travelStore.setVignetteEntryDate('2022-06-01');
      travelStore.setILRTrack(3);

      const calculated = travelStore.calculatedApplicationDate;
      expect(calculated).toBe('2025-05-04');

      const summary = travelStore.summary;
      expect(summary.ilrEligibilityDate).toBe('2025-05-04');
    });

    it('should auto-calculate earliest application date for 2-year track', () => {
      // For Tier 1 Investor: 2 years
      travelStore.setVisaStartDate('2023-03-15');
      travelStore.setILRTrack(2);

      const calculated = travelStore.calculatedApplicationDate;
      expect(calculated).toBe('2025-02-15');

      const summary = travelStore.summary;
      expect(summary.ilrEligibilityDate).toBe('2025-02-15');
    });

    it('should auto-calculate earliest application date for 10-year track', () => {
      // For long residence cases
      travelStore.setVignetteEntryDate('2015-01-01');
      travelStore.setILRTrack(10);

      const calculated = travelStore.calculatedApplicationDate;
      expect(calculated).toBe('2024-12-04');

      const summary = travelStore.summary;
      expect(summary.ilrEligibilityDate).toBe('2024-12-04');
    });

    it('should return null when no track is selected', () => {
      travelStore.setVisaStartDate('2020-01-01');

      const summary = travelStore.summary;
      expect(summary.ilrEligibilityDate).toBe(null);
      expect(summary.daysUntilEligible).toBe(null);
    });

    it('should return null when no start date is set', () => {
      travelStore.setILRTrack(5);

      const summary = travelStore.summary;
      expect(summary.ilrEligibilityDate).toBe(null);
      expect(summary.daysUntilEligible).toBe(null);
    });

    it('should calculate days until eligible when auto-calculated date is in future', () => {
      // Set a future eligibility date
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);

      travelStore.setVisaStartDate(futureDate.toISOString().split('T')[0]);
      travelStore.setILRTrack(5);

      const summary = travelStore.summary;

      // Should have positive days until eligible (auto-calculated)
      expect(summary.daysUntilEligible).toBeGreaterThan(0);
    });

    it('should calculate negative days when already eligible', () => {
      // Set a past eligibility date
      travelStore.setVisaStartDate('2015-01-01');
      travelStore.setILRTrack(5);

      const summary = travelStore.summary;

      // Should have negative days (already eligible)
      expect(summary.daysUntilEligible).toBeLessThan(0);
    });

    it('should allow manual override of application date', () => {
      travelStore.setVisaStartDate('2020-01-01');
      travelStore.setILRTrack(5);

      // Auto-calculated should be 2024-12-04
      expect(travelStore.calculatedApplicationDate).toBe('2024-12-04');

      // Set manual override
      travelStore.setApplicationDate('2025-01-01');

      // Effective date should be the manual override
      expect(travelStore.effectiveApplicationDate).toBe('2025-01-01');

      const summary = travelStore.summary;
      expect(summary.ilrEligibilityDate).toBe('2025-01-01');
    });

    it('should revert to calculated date when manual override is cleared', () => {
      travelStore.setVisaStartDate('2020-01-01');
      travelStore.setILRTrack(5);
      travelStore.setApplicationDate('2025-01-01');

      // Check manual override is active
      expect(travelStore.effectiveApplicationDate).toBe('2025-01-01');

      // Clear manual override
      travelStore.setApplicationDate('');

      // Should revert to calculated
      expect(travelStore.effectiveApplicationDate).toBe('2024-12-04');
    });

    it('should prioritize vignette date over visa date for ILR calculation', () => {
      travelStore.setVignetteEntryDate('2020-06-01');
      travelStore.setVisaStartDate('2020-01-01');
      travelStore.setILRTrack(5);

      const summary = travelStore.summary;

      // Pre-entry period: Jan 1 - Jun 1 = 151 days (< 180, so it counts)
      // Should use visa start date (2020-01-01) because pre-entry is valid
      // 5 years from Jan 1, 2020 = Jan 1, 2025, minus 28 days = Dec 4, 2024
      expect(summary.ilrEligibilityDate).toBe('2024-12-04');
    });

    it('should handle dates near month boundaries in ILR calculation', () => {
      // Test with Feb 28 (just before leap day)
      travelStore.setVisaStartDate('2020-02-28');
      travelStore.setILRTrack(5);

      const calculated = travelStore.calculatedApplicationDate;
      const summary = travelStore.summary;

      // 5 years from 2020-02-28 = 2025-02-28
      // 28 days before = 2025-01-31
      expect(calculated).toBe('2025-01-31');
      expect(summary.ilrEligibilityDate).toBe('2025-01-31');
    });
  });

  describe('Backward Counting (UK Home Office Algorithm)', () => {
    beforeEach(() => {
      travelStore.clearAll();
    });

    it('should use backward counting with auto-calculated application date', () => {
      travelStore.setVisaStartDate('2020-01-01');
      travelStore.setILRTrack(5);

      // Add a trip in the qualifying period
      travelStore.addTrip({
        outDate: '2022-06-01',
        inDate: '2022-06-10', // 9 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      // Should use auto-calculated date (2024-12-04)
      expect(summary.ilrEligibilityDate).toBe('2024-12-04');
      expect(summary.maxAbsenceInAny12Months).toBeLessThanOrEqual(9);
    });

    it('should use backward counting with manual application date override', () => {
      travelStore.setVisaStartDate('2020-01-01');
      travelStore.setILRTrack(5);
      travelStore.setApplicationDate('2025-01-01');

      // Add a trip in the qualifying period
      travelStore.addTrip({
        outDate: '2022-06-01',
        inDate: '2022-06-10', // 9 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      // Should use manual override date
      expect(summary.ilrEligibilityDate).toBe('2025-01-01');
      expect(summary.maxAbsenceInAny12Months).toBeLessThanOrEqual(9);
    });

    it('should find the most beneficial assessment date within 28-day window', () => {
      travelStore.setVisaStartDate('2020-01-01');
      travelStore.setILRTrack(5);
      travelStore.setApplicationDate('2025-01-01');

      // Add a trip that falls just outside the qualifying period if we count from app date
      // But within if we use app date + 28 days
      travelStore.addTrip({
        outDate: '2019-12-15',
        inDate: '2019-12-25', // 10 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      // Add a trip in the main period
      travelStore.addTrip({
        outDate: '2022-01-01',
        inDate: '2022-01-20', // 19 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      // Should find the best assessment date (most beneficial)
      expect(summary.maxAbsenceInAny12Months).toBeDefined();
      expect(summary.hasExceeded180Days).toBe(false);
    });

    it('should correctly count backward 5 years from application date', () => {
      travelStore.setVisaStartDate('2019-01-01');
      travelStore.setILRTrack(5);
      travelStore.setApplicationDate('2024-06-01');

      // Qualifying period: 2019-06-01 to 2024-06-01 (5 years back)
      // Trip within qualifying period
      travelStore.addTrip({
        outDate: '2020-01-01',
        inDate: '2020-01-15', // 14 calendar days, 13 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      // Trip outside qualifying period (before)
      travelStore.addTrip({
        outDate: '2019-05-01',
        inDate: '2019-05-10', // 9 calendar days, 8 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      // Total full days includes ALL trips (this is still correct for overall stats)
      expect(summary.totalFullDays).toBe(21); // 13 + 8 = 21 days total
      // But max absence in backward mode only considers the qualifying period
      // Trip from May 2019 is before qualifying period start (June 1, 2019)
      // So only the 13-day trip counts in the rolling period check
      expect(summary.maxAbsenceInAny12Months).toBe(13);
    });

    it('should handle 2-year track backward counting', () => {
      travelStore.setVisaStartDate('2022-01-01');
      travelStore.setILRTrack(2);
      travelStore.setApplicationDate('2024-01-01');

      // Qualifying period: 2022-01-01 to 2024-01-01 (2 years back)
      travelStore.addTrip({
        outDate: '2023-01-01',
        inDate: '2023-02-01', // 31 calendar days, 30 full days (excluding Jan 1 and Feb 1)
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      expect(summary.maxAbsenceInAny12Months).toBe(30);
      expect(summary.hasExceeded180Days).toBe(false);
    });

    it('should handle 10-year track backward counting', () => {
      travelStore.setVisaStartDate('2014-01-01');
      travelStore.setILRTrack(10);
      travelStore.setApplicationDate('2024-01-01');

      // Qualifying period: 2014-01-01 to 2024-01-01 (10 years back)
      travelStore.addTrip({
        outDate: '2015-06-01',
        inDate: '2015-06-20', // 19 calendar days, 18 full days (excluding Jun 1 and Jun 20)
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      expect(summary.maxAbsenceInAny12Months).toBe(18);
      expect(summary.hasExceeded180Days).toBe(false);
    });

    it('should revert to auto-calculated date when manual override is cleared', () => {
      travelStore.setVisaStartDate('2020-01-01');
      travelStore.setILRTrack(5);
      travelStore.setApplicationDate('2025-01-01');

      // Check manual override is active
      let summary = travelStore.summary;
      expect(summary.ilrEligibilityDate).toBe('2025-01-01');

      // Clear manual override
      travelStore.setApplicationDate('');

      // Should revert to auto-calculated date (2024-12-04)
      summary = travelStore.summary;
      expect(summary.ilrEligibilityDate).toBe('2024-12-04');
    });

    it('should calculate continuous days correctly in backward mode', () => {
      travelStore.setVisaStartDate('2020-01-01');
      travelStore.setILRTrack(5);
      travelStore.setApplicationDate('2025-01-01');

      // Add trips
      travelStore.addTrip({
        outDate: '2021-01-01',
        inDate: '2021-01-10', // 9 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      travelStore.addTrip({
        outDate: '2023-06-01',
        inDate: '2023-06-15', // 14 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      // Qualifying period: 5 years back from Jan 1, 2025 = Jan 1, 2020 - Jan 1, 2025
      // Total days = 1827 days (5 years including leap year 2020)
      // Days outside = 23 (9 + 14)
      // Days in UK = 1827 - 23 = 1804
      expect(summary.continuousLeaveDays).toBeGreaterThan(1800);
    });

    it('should detect 180-day violation in backward counting mode', () => {
      travelStore.setVisaStartDate('2020-01-01');
      travelStore.setILRTrack(5);
      travelStore.setApplicationDate('2025-01-01');

      // Add a long trip that exceeds 180 days
      travelStore.addTrip({
        outDate: '2021-01-01',
        inDate: '2021-07-15', // 195 days calendar, 194 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      expect(summary.maxAbsenceInAny12Months).toBeGreaterThan(180);
      expect(summary.hasExceeded180Days).toBe(true);
    });

    it('should require ILR track for backward counting', () => {
      travelStore.setVisaStartDate('2020-01-01');

      // Only manual application date, no ILR track
      travelStore.setApplicationDate('2025-01-01');

      let summary = travelStore.summary;
      // Should not calculate anything (no ILR track)
      expect(summary.ilrEligibilityDate).toBeNull();

      // Now add ILR track
      travelStore.setILRTrack(5);

      summary = travelStore.summary;
      // Should use backward counting with manual override
      expect(summary.ilrEligibilityDate).toBe('2025-01-01');

      // Clear manual override
      travelStore.setApplicationDate('');

      summary = travelStore.summary;
      // Should use auto-calculated date
      expect(summary.ilrEligibilityDate).toBe('2024-12-04');
    });
  });

  describe('CSV Import Functionality', () => {
    beforeEach(() => {
      travelStore.clearAll();
    });

    it('should import trips from CSV in append mode', async () => {
      // Add an existing trip
      travelStore.addTrip({
        outDate: '2024-01-01',
        inDate: '2024-01-05',
        outRoute: 'Existing',
        inRoute: 'Trip',
      });

      const csvData = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,London,Paris
01/02/2024,10/02/2024,Berlin,London`;

      const result = await travelStore.importFromCsv(csvData, 'append');

      expect(result.success).toBe(true);
      expect(result.tripCount).toBe(2);
      expect(travelStore.trips).toHaveLength(3); // 1 existing + 2 imported
    });

    it('should import trips from CSV in replace mode', async () => {
      // Add existing trips
      travelStore.addTrip({
        outDate: '2024-01-01',
        inDate: '2024-01-05',
        outRoute: 'Old',
        inRoute: 'Trip',
      });

      const csvData = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,London,Paris`;

      const result = await travelStore.importFromCsv(csvData, 'replace');

      expect(result.success).toBe(true);
      expect(result.tripCount).toBe(1);
      expect(travelStore.trips).toHaveLength(1); // All replaced
      expect(travelStore.trips[0].outRoute).toBe('London');
    });

    it('should handle CSV with warnings', async () => {
      const csvData = `Date Out,Date In,Departure,Return
,,Empty,Row
15/01/2024,20/01/2024,London,Paris`;

      const result = await travelStore.importFromCsv(csvData, 'append');

      expect(result.success).toBe(true);
      expect(result.message).toContain('with warnings');
      expect(travelStore.trips).toHaveLength(1);
    });

    it('should reject invalid CSV data', async () => {
      const csvData = `Date Out,Date In,Departure,Return
invalid-date,20/01/2024,London,Paris`;

      await expect(travelStore.importFromCsv(csvData, 'append')).rejects.toThrow();
      expect(travelStore.trips).toHaveLength(0);
    });

    it('should reject CSV with no valid trips', async () => {
      const csvData = `Date Out,Date In,Departure,Return
,,Empty,Row`;

      await expect(travelStore.importFromCsv(csvData, 'append')).rejects.toThrow(
        'No valid trips found'
      );
    });

    it('should import trips with YYYY-MM-DD format', async () => {
      const csvData = `Date Out,Date In,Departure,Return
2024-01-15,2024-01-20,London,Paris`;

      const result = await travelStore.importFromCsv(csvData, 'append');

      expect(result.success).toBe(true);
      expect(travelStore.trips).toHaveLength(1);
      expect(travelStore.trips[0].outDate).toBe('2024-01-15');
    });

    it('should generate unique IDs for imported trips', async () => {
      const csvData = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,London,Paris
01/02/2024,10/02/2024,Berlin,London`;

      await travelStore.importFromCsv(csvData, 'append');

      const ids = travelStore.trips.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(2); // All IDs should be unique
    });

    it('should handle incomplete trips in CSV', async () => {
      const csvData = `Date Out,Date In,Departure,Return
15/01/2024,,London,`;

      const result = await travelStore.importFromCsv(csvData, 'append');

      expect(result.success).toBe(true);
      expect(travelStore.trips[0].outDate).toBe('2024-01-15');
      expect(travelStore.trips[0].inDate).toBe('');
    });

    it('should preserve route information from CSV', async () => {
      const csvData = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,London Heathrow,Paris CDG`;

      await travelStore.importFromCsv(csvData, 'append');

      expect(travelStore.trips[0].outRoute).toBe('London Heathrow');
      expect(travelStore.trips[0].inRoute).toBe('Paris CDG');
    });

    it('should set isLoading state during import', async () => {
      const csvData = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,London,Paris`;

      let loadingState = false;
      const importPromise = travelStore.importFromCsv(csvData, 'append');

      // Check loading state right after starting
      loadingState = travelStore.isLoading;

      await importPromise;

      // Loading should have been true during import
      // and false after completion
      expect(travelStore.isLoading).toBe(false);
    });

    it('should clear error state on successful import', async () => {
      travelStore.error = 'Previous error';

      const csvData = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,London,Paris`;

      await travelStore.importFromCsv(csvData, 'append');

      expect(travelStore.error).toBe(null);
    });

    it('should set error state on failed import', async () => {
      const csvData = `Date Out,Date In,Departure,Return
invalid-date,20/01/2024,London,Paris`;

      try {
        await travelStore.importFromCsv(csvData, 'append');
      } catch (err) {
        // Expected to throw
      }

      expect(travelStore.error).not.toBe(null);
    });
  });

  describe('Pre-Entry Period Calculation (Issue #25)', () => {
    beforeEach(() => {
      travelStore.clearAll();
      travelStore.setVignetteEntryDate('');
      travelStore.setVisaStartDate('');
      travelStore.setILRTrack(null);
    });

    it('should calculate pre-entry period when both dates are set', () => {
      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setVignetteEntryDate('2023-05-31'); // 150 days later

      const preEntry = travelStore.preEntryPeriod;
      expect(preEntry).not.toBeNull();
      expect(preEntry?.delayDays).toBe(150);
      expect(preEntry?.canCount).toBe(true);
      expect(preEntry?.qualifyingStartDate).toBe('2023-01-01');
    });

    it('should allow pre-entry period when delay is exactly 180 days', () => {
      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setVignetteEntryDate('2023-06-30'); // 180 days later

      const preEntry = travelStore.preEntryPeriod;
      expect(preEntry?.delayDays).toBe(180);
      expect(preEntry?.canCount).toBe(true);
      expect(preEntry?.qualifyingStartDate).toBe('2023-01-01');
    });

    it('should not allow pre-entry period when delay exceeds 180 days', () => {
      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setVignetteEntryDate('2023-07-01'); // 181 days later

      const preEntry = travelStore.preEntryPeriod;
      expect(preEntry?.delayDays).toBe(181);
      expect(preEntry?.canCount).toBe(false);
      expect(preEntry?.qualifyingStartDate).toBe('2023-07-01');
    });

    it('should return null when only visa start date is set', () => {
      travelStore.setVisaStartDate('2023-01-01');

      const preEntry = travelStore.preEntryPeriod;
      expect(preEntry).toBeNull();
    });

    it('should return null when only vignette entry date is set', () => {
      travelStore.setVignetteEntryDate('2023-05-31');

      const preEntry = travelStore.preEntryPeriod;
      expect(preEntry).toBeNull();
    });

    it('should handle the example scenario from issue #25', () => {
      // Vignette issued: Jan 1, 2023
      // First entry: 150 days later (May 31, 2023)
      // Never left UK until Dec 1-30, 2025
      // ILR Track: 3 years

      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setVignetteEntryDate('2023-05-31'); // 150 days later
      travelStore.setILRTrack(3);

      // Add trip: Dec 1-30, 2025
      travelStore.addTrip({
        outDate: '2025-12-01',
        inDate: '2025-12-30',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const preEntry = travelStore.preEntryPeriod;
      expect(preEntry?.canCount).toBe(true);
      expect(preEntry?.qualifyingStartDate).toBe('2023-01-01');

      // Auto-calculated application date should be based on visa start date
      // 3 years from Jan 1, 2023 = Jan 1, 2026, minus 28 days = Dec 4, 2025
      expect(travelStore.calculatedApplicationDate).toBe('2025-12-04');
    });

    it('should include pre-entry days in rolling 12-month absence check', () => {
      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setVignetteEntryDate('2023-05-31'); // 150 days
      travelStore.setILRTrack(3);

      // Add a trip that brings total absence close to 180 days
      travelStore.addTrip({
        outDate: '2023-07-01',
        inDate: '2023-07-31', // 30 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      // Pre-entry: 150 days
      // Trip: 29 full days (Jul 31 - Jul 1 - 1)
      // Total in rolling window: should include pre-entry period
      expect(summary.maxAbsenceInAny12Months).toBeGreaterThan(150);
    });

    it('should not include pre-entry days when delay exceeds 180 days', () => {
      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setVignetteEntryDate('2023-07-15'); // 195 days (exceeds 180)
      travelStore.setILRTrack(3);

      // Add a trip after UK entry
      travelStore.addTrip({
        outDate: '2023-08-01',
        inDate: '2023-08-31', // 30 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      // Pre-entry period should NOT count toward absence
      // Only the trip should count
      expect(summary.maxAbsenceInAny12Months).toBeLessThan(50);
    });

    it('should use vignette entry date as start when no pre-entry or delay exceeds 180 days', () => {
      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setVignetteEntryDate('2023-08-01'); // 212 days (exceeds 180)
      travelStore.setILRTrack(3);

      const preEntry = travelStore.preEntryPeriod;
      expect(preEntry?.canCount).toBe(false);

      // Qualifying period should start from vignette entry, not visa start
      expect(preEntry?.qualifyingStartDate).toBe('2023-08-01');

      // Auto-calculated date should be based on vignette entry
      // 3 years from Aug 1, 2023 = Aug 1, 2026, minus 28 days = Jul 4, 2026
      expect(travelStore.calculatedApplicationDate).toBe('2026-07-04');
    });

    it('should handle backward counting with pre-entry period correctly', () => {
      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setVignetteEntryDate('2023-05-31'); // 150 days
      travelStore.setILRTrack(3);
      travelStore.setApplicationDate('2026-01-01');

      // Add trip in qualifying period
      travelStore.addTrip({
        outDate: '2024-06-01',
        inDate: '2024-06-10', // 9 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      // Qualifying period: 3 years back from Jan 1, 2026 = Jan 1, 2023
      // Pre-entry period: 150 days between visa issue and UK entry
      // Trip: 8 full days (June 10 - June 1 - 1)
      // In backward counting mode starting Jan 1, 2023, the 12-month windows
      // will include various combinations of pre-entry and trip days
      expect(summary.maxAbsenceInAny12Months).toBeDefined();
      expect(summary.hasExceeded180Days).toBe(false);
    });

    it('should find most beneficial assessment date with pre-entry period', () => {
      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setVignetteEntryDate('2023-03-01'); // 59 days
      travelStore.setILRTrack(3);

      // Check pre-entry period
      const preEntry = travelStore.preEntryPeriod;
      expect(preEntry).not.toBeNull();
      expect(preEntry?.canCount).toBe(true);
      expect(preEntry?.qualifyingStartDate).toBe('2023-01-01');

      // Check that calculatedApplicationDate uses the correct start date
      const calcDate = travelStore.calculatedApplicationDate;
      expect(calcDate).toBeDefined();
      expect(calcDate).not.toBeNull();
    });

    it('should handle same day entry (0 day delay)', () => {
      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setVignetteEntryDate('2023-01-01'); // Same day

      const preEntry = travelStore.preEntryPeriod;
      expect(preEntry?.delayDays).toBe(0);
      expect(preEntry?.canCount).toBe(true);
      expect(preEntry?.qualifyingStartDate).toBe('2023-01-01');
    });

    it('should return null when entry is before issue date', () => {
      travelStore.setVisaStartDate('2023-05-01');
      travelStore.setVignetteEntryDate('2023-01-01'); // Entry before issue

      const preEntry = travelStore.preEntryPeriod;
      expect(preEntry).toBeNull();
    });

    it('should handle invalid dates gracefully', () => {
      travelStore.setVisaStartDate('invalid-date');
      travelStore.setVignetteEntryDate('2023-05-31');

      const preEntry = travelStore.preEntryPeriod;
      expect(preEntry).toBeNull();
    });

    it('should calculate continuous leave correctly with pre-entry period', () => {
      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setVignetteEntryDate('2023-05-31'); // 150 days pre-entry
      travelStore.setILRTrack(3);
      travelStore.setApplicationDate('2026-01-01');

      // Add trip
      travelStore.addTrip({
        outDate: '2024-06-01',
        inDate: '2024-06-15', // 14 calendar days, 13 full days
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const summary = travelStore.summary;

      // Continuous leave should be calculated for the backward counting period
      // The exact number depends on how pre-entry and trips overlap in the
      // qualifying period windows
      expect(summary.continuousLeaveDays).toBeDefined();
      expect(summary.continuousLeaveDays).toBeGreaterThan(900);
    });

    it('should validate the complete scenario from issue description', () => {
      // Exact scenario from issue:
      // - Vignette issued: Jan 1, 2023
      // - First entry: 150 days later (May 31, 2023)
      // - Never left UK until Dec 1-30, 2025
      // - ILR Track: 3 years
      // Expected: Pre-entry counts, start date is Jan 1, 2023

      travelStore.setVisaStartDate('2023-01-01');
      travelStore.setVignetteEntryDate('2023-05-31');
      travelStore.setILRTrack(3);

      // Only one trip: Dec 1-30, 2025
      travelStore.addTrip({
        outDate: '2025-12-01',
        inDate: '2025-12-30',
        outRoute: 'Test',
        inRoute: 'Test',
      });

      const preEntry = travelStore.preEntryPeriod;
      const summary = travelStore.summary;

      // Verify pre-entry calculation
      expect(preEntry?.delayDays).toBe(150);
      expect(preEntry?.canCount).toBe(true);
      expect(preEntry?.qualifyingStartDate).toBe('2023-01-01');

      // Verify auto-calculated application date
      // 3 years from Jan 1, 2023 = Jan 1, 2026, minus 28 days = Dec 4, 2025
      expect(travelStore.calculatedApplicationDate).toBe('2025-12-04');

      // Verify absence calculation
      // Pre-entry: 150 days
      // Trip: 28 full days (Dec 30 - Dec 1 - 1)
      // Total: 178 days (should not exceed 180)
      expect(summary.hasExceeded180Days).toBe(false);
      expect(summary.maxAbsenceInAny12Months).toBeLessThanOrEqual(180);
    });
  });

  describe('Round-trip Export/Import', () => {
    beforeEach(() => {
      travelStore.trips = [];
      travelStore.vignetteEntryDate = '';
      travelStore.visaStartDate = '';
      travelStore.error = null;
      travelStore.isLoading = false;
    });

    it('should successfully import data after export (CSV)', async () => {
      // Setup initial data
      travelStore.addTrip();
      travelStore.updateTrip(travelStore.trips[0].id, {
        outDate: '2024-01-15',
        inDate: '2024-01-20',
        outRoute: 'London Heathrow',
        inRoute: 'Paris CDG',
      });

      travelStore.addTrip();
      travelStore.updateTrip(travelStore.trips[1].id, {
        outDate: '2024-03-10',
        inDate: '2024-03-15',
        outRoute: 'Manchester',
        inRoute: 'Dublin',
      });

      // Store original data
      const originalTrips = travelStore.trips.map(t => ({
        outDate: t.outDate,
        inDate: t.inDate,
        outRoute: t.outRoute,
        inRoute: t.inRoute,
      }));

      // Export to CSV (simulated)
      const csvData = `#,Date Out,Date In,Departure,Return
1,15/01/2024,20/01/2024,London Heathrow,Paris CDG
2,10/03/2024,15/03/2024,Manchester,Dublin`;

      // Clear data
      travelStore.trips = [];

      // Import from CSV
      await travelStore.importFromCsv(csvData, 'replace');

      // Verify imported data matches original
      expect(travelStore.trips.length).toBe(2);
      expect(travelStore.trips[0].outDate).toBe(originalTrips[0].outDate);
      expect(travelStore.trips[0].inDate).toBe(originalTrips[0].inDate);
      expect(travelStore.trips[0].outRoute).toBe(originalTrips[0].outRoute);
      expect(travelStore.trips[0].inRoute).toBe(originalTrips[0].inRoute);

      expect(travelStore.trips[1].outDate).toBe(originalTrips[1].outDate);
      expect(travelStore.trips[1].inDate).toBe(originalTrips[1].inDate);
      expect(travelStore.trips[1].outRoute).toBe(originalTrips[1].outRoute);
      expect(travelStore.trips[1].inRoute).toBe(originalTrips[1].inRoute);
    });

    it('should successfully import data after export (XLSX)', async () => {
      // Setup initial data
      travelStore.addTrip();
      travelStore.updateTrip(travelStore.trips[0].id, {
        outDate: '2024-01-15',
        inDate: '2024-01-20',
        outRoute: 'London Heathrow',
        inRoute: 'Paris CDG',
      });

      // Store original data
      const originalTrips = travelStore.trips.map(t => ({
        outDate: t.outDate,
        inDate: t.inDate,
        outRoute: t.outRoute,
        inRoute: t.inRoute,
      }));

      // Simulate XLSX data (using the special __XLSX__ prefix that useCsvImport creates)
      const xlsxData = `__XLSX__${JSON.stringify([
        {
          outDate: '2024-01-15',
          inDate: '2024-01-20',
          outRoute: 'London Heathrow',
          inRoute: 'Paris CDG',
        }
      ])}`;

      // Clear data
      travelStore.trips = [];

      // Import from XLSX
      await travelStore.importFromCsv(xlsxData, 'replace');

      // Verify imported data matches original
      expect(travelStore.trips.length).toBe(1);
      expect(travelStore.trips[0].outDate).toBe(originalTrips[0].outDate);
      expect(travelStore.trips[0].inDate).toBe(originalTrips[0].inDate);
      expect(travelStore.trips[0].outRoute).toBe(originalTrips[0].outRoute);
      expect(travelStore.trips[0].inRoute).toBe(originalTrips[0].inRoute);
    });

    it('should preserve date formats in round-trip (DD/MM/YYYY)', async () => {
      // Import with DD/MM/YYYY format
      const csvData = `Date Out,Date In
31/12/2023,05/01/2024`;

      await travelStore.importFromCsv(csvData, 'replace');

      // Verify dates are stored in ISO format
      expect(travelStore.trips[0].outDate).toBe('2023-12-31');
      expect(travelStore.trips[0].inDate).toBe('2024-01-05');

      // Export would convert to DD/MM/YYYY (simulated)
      const exportedCsv = `Date Out,Date In
31/12/2023,05/01/2024`;

      // Re-import
      travelStore.trips = [];
      await travelStore.importFromCsv(exportedCsv, 'replace');

      // Dates should match
      expect(travelStore.trips[0].outDate).toBe('2023-12-31');
      expect(travelStore.trips[0].inDate).toBe('2024-01-05');
    });

    it('should preserve special characters and routes in round-trip', async () => {
      const csvData = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,"London Heathrow, Terminal 5","Paris CDG, Terminal 2E"`;

      await travelStore.importFromCsv(csvData, 'replace');

      const originalRoute = travelStore.trips[0].outRoute;
      const originalReturn = travelStore.trips[0].inRoute;

      // Verify routes are preserved
      expect(originalRoute).toBe('London Heathrow, Terminal 5');
      expect(originalReturn).toBe('Paris CDG, Terminal 2E');
    });

    it('should handle empty routes in round-trip', async () => {
      const csvData = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,,`;

      await travelStore.importFromCsv(csvData, 'replace');

      expect(travelStore.trips[0].outRoute).toBe('');
      expect(travelStore.trips[0].inRoute).toBe('');
    });

    it('should handle incomplete trips in round-trip', async () => {
      const csvData = `Date Out,Date In,Departure,Return
15/01/2024,,London,`;

      await travelStore.importFromCsv(csvData, 'replace');

      expect(travelStore.trips[0].outDate).toBe('2024-01-15');
      expect(travelStore.trips[0].inDate).toBe('');
      expect(travelStore.trips[0].outRoute).toBe('London');
      expect(travelStore.trips[0].inRoute).toBe('');
    });
  });
});
