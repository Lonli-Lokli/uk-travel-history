/**
 * Tests for provider resolution logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveAuthProvider,
  getAuthProvider,
  clearAuthProviderCache,
  setAuthProvider,
} from './provider-resolver';
import { ClerkAuthServerAdapter } from './providers/clerk-adapter';
import { FirebaseAuthServerAdapter } from './providers/firebase-adapter';
import { MockAuthServerAdapter } from './providers/mock-adapter';
import { AuthError, AuthErrorCode } from '../types/domain';

describe('provider-resolver', () => {
  // Store original env to restore after tests
  const originalEnv = process.env.UTH_AUTH_PROVIDER;

  beforeEach(() => {
    // Clear provider cache before each test
    clearAuthProviderCache();
    // Reset env
    delete process.env.UTH_AUTH_PROVIDER;
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.UTH_AUTH_PROVIDER = originalEnv;
    } else {
      delete process.env.UTH_AUTH_PROVIDER;
    }
    clearAuthProviderCache();
  });

  describe('resolveAuthProvider', () => {
    it('should default to clerk provider when no config or env var is set', () => {
      const provider = resolveAuthProvider();
      expect(provider).toBeInstanceOf(ClerkAuthServerAdapter);
    });

    it('should use clerk provider when UTH_AUTH_PROVIDER=clerk', () => {
      process.env.UTH_AUTH_PROVIDER = 'clerk';
      const provider = resolveAuthProvider();
      expect(provider).toBeInstanceOf(ClerkAuthServerAdapter);
    });

    it('should use firebase provider when UTH_AUTH_PROVIDER=firebase', () => {
      process.env.UTH_AUTH_PROVIDER = 'firebase';
      const provider = resolveAuthProvider();
      expect(provider).toBeInstanceOf(FirebaseAuthServerAdapter);
    });

    it('should use config type over environment variable', () => {
      process.env.UTH_AUTH_PROVIDER = 'clerk';
      const provider = resolveAuthProvider({ type: 'firebase' });
      expect(provider).toBeInstanceOf(FirebaseAuthServerAdapter);
    });

    it('should throw error for unknown provider type', () => {
      process.env.UTH_AUTH_PROVIDER = 'unknown' as any;

      expect(() => resolveAuthProvider()).toThrow(AuthError);
      expect(() => resolveAuthProvider()).toThrow(
        /Unknown auth provider: unknown/,
      );

      try {
        resolveAuthProvider();
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.CONFIG_ERROR);
      }
    });

    it('should cache provider instance after first call', () => {
      const provider1 = resolveAuthProvider();
      const provider2 = resolveAuthProvider();
      expect(provider1).toBe(provider2); // Same instance
    });

    it('should initialize provider with config', () => {
      const initSpy = vi.spyOn(ClerkAuthServerAdapter.prototype, 'initialize');
      const config = { type: 'clerk' as const };
      resolveAuthProvider(config);
      expect(initSpy).toHaveBeenCalledWith(config);
      initSpy.mockRestore();
    });

    it('should initialize provider with empty config when no config provided', () => {
      const initSpy = vi.spyOn(ClerkAuthServerAdapter.prototype, 'initialize');
      resolveAuthProvider();
      expect(initSpy).toHaveBeenCalledWith({});
      initSpy.mockRestore();
    });
  });

  describe('getAuthProvider', () => {
    it('should return same provider as resolveAuthProvider', () => {
      const provider = getAuthProvider();
      expect(provider).toBeInstanceOf(ClerkAuthServerAdapter);
    });

    it('should use cached provider', () => {
      const provider1 = getAuthProvider();
      const provider2 = getAuthProvider();
      expect(provider1).toBe(provider2);
    });
  });

  describe('clearAuthProviderCache', () => {
    it('should clear cached provider', () => {
      const provider1 = resolveAuthProvider();
      clearAuthProviderCache();
      const provider2 = resolveAuthProvider();
      expect(provider1).not.toBe(provider2); // Different instances
    });

    it('should allow provider type to change after cache clear', () => {
      process.env.UTH_AUTH_PROVIDER = 'clerk';
      const provider1 = resolveAuthProvider();
      expect(provider1).toBeInstanceOf(ClerkAuthServerAdapter);

      clearAuthProviderCache();
      process.env.UTH_AUTH_PROVIDER = 'firebase';
      const provider2 = resolveAuthProvider();
      expect(provider2).toBeInstanceOf(FirebaseAuthServerAdapter);
    });
  });

  describe('setAuthProvider', () => {
    it('should set custom provider for testing', () => {
      const mockProvider = new MockAuthServerAdapter();
      setAuthProvider(mockProvider);

      const provider = getAuthProvider();
      expect(provider).toBe(mockProvider);
    });

    it('should override environment-based resolution', () => {
      process.env.UTH_AUTH_PROVIDER = 'clerk';
      const mockProvider = new MockAuthServerAdapter();
      setAuthProvider(mockProvider);

      const provider = resolveAuthProvider();
      expect(provider).toBe(mockProvider);
      expect(provider).not.toBeInstanceOf(ClerkAuthServerAdapter);
    });

    it('should be clearable with clearAuthProviderCache', () => {
      const mockProvider = new MockAuthServerAdapter();
      setAuthProvider(mockProvider);
      expect(getAuthProvider()).toBe(mockProvider);

      clearAuthProviderCache();
      const provider = getAuthProvider();
      expect(provider).not.toBe(mockProvider);
      expect(provider).toBeInstanceOf(ClerkAuthServerAdapter);
    });
  });
});
