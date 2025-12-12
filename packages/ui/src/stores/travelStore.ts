import { makeAutoObservable, runInAction } from 'mobx';
import {
  differenceInDays,
  addYears,
  subDays,
  addDays,
  parseISO,
  format,
} from 'date-fns';

export interface TripRecord {
  id: string;
  outDate: string;
  inDate: string;
  outRoute: string;
  inRoute: string;
}

export interface TripWithCalculations extends TripRecord {
  calendarDays: number | null;
  fullDays: number | null;
  isIncomplete: boolean;
}

export interface RollingDataPoint {
  date: string;
  rollingDays: number;
  riskLevel: 'low' | 'caution' | 'critical';
  formattedDate: string;
}

export interface TimelinePoint {
  date: string;
  daysSinceStart: number;
  tripCount: number;
  formattedDate: string;
}

export interface TripBar {
  date: string;
  tripStart: number;
  tripEnd: number;
  tripDuration: number;
  tripLabel: string;
  formattedDate: string;
  outDate: string;
  inDate: string;
}

export type ILRTrack = 2 | 3 | 5 | 10;

// Constants for UK Home Office guidance
const MAX_ALLOWABLE_PRE_ENTRY_DAYS = 180; // Maximum days between visa issue and UK entry that can count toward qualifying period
const MAX_ABSENCE_IN_12_MONTHS = 180; // Maximum days allowed outside UK in any rolling 12-month period

// Interface for pre-entry period information
export interface PreEntryPeriodInfo {
  hasPreEntry: boolean;
  delayDays: number;
  canCount: boolean;
  qualifyingStartDate: string | null;
}

class TravelStore {
  trips: TripRecord[] = [];
  vignetteEntryDate = '';
  visaStartDate = '';
  ilrTrack: ILRTrack | null = null; // 2, 3, or 5 year track
  applicationDate = ''; // Date of ILR application for backward counting
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  get tripsWithCalculations(): TripWithCalculations[] {
    return this.trips.map((trip) => {
      const outDate = trip.outDate ? new Date(trip.outDate) : null;
      const inDate = trip.inDate ? new Date(trip.inDate) : null;
      const isIncomplete =
        !outDate ||
        !inDate ||
        isNaN(outDate.getTime()) ||
        isNaN(inDate.getTime());

      let calendarDays: number | null = null;
      let fullDays: number | null = null;

      if (outDate && inDate && !isIncomplete) {
        calendarDays = differenceInDays(inDate, outDate);
        fullDays = Math.max(0, calendarDays - 1);
      }

      return {
        ...trip,
        calendarDays,
        fullDays,
        isIncomplete,
      };
    });
  }

  // Computed property: Pre-entry period information
  // Per UK Home Office guidance: The period between entry clearance issuance (visa start)
  // and actual UK entry (vignette entry) can count toward the qualifying period if ≤180 days.
  // This pre-entry period is treated as an absence for the 180-day rolling window check.
  get preEntryPeriod(): PreEntryPeriodInfo | null {
    // Pre-entry period exists when both visa start date and vignette entry date are set
    if (!this.visaStartDate || !this.vignetteEntryDate) {
      return null;
    }

    const visaStart = new Date(this.visaStartDate);
    const vignetteEntry = new Date(this.vignetteEntryDate);

    if (isNaN(visaStart.getTime()) || isNaN(vignetteEntry.getTime())) {
      return null;
    }

    // Calculate delay between entry clearance issue and UK entry
    // NOTE: Unlike trip calculations (which use differenceInDays - 1), pre-entry period
    // uses the full day count because we're measuring the entire period between two events,
    // not counting absence days that exclude departure/arrival days.
    const delayDays = differenceInDays(vignetteEntry, visaStart);

    // If delay is negative (entry before issue), this is invalid data - return null
    // This should be surfaced to the user as a data validation error
    if (delayDays < 0) {
      return null;
    }

    // Per Home Office guidance: If delay ≤ 180 days, pre-entry can count toward qualifying period
    const canCount = delayDays <= MAX_ALLOWABLE_PRE_ENTRY_DAYS;

    // Qualifying start date: visa start if can count, otherwise vignette entry
    const qualifyingStartDate = canCount
      ? this.visaStartDate
      : this.vignetteEntryDate;

    return {
      hasPreEntry: true,
      delayDays,
      canCount,
      qualifyingStartDate,
    };
  }

