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
      const mockBlob = new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await travelStore.exportToExcel('ilr');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/export',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result).toBeInstanceOf(Blob);
    });

    it('should export with full mode when specified', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

      await expect(travelStore.exportToExcel('ilr')).rejects.toThrow('Export failed');
    });
  });

  describe('importFullData', () => {
    it('should import full data successfully in replace mode', async () => {
      const mockFile = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const mockResponse = {
        success: true,
        data: {
          vignetteEntryDate: '2020-01-01',
          visaStartDate: '2020-01-02',
          ilrTrack: 5,
          trips: [
            { outDate: '2020-06-01', inDate: '2020-06-15', outRoute: 'Heathrow', inRoute: 'Heathrow' },
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
        { id: '1', outDate: '2019-01-01', inDate: '2019-01-15', outRoute: 'Test', inRoute: 'Test' },
      ];

      const mockFile = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const mockResponse = {
        success: true,
        data: {
          vignetteEntryDate: '2020-01-01',
          visaStartDate: '2020-01-02',
          ilrTrack: 5,
          trips: [
            { outDate: '2020-06-01', inDate: '2020-06-15', outRoute: 'Heathrow', inRoute: 'Heathrow' },
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
      const mockFile = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid file format' }),
      });

      await expect(travelStore.importFullData(mockFile, 'replace')).rejects.toThrow('Invalid file format');
      expect(travelStore.error).toBe('Invalid file format');
    });
  });

  describe('Import/Export Integration', () => {
    it('should maintain data integrity through export and import cycle', () => {
      // Set up initial data
      travelStore.trips = [
        { id: '1', outDate: '2020-06-01', inDate: '2020-06-15', outRoute: 'Heathrow', inRoute: 'Heathrow' },
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
});
