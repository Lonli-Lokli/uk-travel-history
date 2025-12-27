import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createUserScopedClient, createAdminClient, checkUserHasPremiumAccess } from './client-factory';

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@supabase/supabase-js';

describe('client-factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createUserScopedClient', () => {
    it('should create client with anon key and clerk token', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const mockClient = { from: vi.fn() };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      const clerkToken = 'test-clerk-token';
      const client = createUserScopedClient(clerkToken);

      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        {
          global: {
            headers: {
              Authorization: 'Bearer test-clerk-token',
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );
      expect(client).toBe(mockClient);
    });

    it('should create client without Authorization header when token is null', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const mockClient = { from: vi.fn() };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      const client = createUserScopedClient(null);

      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        {
          global: {
            headers: {},
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );
      expect(client).toBe(mockClient);
    });

    it('should throw error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      expect(() => createUserScopedClient('token')).toThrow(
        'Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'
      );
    });

    it('should throw error when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(() => createUserScopedClient('token')).toThrow(
        'Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'
      );
    });

    it('should throw error when both env vars are missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(() => createUserScopedClient('token')).toThrow(
        'Missing Supabase configuration'
      );
    });
  });

  describe('createAdminClient', () => {
    it('should create client with service role key', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

      const mockClient = { from: vi.fn() };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      const client = createAdminClient();

      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-role-key',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );
      expect(client).toBe(mockClient);
    });

    it('should fallback to NEXT_PUBLIC_SUPABASE_URL if SUPABASE_URL is not set', () => {
      delete process.env.SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://public.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

      const mockClient = { from: vi.fn() };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      const client = createAdminClient();

      expect(createClient).toHaveBeenCalledWith(
        'https://public.supabase.co',
        'test-service-role-key',
        expect.any(Object)
      );
      expect(client).toBe(mockClient);
    });

    it('should throw error when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => createAdminClient()).toThrow(
        'Missing Supabase service role configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
      );
    });

    it('should throw error when both URL env vars are missing', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      expect(() => createAdminClient()).toThrow(
        'Missing Supabase service role configuration'
      );
    });

    it('should throw error when all required env vars are missing', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => createAdminClient()).toThrow(
        'Missing Supabase service role configuration'
      );
    });
  });

  describe('checkUserHasPremiumAccess', () => {
    it('should return true when user has premium access', async () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

      const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });
      const mockClient = { rpc: mockRpc };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      const result = await checkUserHasPremiumAccess('user_123');

      expect(mockRpc).toHaveBeenCalledWith('has_premium_access', { user_id: 'user_123' });
      expect(result).toBe(true);
    });

    it('should return false when user does not have premium access', async () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

      const mockRpc = vi.fn().mockResolvedValue({ data: false, error: null });
      const mockClient = { rpc: mockRpc };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      const result = await checkUserHasPremiumAccess('user_456');

      expect(mockRpc).toHaveBeenCalledWith('has_premium_access', { user_id: 'user_456' });
      expect(result).toBe(false);
    });

    it('should return false when RPC returns null data', async () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

      const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockClient = { rpc: mockRpc };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      const result = await checkUserHasPremiumAccess('user_789');

      expect(result).toBe(false);
    });

    it('should return false and log error when RPC fails', async () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty - suppressing console.error during test
      });
      const mockError = new Error('RPC failed');
      const mockRpc = vi.fn().mockResolvedValue({ data: null, error: mockError });
      const mockClient = { rpc: mockRpc };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      const result = await checkUserHasPremiumAccess('user_error');

      expect(mockRpc).toHaveBeenCalledWith('has_premium_access', { user_id: 'user_error' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error checking premium access:', mockError);
      expect(result).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should handle database connection errors gracefully', async () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty - suppressing console.error during test
      });
      const mockError = { message: 'Connection timeout', code: 'ETIMEDOUT' };
      const mockRpc = vi.fn().mockResolvedValue({ data: null, error: mockError });
      const mockClient = { rpc: mockRpc };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      const result = await checkUserHasPremiumAccess('user_timeout');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error checking premium access:', mockError);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Security considerations', () => {
    it('should not include service role key in user-scoped client', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

      const mockClient = { from: vi.fn() };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      createUserScopedClient('token');

      // Verify it uses anon key, not service role key
      expect(createClient).toHaveBeenCalledWith(
        expect.any(String),
        'anon-key',
        expect.any(Object)
      );
    });

    it('should disable session persistence for user-scoped clients', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const mockClient = { from: vi.fn() };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      createUserScopedClient('token');

      expect(createClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      );
    });

    it('should disable session persistence for admin clients', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

      const mockClient = { from: vi.fn() };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      createAdminClient();

      expect(createClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      );
    });
  });
});