  // Computed property: Auto-calculated earliest application date based on ILR track
  get calculatedApplicationDate(): string | null {
    if (!this.ilrTrack) return null;

    // Determine the qualifying period start date
    let qualifyingStart: string | null = null;

    // Check if there's a pre-entry period
    const preEntry = this.preEntryPeriod;
    if (preEntry && preEntry.qualifyingStartDate) {
      qualifyingStart = preEntry.qualifyingStartDate;
    } else {
      // Use vignette entry date if available, otherwise visa start date
      qualifyingStart = this.vignetteEntryDate || this.visaStartDate;
    }

    if (!qualifyingStart) return null;

    const start = new Date(qualifyingStart);
    if (isNaN(start.getTime())) return null;

    // Calculate: qualifying start + required years - 28 days
    const requiredEndDate = addYears(start, this.ilrTrack);
    const earliestApplicationDate = subDays(requiredEndDate, 28);

    return earliestApplicationDate.toISOString().split('T')[0];
  }

  // Get the effective application date (manual override or calculated)
  get effectiveApplicationDate(): string | null {
    // If user has manually set an application date, use that
    if (this.applicationDate) return this.applicationDate;

    // Otherwise, use the calculated date
    return this.calculatedApplicationDate;
  }

  get summary() {
    const tripsCalc = this.tripsWithCalculations;
    const complete = tripsCalc.filter((t) => !t.isIncomplete);
    const totalFullDays = complete.reduce(
      (sum, t) => sum + (t.fullDays || 0),
      0
    );

    // Calculate continuous leave and check rolling 12-month periods
    let continuousLeaveDays: number | null = null;
    let maxAbsenceInAny12Months: number | null = null;
    let hasExceeded180Days = false;
    let ilrEligibilityDate: string | null = null;
    let daysUntilEligible: number | null = null;

    // Determine the qualifying period start date using pre-entry logic
    let qualifyingStartDate: Date | null = null;
    const preEntry = this.preEntryPeriod;

    if (preEntry && preEntry.qualifyingStartDate) {
      qualifyingStartDate = new Date(preEntry.qualifyingStartDate);
    } else {
      const visaStart = this.vignetteEntryDate || this.visaStartDate;
      if (visaStart) {
        qualifyingStartDate = new Date(visaStart);
      }
    }

    if (qualifyingStartDate && !isNaN(qualifyingStartDate.getTime())) {
      // Per Home Office guidance: Always count backward from most beneficial date
      // (application date, decision date, or up to 28 days after application)

      const appDateStr = this.effectiveApplicationDate;

      if (appDateStr && this.ilrTrack) {
        // BACKWARD COUNTING MODE (Home Office algorithm)
        const appDate = new Date(appDateStr);

        if (!isNaN(appDate.getTime())) {
          // Find the most beneficial assessment date within the allowed range
          // Try: application date, and up to 28 days after
          const assessmentDates = [appDate];
          for (let i = 1; i <= 28; i++) {
            assessmentDates.push(addDays(appDate, i));
          }

          // For each potential assessment date, count backward and check compliance
          let bestResult: {
            assessmentDate: Date;
            qualifyingPeriodStart: Date;
            maxAbsence: number;
            continuousDays: number;
          } | null = null;

          for (const assessDate of assessmentDates) {
            // Count backward by the required number of years
            const qualifyingStart = subDays(
              addYears(assessDate, -this.ilrTrack),
              0
            );

            // Skip if qualifying period starts before visa start
            if (qualifyingStart < qualifyingStartDate) continue;

            // Calculate absences in this qualifying period
            const maxAbsence = this.calculateMaxAbsenceInRolling12Months(
              qualifyingStart,
              assessDate
            );

            // Calculate continuous days in UK during this period
            const totalDaysInPeriod = differenceInDays(assessDate, qualifyingStart);

            // Calculate total full days outside UK in this period
            const absenceInPeriod = complete
              .filter((trip) => {
                const tripOut = new Date(trip.outDate);
                const tripIn = new Date(trip.inDate);
                return tripIn >= qualifyingStart && tripOut <= assessDate;
              })
              .reduce((sum, trip) => {
                const tripOut = new Date(trip.outDate);
                const tripIn = new Date(trip.inDate);

                // Calculate intersection with qualifying period
                const effectiveStart = tripOut > qualifyingStart ? tripOut : qualifyingStart;
                const effectiveEnd = tripIn < assessDate ? tripIn : assessDate;

                if (effectiveStart <= effectiveEnd) {
                  const absenceStart = addDays(effectiveStart, effectiveStart === tripOut ? 1 : 0);
                  const absenceEnd = subDays(effectiveEnd, effectiveEnd === tripIn ? 1 : 0);

                  if (absenceStart <= absenceEnd) {
                    return sum + differenceInDays(absenceEnd, absenceStart) + 1;
                  }
                }
                return sum;
              }, 0);

            const continuousDays = totalDaysInPeriod - absenceInPeriod;

            // Keep the result with lowest max absence (most beneficial)
            if (!bestResult || maxAbsence < bestResult.maxAbsence) {
              bestResult = {
                assessmentDate: assessDate,
                qualifyingPeriodStart: qualifyingStart,
                maxAbsence,
                continuousDays,
              };
            }
          }

          if (bestResult) {
            maxAbsenceInAny12Months = bestResult.maxAbsence;
            hasExceeded180Days = bestResult.maxAbsence > MAX_ABSENCE_IN_12_MONTHS;
            continuousLeaveDays = bestResult.continuousDays;

            // ILR eligibility is the effective application date
            ilrEligibilityDate = appDateStr;
            daysUntilEligible = differenceInDays(appDate, new Date());
          }
        }
      }
    }

    return {
      totalTrips: tripsCalc.length,
      completeTrips: complete.length,
      incompleteTrips: tripsCalc.length - complete.length,
      totalFullDays,
      continuousLeaveDays,
      maxAbsenceInAny12Months,
      hasExceeded180Days,
      ilrEligibilityDate,
      daysUntilEligible,
    };
  }

