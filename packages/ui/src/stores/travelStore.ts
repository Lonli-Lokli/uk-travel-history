import { makeAutoObservable, runInAction } from 'mobx';
import { differenceInDays, addYears, subDays, addDays, parseISO, format } from 'date-fns';

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

    const startDate = this.vignetteEntryDate || this.visaStartDate;

    if (startDate) {
      const start = new Date(startDate);
      const today = new Date();

      if (!isNaN(start.getTime())) {
        // Total days since start date
        const totalDaysSinceStart = differenceInDays(today, start);

        // Days in UK = Total days - Days outside UK (full days)
        continuousLeaveDays = Math.max(0, totalDaysSinceStart - totalFullDays);

        // Check rolling 12-month periods for 180-day limit
        // Per Home Office guidance: absences are considered on a rolling basis
        maxAbsenceInAny12Months = this.calculateMaxAbsenceInRolling12Months(start, today);
        hasExceeded180Days = maxAbsenceInAny12Months > 180;

        // Calculate ILR eligibility date if track is selected
        // Per Home Office guidance (Page 10): "Applicants can submit a settlement application
        // up to 28 days before they would reach the end of the specified period"
        if (this.ilrTrack) {
          const requiredEndDate = addYears(start, this.ilrTrack);
          const earliestApplicationDate = subDays(requiredEndDate, 28);

          ilrEligibilityDate = earliestApplicationDate.toISOString().split('T')[0];
          daysUntilEligible = differenceInDays(earliestApplicationDate, today);
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
  private calculateMaxAbsenceInRolling12Months(startDate: Date, endDate: Date): number {
    const completeTrips = this.tripsWithCalculations.filter((t) => !t.isIncomplete);

    if (completeTrips.length === 0) return 0;

    let maxAbsence = 0;

    // Optimize by only checking relevant dates: trip start dates and key milestones
    const checkDates: Date[] = [new Date(startDate)];

    // Add all trip departure dates as potential 12-month period starts
    completeTrips.forEach((trip) => {
      checkDates.push(new Date(trip.outDate));
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

        // Check if trip overlaps with this 12-month period
        if (tripOut <= periodEnd && tripIn >= checkDate) {
          // Calculate overlap
          const overlapStart = tripOut > checkDate ? tripOut : checkDate;
          const overlapEnd = tripIn < periodEnd ? tripIn : periodEnd;

          if (overlapStart <= overlapEnd) {
            const overlapDays = differenceInDays(overlapEnd, overlapStart);
            // Per guidance: only count whole days, exclude departure and return
            absenceDays += Math.max(0, overlapDays - 1);
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

    const completeTrips = this.tripsWithCalculations.filter((t) => !t.isIncomplete);
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

        // Check if trip overlaps with the 12-month window
        if (tripOut <= currentDate && tripIn >= windowStart) {
          const overlapStart = tripOut > windowStart ? tripOut : windowStart;
          const overlapEnd = tripIn < currentDate ? tripIn : currentDate;

          if (overlapStart <= overlapEnd) {
            const overlapDays = differenceInDays(overlapEnd, overlapStart);
            absenceDays += Math.max(0, overlapDays - 1);
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

        if (tripOut <= today && tripIn >= windowStart) {
          const overlapStart = tripOut > windowStart ? tripOut : windowStart;
          const overlapEnd = tripIn < today ? tripIn : today;

          if (overlapStart <= overlapEnd) {
            const overlapDays = differenceInDays(overlapEnd, overlapStart);
            absenceDays += Math.max(0, overlapDays - 1);
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

    const completeTrips = this.tripsWithCalculations.filter((t) => !t.isIncomplete);
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
    const completeTrips = this.tripsWithCalculations.filter((t) => !t.isIncomplete);

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
        tripLabel: `${trip.outRoute || 'Unknown'} → ${trip.inRoute || 'Unknown'}`,
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
          (trip: Partial<TripRecord> & { outDate?: string; inDate?: string }) => ({
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
