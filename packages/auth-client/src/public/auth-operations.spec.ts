/**
 * Tests for auth-client public operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isPasskeySupported,
  signInWithPasskey,
  registerPasskey,
  registerPasskeyAnonymous,
} from './auth-operations';
import { AuthError, AuthErrorCode } from '../types/domain';
import * as providerResolver from '../internal/provider-resolver';
import type { AuthClientProvider } from '../internal/providers/interface';

describe('Auth Client - Passkey Operations', () => {
  let mockProvider: AuthClientProvider;

  beforeEach(() => {
    // Create a mock provider
    mockProvider = {
      initialize: vi.fn(),
      isConfigured: vi.fn(() => true),
      getCurrentUser: vi.fn(() => null),
      signInWithEmailPassword: vi.fn(),
      signOut: vi.fn(),
      getIdToken: vi.fn(),
      onAuthStateChanged: vi.fn(() => () => {}),
      createUserWithEmailPassword: vi.fn(),
      sendPasswordResetEmail: vi.fn(),
      updateProfile: vi.fn(),
      isPasskeySupported: vi.fn(() => true),
      signInWithPasskey: vi.fn(async () => ({
        user: {
          uid: 'test-user-id',
          email: 'test@example.com',
          emailVerified: true,
          isAnonymous: false,
        },
        token: 'test-token',
      })),
      registerPasskey: vi.fn(async () => ({
        user: {
          uid: 'new-user-id',
          email: undefined,
          emailVerified: false,
          isAnonymous: false,
        },
        token: 'new-token',
      })),
      registerPasskeyAnonymous: vi.fn(async () => ({
        user: {
          uid: 'anon-user-id',
          email: undefined,
          emailVerified: false,
          isAnonymous: true,
        },
        token: 'anon-token',
      })),
    } as AuthClientProvider;

    // Mock the provider resolver to return our mock provider
    vi.spyOn(providerResolver, 'getAuthProvider').mockReturnValue(mockProvider);
  });

  describe('isPasskeySupported', () => {
    it('should return true when passkeys are supported', () => {
      const result = isPasskeySupported();
      expect(result).toBe(true);
      expect(mockProvider.isPasskeySupported).toHaveBeenCalled();
    });

    it('should return false when passkeys are not supported', () => {
      mockProvider.isPasskeySupported = vi.fn(() => false);
      const result = isPasskeySupported();
      expect(result).toBe(false);
    });
  });

  describe('signInWithPasskey', () => {
    it('should successfully sign in with passkey', async () => {
      const result = await signInWithPasskey();

      expect(result).toEqual({
        user: {
          uid: 'test-user-id',
          email: 'test@example.com',
          emailVerified: true,
          isAnonymous: false,
        },
        token: 'test-token',
      });
      expect(mockProvider.signInWithPasskey).toHaveBeenCalled();
    });

    it('should throw AuthError when passkeys not supported', async () => {
      mockProvider.signInWithPasskey = vi.fn(async () => {
        throw new AuthError(
          AuthErrorCode.PASSKEY_NOT_SUPPORTED,
          'Passkeys are not supported in this browser',
        );
      });

      await expect(signInWithPasskey()).rejects.toThrow(AuthError);
      await expect(signInWithPasskey()).rejects.toThrow(
        'Passkeys are not supported in this browser',
      );
    });

    it('should throw AuthError when sign-in fails', async () => {
      mockProvider.signInWithPasskey = vi.fn(async () => {
        throw new AuthError(
          AuthErrorCode.PASSKEY_ERROR,
          'User cancelled passkey authentication',
        );
      });

      await expect(signInWithPasskey()).rejects.toThrow(AuthError);
    });
  });

  describe('registerPasskey', () => {
    it('should successfully register a passkey', async () => {
      const result = await registerPasskey('John Doe');

      expect(result).toEqual({
        user: {
          uid: 'new-user-id',
          email: undefined,
          emailVerified: false,
          isAnonymous: false,
        },
        token: 'new-token',
      });
      expect(mockProvider.registerPasskey).toHaveBeenCalledWith('John Doe');
    });

    it('should throw AuthError when passkeys not supported', async () => {
      mockProvider.registerPasskey = vi.fn(async () => {
        throw new AuthError(
          AuthErrorCode.PASSKEY_NOT_SUPPORTED,
          'Passkeys are not supported in this browser',
        );
      });

      await expect(registerPasskey('John Doe')).rejects.toThrow(AuthError);
    });

    it('should throw AuthError when registration fails', async () => {
      mockProvider.registerPasskey = vi.fn(async () => {
        throw new AuthError(
          AuthErrorCode.PASSKEY_ERROR,
          'Failed to create passkey',
        );
      });

      await expect(registerPasskey('John Doe')).rejects.toThrow(AuthError);
    });

    it('should pass display name to provider', async () => {
      await registerPasskey('Jane Smith');
      expect(mockProvider.registerPasskey).toHaveBeenCalledWith('Jane Smith');
    });
  });

  describe('registerPasskeyAnonymous', () => {
    it('should successfully register an anonymous passkey', async () => {
      const result = await registerPasskeyAnonymous();

      expect(result).toEqual({
        user: {
          uid: 'anon-user-id',
          email: undefined,
          emailVerified: false,
          isAnonymous: true,
        },
        token: 'anon-token',
      });
      expect(mockProvider.registerPasskeyAnonymous).toHaveBeenCalledWith(
        undefined,
      );
    });

    it('should use custom display name when provided', async () => {
      await registerPasskeyAnonymous('Custom Name');
      expect(mockProvider.registerPasskeyAnonymous).toHaveBeenCalledWith(
        'Custom Name',
      );
    });

    it('should throw AuthError when passkeys not supported', async () => {
      mockProvider.registerPasskeyAnonymous = vi.fn(async () => {
        throw new AuthError(
          AuthErrorCode.PASSKEY_NOT_SUPPORTED,
          'Passkeys are not supported in this browser',
        );
      });

      await expect(registerPasskeyAnonymous()).rejects.toThrow(AuthError);
    });

    it('should throw AuthError when registration fails', async () => {
      mockProvider.registerPasskeyAnonymous = vi.fn(async () => {
        throw new AuthError(
          AuthErrorCode.PASSKEY_ERROR,
          'Failed to create anonymous passkey',
        );
      });

      await expect(registerPasskeyAnonymous()).rejects.toThrow(AuthError);
    });
  });

  describe('Passkey Error Handling', () => {
    it('should preserve error codes from provider', async () => {
      const expectedError = new AuthError(
        AuthErrorCode.PASSKEY_ERROR,
        'Passkey operation failed',
      );
      mockProvider.signInWithPasskey = vi.fn(async () => {
        throw expectedError;
      });

      try {
        await signInWithPasskey();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe(AuthErrorCode.PASSKEY_ERROR);
      }
    });

    it('should handle provider errors correctly', async () => {
      mockProvider.registerPasskey = vi.fn(async () => {
        throw new AuthError(
          AuthErrorCode.PROVIDER_ERROR,
          'Provider error during passkey registration',
        );
      });

      await expect(registerPasskey('Test User')).rejects.toThrow(
        'Provider error during passkey registration',
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full registration flow', async () => {
      // Register with passkey
      const registerResult = await registerPasskey('Test User');
      expect(registerResult.user.uid).toBeTruthy();
      expect(registerResult.token).toBeTruthy();

      // Verify provider was called
      expect(mockProvider.registerPasskey).toHaveBeenCalledWith('Test User');
    });

    it('should handle full sign-in flow', async () => {
      // Sign in with passkey
      const signInResult = await signInWithPasskey();
      expect(signInResult.user.uid).toBeTruthy();
      expect(signInResult.token).toBeTruthy();

      // Verify provider was called
      expect(mockProvider.signInWithPasskey).toHaveBeenCalled();
    });

    it('should handle anonymous registration flow', async () => {
      // Anonymous registration
      const anonResult = await registerPasskeyAnonymous();
      expect(anonResult.user.isAnonymous).toBe(true);
      expect(anonResult.token).toBeTruthy();

      // Verify provider was called
      expect(mockProvider.registerPasskeyAnonymous).toHaveBeenCalled();
    });
  });
});
