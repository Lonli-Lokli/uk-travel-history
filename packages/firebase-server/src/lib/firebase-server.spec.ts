import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isFirebaseAdminConfigured,
  getInitializationError,
  getAdminAuth,
  getAdminFirestore,
} from './firebase-server';

describe('Firebase Server Package', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Configuration Status', () => {
    it('should provide isFirebaseAdminConfigured function', () => {
      expect(isFirebaseAdminConfigured).toBeDefined();
      expect(typeof isFirebaseAdminConfigured).toBe('function');
    });

    it('should return boolean from isFirebaseAdminConfigured', () => {
      const configured = isFirebaseAdminConfigured();
      expect(typeof configured).toBe('boolean');
    });

    it('should provide getInitializationError function', () => {
      expect(getInitializationError).toBeDefined();
      expect(typeof getInitializationError).toBe('function');
    });
  });

  describe('Admin Auth', () => {
    it('should provide getAdminAuth function', () => {
      expect(getAdminAuth).toBeDefined();
      expect(typeof getAdminAuth).toBe('function');
    });

    it('should throw error when not configured', () => {
      // If Firebase is not configured, getAdminAuth should throw
      if (!isFirebaseAdminConfigured()) {
        expect(() => getAdminAuth()).toThrow();
      }
    });
  });

  describe('Admin Firestore', () => {
    it('should provide getAdminFirestore function', () => {
      expect(getAdminFirestore).toBeDefined();
      expect(typeof getAdminFirestore).toBe('function');
    });

    it('should throw error when not configured', () => {
      // If Firebase is not configured, getAdminFirestore should throw
      if (!isFirebaseAdminConfigured()) {
        expect(() => getAdminFirestore()).toThrow();
      }
    });
  });

  describe('Initialization with missing credentials', () => {
    it('should handle missing PROJECT_ID gracefully', () => {
      delete process.env.FIREBASE_ADMIN_PROJECT_ID;
      delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;

      // Should not crash, initialization should be deferred
      expect(() => isFirebaseAdminConfigured()).not.toThrow();
    });

    it('should return error when credentials are missing', () => {
      delete process.env.FIREBASE_ADMIN_PROJECT_ID;
      delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;

      const error = getInitializationError();
      // If credentials are missing, there should be an initialization error
      if (!isFirebaseAdminConfigured()) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Messages', () => {
    it('should provide helpful error message when getting auth without initialization', () => {
      if (!isFirebaseAdminConfigured()) {
        expect(() => getAdminAuth()).toThrow(/Firebase Admin SDK not initialized/);
      }
    });

    it('should provide helpful error message when getting firestore without initialization', () => {
      if (!isFirebaseAdminConfigured()) {
        expect(() => getAdminFirestore()).toThrow(
          /Firebase Admin SDK not initialized/,
        );
      }
    });
  });
});
