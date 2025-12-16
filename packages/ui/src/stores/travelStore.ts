import { makeAutoObservable, runInAction } from 'mobx';
import { format } from 'date-fns';
import {
  ILRTrack,
  PreEntryPeriodInfo,
  RollingDataPoint,
  TimelinePoint,
  TripBar,
  TripRecord,
  TripWithCalculations,
  TravelCalculationResult,
  calculateTravelData,
} from '@uth/calculators';

class TravelStore {
  trips: TripRecord[] = [];
  vignetteEntryDate = '';
  visaStartDate = '';
  ilrTrack: ILRTrack = 5;
  applicationDate = '';
  isLoading = false;
  error: string | null = null;
  selectedTripDetails: { name: string; start: string; end: string } | null =
    null;

  constructor() {
    makeAutoObservable(this);
  }

  // Check if minimum required fields are present before running calculation
  get hasRequiredFields(): boolean {
    return !!(
      this.vignetteEntryDate &&
      this.visaStartDate &&
      this.ilrTrack &&
      this.trips.every((t) => t.outDate && t.inDate)
    );
  }

  private get calculations(): TravelCalculationResult | null {
    // Gate calculation - return null if required fields missing
    if (!this.hasRequiredFields) {
      return null;
    }

    return calculateTravelData({
      trips: this.trips,
      vignetteEntryDate: this.vignetteEntryDate,
      visaStartDate: this.visaStartDate,
      ilrTrack: this.ilrTrack,
      applicationDateOverride: this.applicationDate,
    });
  }

  get tripsWithCalculations(): TripWithCalculations[] {
    return this.calculations?.tripsWithCalculations || [];
  }

  get preEntryPeriod(): PreEntryPeriodInfo | null {
    return this.calculations?.preEntryPeriod || null;
  }

  get validation() {
    return this.calculations?.validation || null;
  }

  get effectiveApplicationDate(): string | null {
    return this.validation?.status === 'ELIGIBLE'
      ? this.validation.applicationDate
      : null;
  }

  get autoDateUsed(): boolean {
    return this.calculations?.summary.autoDateUsed || false;
  }

  get summary() {
    return this.calculations?.summary || {
      totalTrips: this.trips.length,
      completeTrips: 0,
      incompleteTrips: this.trips.length,
      totalFullDays: 0,
      continuousLeaveDays: null,
      maxAbsenceInAny12Months: null,
      hasExceededAllowedAbsense: false,
      ilrEligibilityDate: null,
      daysUntilEligible: null,
      autoDateUsed: false,
    };
  }

  get rollingAbsenceData(): RollingDataPoint[] {
    return this.calculations?.rollingAbsenceData || [];
  }

  get timelinePoints(): TimelinePoint[] {
    return this.calculations?.timelinePoints || [];
  }

  get tripBars(): TripBar[] {
    return this.calculations?.tripBars || [];
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

  setILRTrack(track: ILRTrack) {
    this.ilrTrack = track;
  }

  setApplicationDate(date: string) {
    this.applicationDate = date;
  }

  setSelectedTripDetails(
    details: { name: string; start: string; end: string } | null,
  ) {
    this.selectedTripDetails = details;
  }

  selectTrip(name: string, startTimestamp: number, endTimestamp: number) {
    const startStr = format(new Date(startTimestamp), 'dd/MM/yyyy');
    const endStr = format(new Date(endTimestamp), 'dd/MM/yyyy');
    this.setSelectedTripDetails({ name, start: startStr, end: endStr });
  }

  clearSelectedTrip() {
    this.setSelectedTripDetails(null);
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
            trip: Partial<TripRecord> & { outDate?: string; inDate?: string },
          ) => ({
            id: this.generateId(),
            outDate: trip.outDate ? trip.outDate.split('T')[0] : '',
            inDate: trip.inDate ? trip.inDate.split('T')[0] : '',
            outRoute: trip.outRoute || '',
            inRoute: trip.inRoute || '',
          }),
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
    mode: 'replace' | 'append' = 'append',
  ): Promise<{ success: boolean; message: string; tripCount: number }> {
    this.isLoading = true;
    this.error = null;

    try {
      let result;

      if (csvText.startsWith('__XLSX__')) {
        const tripsJson = csvText.substring(8);
        const trips = JSON.parse(tripsJson);
        result = {
          success: true,
          trips,
          errors: [],
          warnings: [],
        };
      } else {
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
        const importedTrips: TripRecord[] = result.trips.map(
          (trip: {
            outDate: string;
            inDate: string;
            outRoute?: string;
            inRoute?: string;
          }) => ({
            id: this.generateId(),
            outDate: trip.outDate,
            inDate: trip.inDate,
            outRoute: trip.outRoute || '',
            inRoute: trip.inRoute || '',
          }),
        );

        if (mode === 'replace') {
          this.trips = importedTrips;
        } else {
          this.trips = [...this.trips, ...importedTrips];
        }

        this.isLoading = false;
      });

      return {
        success: true,
        message:
          result.warnings.length > 0
            ? `Imported ${result.trips.length} trips with warnings: ${result.warnings.join('; ')}`
            : `Successfully imported ${result.trips.length} trips`,
        tripCount: result.trips.length,
      };
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to import';
        this.isLoading = false;
      });
      throw err;
    }
  }

  async importFromClipboard(
    mode: 'replace' | 'append' = 'append',
  ): Promise<{ success: boolean; message: string; tripCount: number }> {
    this.isLoading = true;
    this.error = null;

    try {
      const text = await navigator.clipboard.readText();

      if (!text || text.trim().length === 0) {
        throw new Error('Clipboard is empty');
      }

      return await this.importFromCsv(text, mode);
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error
            ? err.message
            : 'Failed to import from clipboard';
        this.isLoading = false;
      });
      throw err;
    }
  }
}

export const travelStore = new TravelStore();