  // Calculate maximum absence in any rolling 12-month period
  // Per Home Office guidance: no more than 180 days' absences in a rolling 12-month period
  private calculateMaxAbsenceInRolling12Months(
    startDate: Date,
    endDate: Date
  ): number {
    const completeTrips = this.tripsWithCalculations.filter(
      (t) => !t.isIncomplete
    );

    let maxAbsence = 0;

    // Get pre-entry period info
    const preEntry = this.preEntryPeriod;

    // Optimize by only checking relevant dates: trip start dates and key milestones
    const checkDates: Date[] = [new Date(startDate)];

    // Add pre-entry start date if applicable
    if (preEntry && preEntry.canCount && this.visaStartDate) {
      const visaStart = new Date(this.visaStartDate);
      if (visaStart >= startDate) {
        checkDates.push(visaStart);
      }
    }

    // Add all trip departure dates as potential 12-month period starts
    // Only add dates on or after the start date
    completeTrips.forEach((trip) => {
      const tripOutDate = new Date(trip.outDate);
      if (tripOutDate >= startDate) {
        checkDates.push(tripOutDate);
      }
    });

    // Check 12-month period from each relevant date
    checkDates.forEach((checkDate) => {
      if (checkDate > endDate) return;

      const periodEnd = new Date(checkDate);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      // Sum absences within this 12-month period
      let absenceDays = 0;

      // Add pre-entry period days if applicable
      if (preEntry && preEntry.canCount && this.visaStartDate && this.vignetteEntryDate) {
        const visaStart = new Date(this.visaStartDate);
        const vignetteEntry = new Date(this.vignetteEntryDate);

        // Pre-entry period is treated as absence
        // Check if pre-entry period overlaps with this 12-month window
        if (visaStart <= periodEnd && vignetteEntry >= checkDate) {
          const intersectionStart = visaStart > checkDate ? visaStart : checkDate;
          const intersectionEnd = vignetteEntry < periodEnd ? vignetteEntry : periodEnd;

          if (intersectionStart <= intersectionEnd) {
            const daysInIntersection = differenceInDays(intersectionEnd, intersectionStart);
            absenceDays += daysInIntersection;
          }
        }
      }

      // Add trip absences
      completeTrips.forEach((trip) => {
        const tripOut = new Date(trip.outDate);
        const tripIn = new Date(trip.inDate);

        // Per Home Office guidance: Person is absent on days BETWEEN departure and return
        // Absence period: [departureDate + 1 day, returnDate - 1 day] (inclusive)
        const absenceStart = addDays(tripOut, 1);
        const absenceEnd = subDays(tripIn, 1);

        // Check if absence period overlaps with this 12-month window
        if (absenceStart <= periodEnd && absenceEnd >= checkDate) {
          // Calculate intersection of absence period and window
          const intersectionStart =
            absenceStart > checkDate ? absenceStart : checkDate;
          const intersectionEnd =
            absenceEnd < periodEnd ? absenceEnd : periodEnd;

          if (intersectionStart <= intersectionEnd) {
            // Count days in intersection (inclusive of both boundaries)
            const daysInIntersection =
              differenceInDays(intersectionEnd, intersectionStart) + 1;
            absenceDays += daysInIntersection;
          }
        }
      });

      maxAbsence = Math.max(maxAbsence, absenceDays);
    });

    return maxAbsence;
  }

