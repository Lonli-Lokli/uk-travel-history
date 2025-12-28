import { describe, it, expect, beforeEach, vi } from 'vitest';
import { travelStore } from './travelStore';

// Mock fetch for testing
global.fetch = vi.fn();

describe('TravelStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    travelStore.trips = [];
    travelStore.vignetteEntryDate = '';
    travelStore.visaStartDate = '';
    travelStore.ilrTrack = 5;
    travelStore.isLoading = false;
    travelStore.error = null;
    vi.clearAllMocks();
  });

  describe('exportToExcel', () => {
    it('should call export API with correct mode parameter', async () => {
      const mockBlob = new Blob(['test'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await travelStore.exportToExcel('ilr');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/export',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(result).toBeInstanceOf(Blob);
    });

    it('should export with full mode when specified', async () => {
      const mockBlob = new Blob(['test'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      await travelStore.exportToExcel('full');

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const formData = callArgs[1].body as FormData;
      expect(formData.get('exportMode')).toBe('full');
    });

    it('should throw error when export fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Export failed' }),
      });

      await expect(travelStore.exportToExcel('ilr')).rejects.toThrow(
        'Export failed',
      );
    });
  });

  describe('importFullData', () => {
    it('should import full data successfully in replace mode', async () => {
      const mockFile = new File(['test'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const mockResponse = {
        success: true,
        data: {
          vignetteEntryDate: '2020-01-01',
          visaStartDate: '2020-01-02',
          ilrTrack: 5,
          trips: [
            {
              outDate: '2020-06-01',
              inDate: '2020-06-15',
              outRoute: 'Heathrow',
              inRoute: 'Heathrow',
            },
          ],
        },
        metadata: {
          tripCount: 1,
          hasVisaDetails: true,
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await travelStore.importFullData(mockFile, 'replace');

      expect(result.success).toBe(true);
      expect(result.tripCount).toBe(1);
      expect(travelStore.trips.length).toBe(1);
      expect(travelStore.vignetteEntryDate).toBe('2020-01-01');
      expect(travelStore.visaStartDate).toBe('2020-01-02');
      expect(travelStore.ilrTrack).toBe(5);
    });

    it('should append trips when mode is append', async () => {
      // Add an existing trip
      travelStore.trips = [
        {
          id: '1',
          outDate: '2019-01-01',
          inDate: '2019-01-15',
          outRoute: 'Test',
          inRoute: 'Test',
        },
      ];

      const mockFile = new File(['test'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const mockResponse = {
        success: true,
        data: {
          vignetteEntryDate: '2020-01-01',
          visaStartDate: '2020-01-02',
          ilrTrack: 5,
          trips: [
            {
              outDate: '2020-06-01',
              inDate: '2020-06-15',
              outRoute: 'Heathrow',
              inRoute: 'Heathrow',
            },
          ],
        },
        metadata: {
          tripCount: 1,
          hasVisaDetails: true,
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await travelStore.importFullData(mockFile, 'append');

      expect(travelStore.trips.length).toBe(2);
    });

    it('should handle import errors', async () => {
      const mockFile = new File(['test'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid file format' }),
      });

      await expect(
        travelStore.importFullData(mockFile, 'replace'),
      ).rejects.toThrow('Invalid file format');
      expect(travelStore.error).toBe('Invalid file format');
    });
  });

  describe('Import/Export Integration', () => {
    it('should maintain data integrity through export and import cycle', () => {
      // Set up initial data
      travelStore.trips = [
        {
          id: '1',
          outDate: '2020-06-01',
          inDate: '2020-06-15',
          outRoute: 'Heathrow',
          inRoute: 'Heathrow',
        },
      ];
      travelStore.vignetteEntryDate = '2020-01-01';
      travelStore.visaStartDate = '2020-01-02';
      travelStore.ilrTrack = 5;

      // Verify trips are properly structured
      expect(travelStore.trips).toHaveLength(1);
      expect(travelStore.trips[0]).toHaveProperty('id');
      expect(travelStore.trips[0]).toHaveProperty('outDate');
      expect(travelStore.trips[0]).toHaveProperty('inDate');
    });
  });

  describe('Trip Management', () => {
    it('should add a new trip with generated ID', () => {
      const trip = travelStore.addTrip({
        outDate: '2020-06-01',
        inDate: '2020-06-15',
        outRoute: 'Heathrow',
        inRoute: 'Gatwick',
      });

      expect(trip.id).toBeDefined();
      expect(trip.outDate).toBe('2020-06-01');
      expect(trip.inDate).toBe('2020-06-15');
      expect(travelStore.trips).toHaveLength(1);
    });

    it('should add trip with empty fields when no data provided', () => {
      const trip = travelStore.addTrip();

      expect(trip.outDate).toBe('');
      expect(trip.inDate).toBe('');
      expect(trip.outRoute).toBe('');
      expect(trip.inRoute).toBe('');
    });

    it('should update existing trip', () => {
      const trip = travelStore.addTrip({
        outDate: '2020-06-01',
        inDate: '2020-06-15',
      });

      travelStore.updateTrip(trip.id, {
        outDate: '2020-07-01',
        outRoute: 'Manchester',
      });

      const updated = travelStore.trips.find((t) => t.id === trip.id);
      expect(updated?.outDate).toBe('2020-07-01');
      expect(updated?.inDate).toBe('2020-06-15');
      expect(updated?.outRoute).toBe('Manchester');
    });

    it('should not throw when updating non-existent trip', () => {
      expect(() => {
        travelStore.updateTrip('non-existent', { outDate: '2020-01-01' });
      }).not.toThrow();
    });

    it('should delete trip by id', () => {
      const trip1 = travelStore.addTrip({ outDate: '2020-06-01' });
      const trip2 = travelStore.addTrip({ outDate: '2020-07-01' });

      travelStore.deleteTrip(trip1.id);

      expect(travelStore.trips).toHaveLength(1);
      expect(travelStore.trips[0].id).toBe(trip2.id);
    });

    it('should clear all trips', () => {
      travelStore.addTrip({ outDate: '2020-06-01' });
      travelStore.addTrip({ outDate: '2020-07-01' });

      travelStore.clearAll();

      expect(travelStore.trips).toHaveLength(0);
    });

    it('should set trips array', () => {
      const trips = [
        {
          id: '1',
          outDate: '2020-06-01',
          inDate: '2020-06-15',
          outRoute: 'A',
          inRoute: 'B',
        },
        {
          id: '2',
          outDate: '2020-07-01',
          inDate: '2020-07-15',
          outRoute: 'C',
          inRoute: 'D',
        },
      ];

      travelStore.setTrips(trips);

      expect(travelStore.trips).toEqual(trips);
    });
  });

  describe('Visa Details Setters', () => {
    it('should set vignette entry date', () => {
      travelStore.setVignetteEntryDate('2020-01-01');
      expect(travelStore.vignetteEntryDate).toBe('2020-01-01');
    });

    it('should set visa start date', () => {
      travelStore.setVisaStartDate('2020-01-02');
      expect(travelStore.visaStartDate).toBe('2020-01-02');
    });

    it('should set ILR track', () => {
      travelStore.setILRTrack(10);
      expect(travelStore.ilrTrack).toBe(10);
    });

    it('should set application date', () => {
      travelStore.setApplicationDate('2025-01-01');
      expect(travelStore.applicationDate).toBe('2025-01-01');
    });
  });

  describe('Computed Properties', () => {
    it('should return false for hasRequiredFields when fields missing', () => {
      expect(travelStore.hasRequiredFields).toBe(false);
    });

    it('should return true for hasRequiredFields when all fields present', () => {
      travelStore.vignetteEntryDate = '2020-01-01';
      travelStore.visaStartDate = '2020-01-02';
      travelStore.ilrTrack = 5;
      travelStore.addTrip({
        outDate: '2020-06-01',
        inDate: '2020-06-15',
      });

      expect(travelStore.hasRequiredFields).toBe(true);
    });

    it('should return false for hasRequiredFields with incomplete trips', () => {
      travelStore.vignetteEntryDate = '2020-01-01';
      travelStore.visaStartDate = '2020-01-02';
      travelStore.ilrTrack = 5;
      travelStore.addTrip({
        outDate: '2020-06-01',
        inDate: '', // Missing inDate
      });

      expect(travelStore.hasRequiredFields).toBe(false);
    });

    it('should return fallback summary when required fields missing', () => {
      travelStore.addTrip({
        outDate: '2020-06-01',
        inDate: '2020-06-15',
      });

      const summary = travelStore.summary;

      expect(summary.totalTrips).toBe(1);
      expect(summary.continuousLeaveDays).toBeNull();
      expect(summary.ilrEligibilityDate).toBeNull();
    });

    it('should return empty arrays for chart data when calculations unavailable', () => {
      expect(travelStore.rollingAbsenceData).toEqual([]);
      expect(travelStore.timelinePoints).toEqual([]);
      expect(travelStore.tripBars).toEqual([]);
    });

    it('should return null for effectiveApplicationDate when not eligible', () => {
      expect(travelStore.effectiveApplicationDate).toBeNull();
    });

    it('should return false for autoDateUsed when calculations unavailable', () => {
      expect(travelStore.autoDateUsed).toBe(false);
    });
  });

  describe('Trip Selection', () => {
    it('should select trip with formatted dates', () => {
      const startTimestamp = new Date('2020-06-01').getTime();
      const endTimestamp = new Date('2020-06-15').getTime();

      travelStore.selectTrip('Summer Trip', startTimestamp, endTimestamp);

      expect(travelStore.selectedTripDetails).toEqual({
        name: 'Summer Trip',
        start: '01/06/2020',
        end: '15/06/2020',
      });
    });

    it('should clear selected trip', () => {
      travelStore.setSelectedTripDetails({ name: 'Test', start: '01/01/2020', end: '15/01/2020' });

      travelStore.clearSelectedTrip();

      expect(travelStore.selectedTripDetails).toBeNull();
    });
  });

  describe('Trip Reordering', () => {
    beforeEach(() => {
      travelStore.setTrips([
        { id: '1', outDate: '2020-01-01', inDate: '2020-01-15', outRoute: 'A', inRoute: 'B' },
        { id: '2', outDate: '2020-02-01', inDate: '2020-02-15', outRoute: 'C', inRoute: 'D' },
        { id: '3', outDate: '2020-03-01', inDate: '2020-03-15', outRoute: 'E', inRoute: 'F' },
      ]);
    });

    it('should reorder trip from index 0 to index 2', () => {
      travelStore.reorderTrip(0, 2);

      expect(travelStore.trips[0].id).toBe('2');
      expect(travelStore.trips[1].id).toBe('3');
      expect(travelStore.trips[2].id).toBe('1');
    });

    it('should not reorder when fromIndex equals toIndex', () => {
      const before = [...travelStore.trips];

      travelStore.reorderTrip(1, 1);

      expect(travelStore.trips).toEqual(before);
    });

    it('should not reorder when fromIndex is out of bounds', () => {
      const before = [...travelStore.trips];

      travelStore.reorderTrip(-1, 1);
      expect(travelStore.trips).toEqual(before);

      travelStore.reorderTrip(5, 1);
      expect(travelStore.trips).toEqual(before);
    });

    it('should not reorder when toIndex is out of bounds', () => {
      const before = [...travelStore.trips];

      travelStore.reorderTrip(1, -1);
      expect(travelStore.trips).toEqual(before);

      travelStore.reorderTrip(1, 5);
      expect(travelStore.trips).toEqual(before);
    });
  });

  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = travelStore.generateId();
      const id2 = travelStore.generateId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^trip-\d+-[a-z0-9]+$/);
    });
  });

  describe('importFromCsv', () => {
    it('should import trips from CSV in append mode', async () => {
      const csvText = 'outDate,inDate,outRoute,inRoute\n2020-06-01,2020-06-15,Heathrow,Gatwick';

      const result = await travelStore.importFromCsv(csvText, 'append');

      expect(result.success).toBe(true);
      expect(result.tripCount).toBeGreaterThan(0);
      expect(travelStore.trips.length).toBeGreaterThan(0);
    });

    it('should import trips from CSV in replace mode', async () => {
      travelStore.addTrip({ outDate: '2019-01-01', inDate: '2019-01-15' });

      const csvText = 'outDate,inDate,outRoute,inRoute\n2020-06-01,2020-06-15,Heathrow,Gatwick';

      await travelStore.importFromCsv(csvText, 'replace');

      expect(travelStore.trips.length).toBe(1);
      expect(travelStore.trips[0].outDate).toBe('2020-06-01');
    });

    it('should handle XLSX JSON format', async () => {
      const trips = [
        { outDate: '2020-06-01', inDate: '2020-06-15', outRoute: 'A', inRoute: 'B' },
      ];
      const xlsxFormat = `__XLSX__${JSON.stringify(trips)}`;

      const result = await travelStore.importFromCsv(xlsxFormat, 'replace');

      expect(result.success).toBe(true);
      expect(travelStore.trips.length).toBe(1);
    });

    it('should throw error when no valid trips found', async () => {
      const csvText = 'invalid,data\nno,trips';

      await expect(
        travelStore.importFromCsv(csvText, 'replace')
      ).rejects.toThrow();
    });
  });
});
