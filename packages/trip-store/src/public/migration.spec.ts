/**
 * Tests for migration utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CreateTripData, TripData } from '@uth/db';

// Mock dependencies
vi.mock('@uth/cache', () => ({
  get: vi.fn(),
  set: vi.fn(),
  deleteKey: vi.fn(),
}));

vi.mock('../internal/provider-resolver', () => ({
  getCacheAdapterDirect: vi.fn(),
}));

// Mock the Supabase adapter with a proper class
// Use method syntax instead of property so we can spy on the prototype
vi.mock('../internal/providers/supabase-adapter', () => {
  return {
    SupabaseTripAdapter: class {
      createTrip() {
        return Promise.resolve({} as any);
      }
    },
  };
});

import { migrateTripsFromCache, hasCachedTrips } from './migration';
import { get, set, deleteKey } from '@uth/cache';
import { getCacheAdapterDirect } from '../internal/provider-resolver';
import { SupabaseTripAdapter } from '../internal/providers/supabase-adapter';

describe('migrateTripsFromCache', () => {
  let mockCacheAdapter: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock cache adapter
    mockCacheAdapter = {
      getTrips: vi.fn(),
      clearTrips: vi.fn(),
    };

    vi.mocked(getCacheAdapterDirect).mockReturnValue(mockCacheAdapter);

    // Mock lock acquisition (default: lock is available)
    vi.mocked(get).mockResolvedValue(null);
    vi.mocked(set).mockResolvedValue(undefined);
    vi.mocked(deleteKey).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should migrate trips successfully', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 'user123';

    const cachedTrips: TripData[] = [
      {
        id: 'trip1',
        userId: sessionId,
        goalId: null,
        title: null,
        outDate: '2026-01-10',
        inDate: '2026-01-15',
        outRoute: 'LHR',
        inRoute: 'LHR',
        destination: null,
        notes: null,
        groupId: null,
        sortOrder: null,
        source: 'manual',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockCacheAdapter.getTrips.mockResolvedValue(cachedTrips);

    // Spy on the createTrip method and mock its return value
    const createTripSpy = vi
      .spyOn(SupabaseTripAdapter.prototype, 'createTrip')
      .mockResolvedValue({
        ...cachedTrips[0],
        userId,
      });

    const result = await migrateTripsFromCache(sessionId, userId);

    expect(result.success).toBe(true);
    expect(result.migrated).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(result.skipped).toBeUndefined();

    // Verify cache was cleared
    expect(mockCacheAdapter.clearTrips).toHaveBeenCalledWith(sessionId);

    // Verify lock was released
    expect(deleteKey).toHaveBeenCalledWith(`migration:lock:${sessionId}`);
  });

  it('should return early if no cached trips', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 'user123';

    mockCacheAdapter.getTrips.mockResolvedValue([]);

    const result = await migrateTripsFromCache(sessionId, userId);

    expect(result.success).toBe(true);
    expect(result.migrated).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Cache should not be cleared if there are no trips
    expect(mockCacheAdapter.clearTrips).not.toHaveBeenCalled();
  });

  it('should skip migration if lock is already acquired', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 'user123';

    // Simulate lock already exists
    vi.mocked(get).mockResolvedValue('locked');

    const result = await migrateTripsFromCache(sessionId, userId);

    expect(result.success).toBe(true);
    expect(result.migrated).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.skipped).toBe(true);

    // Should not fetch trips or clear cache
    expect(mockCacheAdapter.getTrips).not.toHaveBeenCalled();
    expect(mockCacheAdapter.clearTrips).not.toHaveBeenCalled();
  });

  it('should handle partial migration failures', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 'user123';

    const cachedTrips: TripData[] = [
      {
        id: 'trip1',
        userId: sessionId,
        goalId: null,
        title: null,
        outDate: '2026-01-10',
        inDate: '2026-01-15',
        outRoute: 'LHR',
        inRoute: 'LHR',
        destination: null,
        notes: null,
        groupId: null,
        sortOrder: null,
        source: 'manual',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'trip2',
        userId: sessionId,
        goalId: null,
        title: null,
        outDate: '2026-01-20',
        inDate: '2026-01-25',
        outRoute: 'JFK',
        inRoute: 'JFK',
        destination: null,
        notes: null,
        groupId: null,
        sortOrder: null,
        source: 'manual',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockCacheAdapter.getTrips.mockResolvedValue(cachedTrips);

    // First trip succeeds, second fails
    vi.spyOn(SupabaseTripAdapter.prototype, 'createTrip')
      .mockResolvedValueOnce({ ...cachedTrips[0], userId })
      .mockRejectedValueOnce(new Error('Database error'));

    const result = await migrateTripsFromCache(sessionId, userId);

    expect(result.success).toBe(false);
    expect(result.migrated).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Database error');

    // Cache should still be cleared even with partial failure
    expect(mockCacheAdapter.clearTrips).toHaveBeenCalledWith(sessionId);

    // Lock should be released
    expect(deleteKey).toHaveBeenCalledWith(`migration:lock:${sessionId}`);
  });

  it('should release lock on critical error', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 'user123';

    // Simulate critical error during cache fetch
    mockCacheAdapter.getTrips.mockRejectedValue(new Error('Cache error'));

    const result = await migrateTripsFromCache(sessionId, userId);

    expect(result.success).toBe(false);
    expect(result.migrated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Migration failed');

    // Lock should still be released
    expect(deleteKey).toHaveBeenCalledWith(`migration:lock:${sessionId}`);
  });

  it('should handle lock release failure gracefully', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 'user123';

    mockCacheAdapter.getTrips.mockResolvedValue([]);

    // Simulate lock release failure
    vi.mocked(deleteKey).mockRejectedValue(new Error('Lock release failed'));

    // Should not throw - migration should complete normally
    const result = await migrateTripsFromCache(sessionId, userId);

    expect(result.success).toBe(true);
    expect(result.migrated).toBe(0);
  });

  it('should migrate trips with all fields', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 'user123';

    const fullTrip: TripData = {
      id: 'trip1',
      userId: sessionId,
      goalId: 'goal123',
      title: 'NYC Trip',
      outDate: '2026-01-10',
      inDate: '2026-01-15',
      outRoute: 'LHR -> JFK',
      inRoute: 'JFK -> LHR',
      destination: 'New York',
      notes: 'Business trip',
      groupId: 'group456',
      sortOrder: 1,
      source: 'pdf',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCacheAdapter.getTrips.mockResolvedValue([fullTrip]);

    // Spy on the createTrip method
    const mockCreateTrip = vi
      .spyOn(SupabaseTripAdapter.prototype, 'createTrip')
      .mockResolvedValue({ ...fullTrip, userId });

    const result = await migrateTripsFromCache(sessionId, userId);

    expect(result.success).toBe(true);
    expect(result.migrated).toBe(1);

    // Verify createTrip was called with correct data (without id, userId, timestamps)
    expect(mockCreateTrip).toHaveBeenCalledWith(userId, {
      goalId: 'goal123',
      title: 'NYC Trip',
      outDate: '2026-01-10',
      inDate: '2026-01-15',
      outRoute: 'LHR -> JFK',
      inRoute: 'JFK -> LHR',
      destination: 'New York',
      notes: 'Business trip',
      groupId: 'group456',
      sortOrder: 1,
      source: 'pdf',
    });
  });
});

describe('hasCachedTrips', () => {
  let mockCacheAdapter: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheAdapter = {
      hasTrips: vi.fn(),
    };

    vi.mocked(getCacheAdapterDirect).mockReturnValue(mockCacheAdapter);
  });

  it('should return true if trips exist', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    mockCacheAdapter.hasTrips.mockResolvedValue(true);

    const result = await hasCachedTrips(sessionId);

    expect(result).toBe(true);
    expect(mockCacheAdapter.hasTrips).toHaveBeenCalledWith(sessionId);
  });

  it('should return false if no trips exist', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    mockCacheAdapter.hasTrips.mockResolvedValue(false);

    const result = await hasCachedTrips(sessionId);

    expect(result).toBe(false);
  });
});