  // Helper to determine risk level based on days
  private getRiskLevel(days: number): 'low' | 'caution' | 'critical' {
    if (days >= MAX_ABSENCE_IN_12_MONTHS) return 'critical';
    if (days >= 150) return 'caution';
    return 'low';
  }

  // Computed property: Rolling 12-month absence data for charts
  get rollingAbsenceData(): RollingDataPoint[] {
    const startDate = this.vignetteEntryDate || this.visaStartDate;

    if (!startDate) {
      return [];
    }

    const start = parseISO(startDate);
    const today = new Date();
    const totalDays = differenceInDays(today, start);

    // Validate range
    if (totalDays < 0 || totalDays > 3650) {
      return [];
    }

    const completeTrips = this.tripsWithCalculations.filter(
      (t) => !t.isIncomplete
    );
    const rollingPoints: RollingDataPoint[] = [];

    // Sample every week for performance (max 200 points)
    const sampleInterval = Math.max(1, Math.floor(totalDays / 200));

    for (let i = 0; i <= totalDays; i += sampleInterval) {
      const currentDate = addDays(start, i);
      const windowStart = addDays(currentDate, -365);

      // Calculate absences in the 12-month window ending on currentDate
      let absenceDays = 0;

      completeTrips.forEach((trip) => {
        const tripOut = parseISO(trip.outDate);
        const tripIn = parseISO(trip.inDate);

        // Per Home Office guidance: Person is absent on days BETWEEN departure and return
        const absenceStart = addDays(tripOut, 1);
        const absenceEnd = subDays(tripIn, 1);

        // Check if absence period overlaps with the 12-month window
        if (absenceStart <= currentDate && absenceEnd >= windowStart) {
          const intersectionStart =
            absenceStart > windowStart ? absenceStart : windowStart;
          const intersectionEnd =
            absenceEnd < currentDate ? absenceEnd : currentDate;

          if (intersectionStart <= intersectionEnd) {
            const daysInIntersection =
              differenceInDays(intersectionEnd, intersectionStart) + 1;
            absenceDays += daysInIntersection;
          }
        }
      });

      rollingPoints.push({
        date: currentDate.toISOString(),
        rollingDays: absenceDays,
        riskLevel: this.getRiskLevel(absenceDays),
        formattedDate: format(currentDate, 'dd/MM/yyyy'),
      });
    }

    // Add final point (today) if not already included
    if (totalDays % sampleInterval !== 0) {
      const windowStart = addDays(today, -365);
      let absenceDays = 0;

      completeTrips.forEach((trip) => {
        const tripOut = parseISO(trip.outDate);
        const tripIn = parseISO(trip.inDate);

        // Per Home Office guidance: Person is absent on days BETWEEN departure and return
        const absenceStart = addDays(tripOut, 1);
        const absenceEnd = subDays(tripIn, 1);

        if (absenceStart <= today && absenceEnd >= windowStart) {
          const intersectionStart =
            absenceStart > windowStart ? absenceStart : windowStart;
          const intersectionEnd = absenceEnd < today ? absenceEnd : today;

          if (intersectionStart <= intersectionEnd) {
            const daysInIntersection =
              differenceInDays(intersectionEnd, intersectionStart) + 1;
            absenceDays += daysInIntersection;
          }
        }
      });

      rollingPoints.push({
        date: today.toISOString(),
        rollingDays: absenceDays,
        riskLevel: this.getRiskLevel(absenceDays),
        formattedDate: format(today, 'dd/MM/yyyy'),
      });
    }

    return rollingPoints;
  }

