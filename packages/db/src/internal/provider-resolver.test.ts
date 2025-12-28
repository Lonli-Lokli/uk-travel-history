/**
 * Tests for database provider resolution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDbProvider, injectDbProvider, resetDbProvider } from './provider-resolver';
import { SupabaseDbAdapter } from './providers/supabase-adapter';
import { MockDbAdapter } from './providers/mock-adapter';

describe('provider-resolver', () => {
  const originalEnv = process.env.UTH_DB_PROVIDER;

  beforeEach(() => {
    resetDbProvider();
    delete process.env.UTH_DB_PROVIDER;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.UTH_DB_PROVIDER = originalEnv;
    } else {
      delete process.env.UTH_DB_PROVIDER;
    }
    resetDbProvider();
  });

  describe('getDbProvider', () => {
    it('should default to Supabase provider when no env var is set', () => {
      const provider = getDbProvider();
      expect(provider).toBeInstanceOf(SupabaseDbAdapter);
    });

    it('should use Supabase provider when UTH_DB_PROVIDER=supabase', () => {
      process.env.UTH_DB_PROVIDER = 'supabase';
      const provider = getDbProvider();
      expect(provider).toBeInstanceOf(SupabaseDbAdapter);
    });

    it('should use mock provider when UTH_DB_PROVIDER=mock', () => {
      process.env.UTH_DB_PROVIDER = 'mock';
      const provider = getDbProvider();
      expect(provider).toBeInstanceOf(MockDbAdapter);
    });

    it('should handle case-insensitive provider names', () => {
      process.env.UTH_DB_PROVIDER = 'MOCK';
      const provider = getDbProvider();
      expect(provider).toBeInstanceOf(MockDbAdapter);
    });

    it('should cache provider instance', () => {
      const provider1 = getDbProvider();
      const provider2 = getDbProvider();
      expect(provider1).toBe(provider2); // Same instance
    });

    it('should initialize provider with config', () => {
      process.env.UTH_DB_PROVIDER = 'mock';
      const initSpy = vi.spyOn(MockDbAdapter.prototype, 'initialize');

      getDbProvider();

      expect(initSpy).toHaveBeenCalledWith({ provider: 'mock' });
      initSpy.mockRestore();
    });

    it('should default to Supabase for unknown provider types', () => {
      process.env.UTH_DB_PROVIDER = 'unknown';
      const provider = getDbProvider();
      expect(provider).toBeInstanceOf(SupabaseDbAdapter);
    });
  });

  describe('injectDbProvider', () => {
    it('should inject custom provider', () => {
      const mockProvider = new MockDbAdapter();
      injectDbProvider(mockProvider);

      const provider = getDbProvider();
      expect(provider).toBe(mockProvider);
    });

    it('should override environment-based resolution', () => {
      process.env.UTH_DB_PROVIDER = 'supabase';
      const mockProvider = new MockDbAdapter();
      injectDbProvider(mockProvider);

      const provider = getDbProvider();
      expect(provider).toBe(mockProvider);
      expect(provider).not.toBeInstanceOf(SupabaseDbAdapter);
    });

    it('should clear injection when passed null', () => {
      const mockProvider = new MockDbAdapter();
      injectDbProvider(mockProvider);
      expect(getDbProvider()).toBe(mockProvider);

      injectDbProvider(null);
      resetDbProvider(); // Also reset instance

      const provider = getDbProvider();
      expect(provider).not.toBe(mockProvider);
      expect(provider).toBeInstanceOf(SupabaseDbAdapter);
    });

    it('should not reinitialize injected provider', () => {
      const mockProvider = new MockDbAdapter();
      const initSpy = vi.spyOn(mockProvider, 'initialize');

      injectDbProvider(mockProvider);
      getDbProvider();

      expect(initSpy).not.toHaveBeenCalled();
      initSpy.mockRestore();
    });
  });

  describe('resetDbProvider', () => {
    it('should clear cached provider instance', () => {
      const provider1 = getDbProvider();
      resetDbProvider();
      const provider2 = getDbProvider();
      expect(provider1).not.toBe(provider2); // Different instances
    });

    it('should clear injected provider', () => {
      const mockProvider = new MockDbAdapter();
      injectDbProvider(mockProvider);
      expect(getDbProvider()).toBe(mockProvider);

      resetDbProvider();

      const provider = getDbProvider();
      expect(provider).not.toBe(mockProvider);
    });

    it('should allow provider type to change after reset', () => {
      process.env.UTH_DB_PROVIDER = 'mock';
      const provider1 = getDbProvider();
      expect(provider1).toBeInstanceOf(MockDbAdapter);

      resetDbProvider();
      process.env.UTH_DB_PROVIDER = 'supabase';
      const provider2 = getDbProvider();
      expect(provider2).toBeInstanceOf(SupabaseDbAdapter);
    });
  });
});
