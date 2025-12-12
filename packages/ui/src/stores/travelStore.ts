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

  // Computed property: Auto-calculated earliest application date based on ILR track
  get calculatedApplicationDate(): string | null {
    if (!this.ilrTrack) return null;

    const visaStart = this.vignetteEntryDate || this.visaStartDate;
    if (!visaStart) return null;

    const start = new Date(visaStart);
    if (isNaN(start.getTime())) return null;

    // Calculate: visa start + required years - 28 days
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

    const visaStart = this.vignetteEntryDate || this.visaStartDate;

    if (visaStart) {
      const start = new Date(visaStart);

      if (!isNaN(start.getTime())) {
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
              if (qualifyingStart < start) continue;

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
              hasExceeded180Days = bestResult.maxAbsence > 180;
              continuousLeaveDays = bestResult.continuousDays;

              // ILR eligibility is the effective application date
              ilrEligibilityDate = appDateStr;
              daysUntilEligible = differenceInDays(appDate, new Date());
            }
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

    if (completeTrips.length === 0) return 0;

    let maxAbsence = 0;

    // Optimize by only checking relevant dates: trip start dates and key milestones
    const checkDates: Date[] = [new Date(startDate)];

    // Add all trip departure dates as potential 12-month period starts
    // Only add dates on or after the visa/vignette start date
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
    if (days >= 180) return 'critical';
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
}

export const travelStore = new TravelStore();