  // Computed property: Timeline points for trip visualization
  get timelinePoints(): TimelinePoint[] {
    const startDate = this.vignetteEntryDate || this.visaStartDate;

    if (!startDate) {
      return [];
    }

    const start = parseISO(startDate);
    const today = new Date();
    const totalDays = differenceInDays(today, start);

    if (totalDays < 0 || totalDays > 3650) {
      return [];
    }

    const completeTrips = this.tripsWithCalculations.filter(
      (t) => !t.isIncomplete
    );
    const timelinePoints: TimelinePoint[] = [];

    for (let i = 0; i <= totalDays; i++) {
      const currentDate = addDays(start, i);
      const dateStr = currentDate.toISOString().split('T')[0];

      // Check which trips are active on this date
      const activeTrips = completeTrips.filter((trip) => {
        const tripOut = parseISO(trip.outDate);
        const tripIn = parseISO(trip.inDate);
        return currentDate >= tripOut && currentDate <= tripIn;
      });

      timelinePoints.push({
        date: dateStr,
        daysSinceStart: i,
        tripCount: activeTrips.length,
        formattedDate: format(currentDate, 'dd/MM/yyyy'),
      });
    }

    return timelinePoints;
  }

  // Computed property: Trip bars for horizontal timeline visualization
  get tripBars(): TripBar[] {
    const startDate = this.vignetteEntryDate || this.visaStartDate;

    if (!startDate) {
      return [];
    }

    const start = parseISO(startDate);
    const completeTrips = this.tripsWithCalculations.filter(
      (t) => !t.isIncomplete
    );

    return completeTrips.map((trip) => {
      const tripOutDate = parseISO(trip.outDate);
      const tripInDate = parseISO(trip.inDate);
      const tripStart = differenceInDays(tripOutDate, start);
      const tripEnd = differenceInDays(tripInDate, start);

      return {
        date: trip.outDate,
        tripStart,
        tripEnd,
        tripDuration: trip.fullDays || 0,
        tripLabel: `${trip.outRoute || 'Unknown'} → ${
          trip.inRoute || 'Unknown'
        }`,
        formattedDate: format(tripOutDate, 'dd/MM/yyyy'),
        outDate: trip.outDate,
        inDate: trip.inDate,
      };
    });
  }

