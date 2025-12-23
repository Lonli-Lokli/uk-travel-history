/**
 * Tests for auth-server public API
 */

import { describe, it, expect } from 'vitest';
import {
  AuthError,
  AuthErrorCode,
} from '../index.js';

describe('Auth Server - Domain Types', () => {
  describe('AuthError', () => {
    it('should create an AuthError with correct properties', () => {
      const error = new AuthError(
        AuthErrorCode.UNAUTHENTICATED,
        'Test error message',
      );

      expect(error.name).toBe('AuthError');
      expect(error.code).toBe(AuthErrorCode.UNAUTHENTICATED);
      expect(error.message).toBe('Test error message');
      expect(error.is(AuthErrorCode.UNAUTHENTICATED)).toBe(true);
      expect(error.is(AuthErrorCode.FORBIDDEN)).toBe(false);
    });

    it('should serialize to JSON correctly', () => {
      const error = new AuthError(
        AuthErrorCode.PROVIDER_ERROR,
        'Provider failed',
      );

      const json = error.toJSON();

      expect(json.name).toBe('AuthError');
      expect(json.code).toBe(AuthErrorCode.PROVIDER_ERROR);
      expect(json.message).toBe('Provider failed');
    });

    it('should preserve original error', () => {
      const originalError = new Error('Original error');
      const error = new AuthError(
        AuthErrorCode.NETWORK_ERROR,
        'Network failed',
        originalError,
      );

      expect(error.originalError).toBe(originalError);
    });
  });

  describe('AuthErrorCode enum', () => {
    it('should have all expected error codes', () => {
      expect(AuthErrorCode.UNAUTHENTICATED).toBe('UNAUTHENTICATED');
      expect(AuthErrorCode.FORBIDDEN).toBe('FORBIDDEN');
      expect(AuthErrorCode.CONFIG_ERROR).toBe('CONFIG_ERROR');
      expect(AuthErrorCode.PROVIDER_ERROR).toBe('PROVIDER_ERROR');
      expect(AuthErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(AuthErrorCode.INVALID_TOKEN).toBe('INVALID_TOKEN');
      expect(AuthErrorCode.USER_NOT_FOUND).toBe('USER_NOT_FOUND');
      expect(AuthErrorCode.UNKNOWN).toBe('UNKNOWN');
    });
  });
});
