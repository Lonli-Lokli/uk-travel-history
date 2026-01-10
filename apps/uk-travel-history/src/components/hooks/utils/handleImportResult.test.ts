import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleImportResult } from './handleImportResult';
import type { TripData } from '@uth/db';

// Mock stores
vi.mock('@uth/stores', () => ({
  travelStore: {
    importFromCsv: vi.fn(),
    setVignetteEntryDate: vi.fn(),
    setVisaStartDate: vi.fn(),
    setILRTrack: vi.fn(),
  },
  tripsStore: {
    addTrips: vi.fn(),
  },
}));

describe('handleImportResult', () => {
  const mockTrips: TripData[] = [
    {
      id: '1',
      userId: 'user-1',
      goalId: 'goal-1',
      outDate: '2024-01-01',
      inDate: '2024-01-05',
      outRoute: 'London',
      inRoute: 'Paris',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      userId: 'user-1',
      goalId: 'goal-1',
      outDate: '2024-02-01',
      inDate: '2024-02-10',
      outRoute: 'London',
      inRoute: 'Berlin',
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: '2024-02-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Paid Users (saved to DB)', () => {
    it('should add trips to tripsStore when metadata.saved is true', async () => {
      const { travelStore, tripsStore } = await import('@uth/stores');

      const result = {
        trips: mockTrips,
        metadata: { saved: true, tripCount: 2 },
      };

      const count = await handleImportResult(result);

      expect(tripsStore.addTrips).toHaveBeenCalledWith(mockTrips);
      expect(tripsStore.addTrips).toHaveBeenCalledTimes(1);
      expect(travelStore.importFromCsv).not.toHaveBeenCalled();
      expect(count).toBe(2);
    });

    it('should not update visa details for paid users', async () => {
      const { travelStore, tripsStore } = await import('@uth/stores');

      const result = {
        trips: mockTrips,
        metadata: { saved: true },
      };

      await handleImportResult(result, {
        vignetteEntryDate: '2023-01-01',
        visaStartDate: '2023-06-01',
        ilrTrack: 5,
      });

      expect(tripsStore.addTrips).toHaveBeenCalled();
      expect(travelStore.setVignetteEntryDate).not.toHaveBeenCalled();
      expect(travelStore.setVisaStartDate).not.toHaveBeenCalled();
      expect(travelStore.setILRTrack).not.toHaveBeenCalled();
    });
  });

  describe('Free Users (in-memory)', () => {
    it('should hydrate trips in legacy travelStore when metadata.saved is false', async () => {
      const { travelStore, tripsStore } = await import('@uth/stores');

      const result = {
        trips: mockTrips,
        metadata: { saved: false, tripCount: 2 },
      };

      const count = await handleImportResult(result);

      const expectedCsv = `Date Out,Date In,Departure,Return
2024-01-01,2024-01-05,London,Paris
2024-02-01,2024-02-10,London,Berlin`;

      expect(travelStore.importFromCsv).toHaveBeenCalledWith(
        expectedCsv,
        'append'
      );
      expect(travelStore.importFromCsv).toHaveBeenCalledTimes(1);
      expect(tripsStore.addTrips).not.toHaveBeenCalled();
      expect(count).toBe(2);
    });

    it('should hydrate trips when metadata.saved is undefined', async () => {
      const { travelStore, tripsStore } = await import('@uth/stores');

      const result = {
        trips: mockTrips,
        metadata: {},
      };

      const count = await handleImportResult(result);

      expect(travelStore.importFromCsv).toHaveBeenCalled();
      expect(tripsStore.addTrips).not.toHaveBeenCalled();
      expect(count).toBe(2);
    });

    it('should update visa details when provided for free users', async () => {
      const { travelStore } = await import('@uth/stores');

      const result = {
        trips: mockTrips,
        metadata: { saved: false },
      };

      await handleImportResult(result, {
        vignetteEntryDate: '2023-01-01',
        visaStartDate: '2023-06-01',
        ilrTrack: 5,
      });

      expect(travelStore.importFromCsv).toHaveBeenCalled();
      expect(travelStore.setVignetteEntryDate).toHaveBeenCalledWith(
        '2023-01-01'
      );
      expect(travelStore.setVisaStartDate).toHaveBeenCalledWith('2023-06-01');
      expect(travelStore.setILRTrack).toHaveBeenCalledWith(5);
    });

    it('should handle trips without optional fields', async () => {
      const { travelStore } = await import('@uth/stores');

      const tripsWithoutRoutes: TripData[] = [
        {
          id: '1',
          userId: 'user-1',
          goalId: 'goal-1',
          outDate: '2024-01-01',
          inDate: '2024-01-05',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const result = {
        trips: tripsWithoutRoutes,
        metadata: { saved: false },
      };

      const count = await handleImportResult(result);

      const expectedCsv = `Date Out,Date In,Departure,Return
2024-01-01,2024-01-05,,`;

      expect(travelStore.importFromCsv).toHaveBeenCalledWith(
        expectedCsv,
        'append'
      );
      expect(count).toBe(1);
    });

    it('should not update visa details when not provided', async () => {
      const { travelStore } = await import('@uth/stores');

      const result = {
        trips: mockTrips,
        metadata: { saved: false },
      };

      await handleImportResult(result);

      expect(travelStore.importFromCsv).toHaveBeenCalled();
      expect(travelStore.setVignetteEntryDate).not.toHaveBeenCalled();
      expect(travelStore.setVisaStartDate).not.toHaveBeenCalled();
      expect(travelStore.setILRTrack).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty trips array', async () => {
      const { tripsStore } = await import('@uth/stores');

      const result = {
        trips: [],
        metadata: { saved: true },
      };

      const count = await handleImportResult(result);

      expect(tripsStore.addTrips).toHaveBeenCalledWith([]);
      expect(count).toBe(0);
    });

    it('should return correct count for large trip arrays', async () => {
      const largeTripsArray = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        userId: 'user-1',
        goalId: 'goal-1',
        outDate: '2024-01-01',
        inDate: '2024-01-05',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }));

      const result = {
        trips: largeTripsArray,
        metadata: { saved: true },
      };

      const count = await handleImportResult(result);

      expect(count).toBe(100);
    });
  });
});