  generateId(): string {
    return `trip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  addTrip(trip?: Partial<TripRecord>) {
    const newTrip: TripRecord = {
      id: this.generateId(),
      outDate: trip?.outDate || '',
      inDate: trip?.inDate || '',
      outRoute: trip?.outRoute || '',
      inRoute: trip?.inRoute || '',
    };
    this.trips.push(newTrip);
    return newTrip;
  }

  updateTrip(id: string, updates: Partial<TripRecord>) {
    const index = this.trips.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.trips[index] = { ...this.trips[index], ...updates };
    }
  }

  deleteTrip(id: string) {
    this.trips = this.trips.filter((t) => t.id !== id);
  }

  clearAll() {
    this.trips = [];
  }

  setTrips(trips: TripRecord[]) {
    this.trips = trips;
  }

  setVignetteEntryDate(date: string) {
    this.vignetteEntryDate = date;
  }

  setVisaStartDate(date: string) {
    this.visaStartDate = date;
  }

  setILRTrack(track: ILRTrack | null) {
    this.ilrTrack = track;
  }

  setApplicationDate(date: string) {
    this.applicationDate = date;
  }

  reorderTrip(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= this.trips.length) return;
    if (toIndex < 0 || toIndex >= this.trips.length) return;

    const newTrips = [...this.trips];
    const [movedTrip] = newTrips.splice(fromIndex, 1);
    newTrips.splice(toIndex, 0, movedTrip);
    this.trips = newTrips;
  }

  async importFromPdf(file: File): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('responseType', 'json');

      const response = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse file');
      }

      runInAction(() => {
        const importedTrips: TripRecord[] = data.data.trips.map(
          (
            trip: Partial<TripRecord> & { outDate?: string; inDate?: string }
          ) => ({
            id: this.generateId(),
            outDate: trip.outDate ? trip.outDate.split('T')[0] : '',
            inDate: trip.inDate ? trip.inDate.split('T')[0] : '',
            outRoute: trip.outRoute || '',
            inRoute: trip.inRoute || '',
          })
        );

        this.trips = [...this.trips, ...importedTrips];
        this.isLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : 'Failed to import PDF';
        this.isLoading = false;
      });
      throw err;
    }
  }

  async exportToExcel(): Promise<Blob> {
    const formData = new FormData();

    // Create a payload with trips and metadata
    const exportData = {
      trips: this.tripsWithCalculations,
      vignetteEntryDate: this.vignetteEntryDate,
      visaStartDate: this.visaStartDate,
      ilrTrack: this.ilrTrack,
      summary: this.summary,
    };

    formData.append('tripsData', JSON.stringify(exportData));
    formData.append('responseType', 'excel');

    const response = await fetch('/api/export', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to export');
    }

    return response.blob();
  }

  async importFromCsv(
    csvText: string,
    mode: 'replace' | 'append' = 'append'
  ): Promise<{ success: boolean; message: string; tripCount: number }> {
    this.isLoading = true;
    this.error = null;

    try {
      let result;

      // Check if this is XLSX data (marked with special prefix from useCsvImport)
      if (csvText.startsWith('__XLSX__')) {
        const tripsJson = csvText.substring(8); // Remove __XLSX__ prefix
        const trips = JSON.parse(tripsJson);
        result = {
          success: true,
          trips,
          errors: [],
          warnings: [],
        };
      } else {
        // Parse as CSV
        const { parseCsvText } = await import('@uth/parser');
        result = parseCsvText(csvText);
      }

      if (!result.success) {
        throw new Error(result.errors.join('\n'));
      }

      if (result.trips.length === 0) {
        throw new Error('No valid trips found');
      }

      runInAction(() => {
        const importedTrips: TripRecord[] = result.trips.map((trip: { outDate: string; inDate: string; outRoute?: string; inRoute?: string }) => ({
          id: this.generateId(),
          outDate: trip.outDate,
          inDate: trip.inDate,
          outRoute: trip.outRoute || '',
          inRoute: trip.inRoute || '',
        }));

        if (mode === 'replace') {
          this.trips = importedTrips;
        } else {
          this.trips = [...this.trips, ...importedTrips];
        }

        this.isLoading = false;
      });

      return {
        success: true,
        message: result.warnings.length > 0
          ? `Imported ${result.trips.length} trips with warnings: ${result.warnings.join('; ')}`
          : `Successfully imported ${result.trips.length} trips`,
        tripCount: result.trips.length,
      };
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : 'Failed to import';
        this.isLoading = false;
      });
      throw err;
    }
  }

  // Note: This method is deprecated. Use importFromCsv directly with clipboard text.
  // Kept for backward compatibility but not recommended.
  async importFromClipboard(
    mode: 'replace' | 'append' = 'append'
  ): Promise<{ success: boolean; message: string; tripCount: number }> {
    this.isLoading = true;
    this.error = null;

    try {
      // Read from clipboard
      const text = await navigator.clipboard.readText();

      if (!text || text.trim().length === 0) {
        throw new Error('Clipboard is empty');
      }

      // Use the same CSV parser
      return await this.importFromCsv(text, mode);
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : 'Failed to import from clipboard';
        this.isLoading = false;
      });
      throw err;
    }
  }
}

export const travelStore = new TravelStore();
