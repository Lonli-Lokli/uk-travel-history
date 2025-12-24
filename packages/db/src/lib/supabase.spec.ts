/**
 * Tests for Supabase client utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSupabaseServerClient, getSupabaseClient } from './supabase';

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url, key) => ({
    url,
    key,
    auth: { autoRefreshToken: false, persistSession: false },
  })),
}));

describe('Supabase Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSupabaseServerClient', () => {
    it('should create server client with service role key', () => {
      // Arrange
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

      // Act
      const client = getSupabaseServerClient();

      // Assert
      expect(client).toBeDefined();
      expect(client.url).toBe('https://test.supabase.co');
      expect(client.key).toBe('service-role-key');
    });

    it('should throw error if SUPABASE_URL is missing', () => {
      // Arrange
      delete process.env.SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

      // Act & Assert
      expect(() => getSupabaseServerClient()).toThrow(
        'Missing Supabase configuration',
      );
    });

    it('should throw error if SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      // Arrange
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Act & Assert
      expect(() => getSupabaseServerClient()).toThrow(
        'Missing Supabase configuration',
      );
    });
  });

  describe('getSupabaseClient', () => {
    it('should create client with anon key', () => {
      // Arrange
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

      // Act
      const client = getSupabaseClient();

      // Assert
      expect(client).toBeDefined();
      expect(client.url).toBe('https://test.supabase.co');
      expect(client.key).toBe('anon-key');
    });

    it('should throw error if NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      // Arrange
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

      // Act & Assert
      expect(() => getSupabaseClient()).toThrow('Missing Supabase configuration');
    });

    it('should throw error if NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
      // Arrange
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Act & Assert
      expect(() => getSupabaseClient()).toThrow('Missing Supabase configuration');
    });
  });
});
