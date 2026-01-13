import { makeAutoObservable, runInAction } from 'mobx';
import {
  ILRTrack,
  PreEntryPeriodInfo,
  RollingDataPoint,
  TimelinePoint,
  TripBar,
  TripRecord,
  TripWithCalculations,
  TravelCalculationResult,
} from '@uth/rules';
// Internal imports for calculation functions
import {
  calculateTravelData,
  calculateTripDurations,
} from '@uth/rules/internal';
import { formatDate } from '@uth/utils';

/**
 * HTTP client interface for dependency injection
 * Allows tests to provide custom fetch implementations
 */
export interface HttpClient {
  fetch: typeof fetch;
}

/**
 * Configuration options for the travel store
 * Allows injection of dependencies for better testability
 */
export interface TravelStoreConfig {
  /**
   * HTTP client implementation (defaults to global fetch)
   */
  httpClient?: HttpClient;
}

/**
 * Global configuration for the travel store
 * Can be set via configureTravelStore() for testing or customization
 */
let storeConfig: TravelStoreConfig = {};

/**
 * Configure the travel store with custom dependencies
 * Useful for testing or customizing behavior
 *
 * @example
 * // In tests
 * configureTravelStore({
 *   httpClient: { fetch: vi.fn() }
 * });
 *
 * @example
 * // Reset to defaults
 * configureTravelStore({});
 */
export function configureTravelStore(config: TravelStoreConfig): void {
  storeConfig = config;
}

/**
 * Get the configured HTTP client or fall back to global fetch
 */
function getHttpClient(): HttpClient {
  return storeConfig.httpClient || { fetch: globalThis.fetch.bind(globalThis) };
}

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

  // Drawer state
  isDrawerOpen = false;
  drawerMode: 'create' | 'edit' = 'create';
  editingTripId: string | null = null;
  drawerFormData: Partial<TripRecord> = {};

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
    // Always return trips with calculations, even if full calculation can't run
    // This ensures incomplete trips are visible in the table for editing
    if (this.calculations) {
      return this.calculations.tripsWithCalculations;
    }

    // If no full calculation available, compute basic trip data manually
    // This allows users to see and edit incomplete trips
    return calculateTripDurations(this.trips);
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
    if (this.calculations?.summary) {
      return this.calculations.summary;
    }

    // Fallback: Calculate basic stats when visa details aren't set
    const tripsWithCalcs = calculateTripDurations(this.trips);
    const complete = tripsWithCalcs.filter((t) => !t.isIncomplete);
    const incomplete = tripsWithCalcs.filter((t) => t.isIncomplete);
    const totalFullDays = complete.reduce(
      (sum, t) => sum + (t.fullDays || 0),
      0,
    );

    return {
      totalTrips: this.trips.length,
      completeTrips: complete.length,
      incompleteTrips: incomplete.length,
      totalFullDays,
      continuousLeaveDays: null,
      maxAbsenceInAny12Months: null,
      hasExceededAllowedAbsense: false,
      ilrEligibilityDate: null,
      daysUntilEligible: null,
      autoDateUsed: false,
      currentRollingAbsenceToday: null,
      remaining180LimitToday: null,
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
    // Convert timestamp to ISO date string, then format for display
    const startDate = new Date(startTimestamp);
    const endDate = new Date(endTimestamp);
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);
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

  // Drawer actions
  openDrawer(mode: 'create' | 'edit', tripId?: string) {
    this.drawerMode = mode;
    this.editingTripId = tripId || null;

    if (mode === 'create') {
      this.drawerFormData = {
        outDate: '',
        inDate: '',
        outRoute: '',
        inRoute: '',
      };
    } else if (mode === 'edit' && tripId) {
      const trip = this.trips.find((t) => t.id === tripId);
      if (trip) {
        this.drawerFormData = { ...trip };
      }
    }

    this.isDrawerOpen = true;
  }

  closeDrawer() {
    this.isDrawerOpen = false;
    this.drawerFormData = {};
    this.editingTripId = null;
  }

  updateDrawerFormData(updates: Partial<TripRecord>) {
    this.drawerFormData = { ...this.drawerFormData, ...updates };
  }

  saveFromDrawer() {
    if (this.drawerMode === 'create') {
      const newTrip: TripRecord = {
        id: this.generateId(),
        outDate: this.drawerFormData.outDate || '',
        inDate: this.drawerFormData.inDate || '',
        outRoute: this.drawerFormData.outRoute || '',
        inRoute: this.drawerFormData.inRoute || '',
      };
      this.trips.push(newTrip);
    } else if (this.drawerMode === 'edit' && this.editingTripId) {
      const index = this.trips.findIndex((t) => t.id === this.editingTripId);
      if (index !== -1) {
        this.trips[index] = {
          ...this.trips[index],
          outDate: this.drawerFormData.outDate || '',
          inDate: this.drawerFormData.inDate || '',
          outRoute: this.drawerFormData.outRoute || '',
          inRoute: this.drawerFormData.inRoute || '',
        };
      }
    }

    this.closeDrawer();
  }

  async importFromPdf(file: File): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('responseType', 'json');

      const client = getHttpClient();
      const response = await client.fetch('/api/parse', {
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

  async exportToExcel(mode: 'ilr' | 'full' = 'ilr'): Promise<Blob> {
    const formData = new FormData();

    const exportData = {
      trips: this.tripsWithCalculations,
      vignetteEntryDate: this.vignetteEntryDate,
      visaStartDate: this.visaStartDate,
      ilrTrack: this.ilrTrack,
      summary: this.summary,
    };

    formData.append('tripsData', JSON.stringify(exportData));
    formData.append('exportMode', mode);
    formData.append('responseType', 'excel');

    const client = getHttpClient();
    const response = await client.fetch('/api/export', {
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

  async importFullData(
    file: File,
    mode: 'replace' | 'append' = 'replace',
  ): Promise<{ success: boolean; message: string; tripCount: number }> {
    this.isLoading = true;
    this.error = null;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const client = getHttpClient();
      const response = await client.fetch('/api/import-full', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import file');
      }

      runInAction(() => {
        const importedTrips: TripRecord[] = result.data.trips.map(
          (trip: {
            outDate: string;
            inDate: string;
            outRoute: string;
            inRoute: string;
          }) => ({
            id: this.generateId(),
            outDate: trip.outDate,
            inDate: trip.inDate,
            outRoute: trip.outRoute,
            inRoute: trip.inRoute,
          }),
        );

        if (mode === 'replace') {
          this.trips = importedTrips;
        } else {
          this.trips = [...this.trips, ...importedTrips];
        }

        // Import visa details
        if (result.data.vignetteEntryDate) {
          this.vignetteEntryDate = result.data.vignetteEntryDate;
        }
        if (result.data.visaStartDate) {
          this.visaStartDate = result.data.visaStartDate;
        }
        if (result.data.ilrTrack) {
          this.ilrTrack = result.data.ilrTrack;
        }

        this.isLoading = false;
      });

      return {
        success: true,
        message: `Successfully imported ${result.metadata.tripCount} trips and visa details`,
        tripCount: result.metadata.tripCount,
      };
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : 'Failed to import full data';
        this.isLoading = false;
      });
      throw err;
    }
  }
}

export const travelStore = new TravelStore();
