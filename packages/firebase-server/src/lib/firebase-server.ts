// Firebase Admin SDK Configuration
// Used for server-side token verification and user management

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { logger } from '@uth/utils';

let adminApp: App | undefined;
let adminAuth: Auth | undefined;
let adminFirestore: Firestore | undefined;
let initializationError: Error | undefined;
let isConfigured = false;

/**
 * Initialize Firebase Admin SDK
 * Uses service account credentials from environment variables
 */
function initializeFirebaseAdmin() {
  // Only initialize once
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    adminAuth = getAuth(adminApp);
    adminFirestore = getFirestore(adminApp);
    isConfigured = true;
    return;
  }

  // Validate required credentials
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    const error = new Error(
      'Firebase Admin SDK credentials not configured. ' +
        'Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY environment variables.',
    );
    initializationError = error;
    console.warn(error.message);
    // Don't throw - allow app to run without auth in development
    return;
  }

  try {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        // Private key needs newline characters to be properly formatted
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });

    adminAuth = getAuth(adminApp);
    adminFirestore = getFirestore(adminApp);
    isConfigured = true;
  } catch (error) {
    initializationError = error as Error;
    logger.error('Failed to initialize Firebase Admin SDK:', error);
    // Don't throw - allow app to run without auth in development
  }
}

// Initialize on module load
initializeFirebaseAdmin();

/**
 * Check if Firebase Admin SDK is initialized and configured
 * @returns boolean indicating if Firebase Admin is ready to use
 */
export function isFirebaseAdminConfigured(): boolean {
  return isConfigured;
}

/**
 * Get initialization error if Firebase Admin SDK failed to initialize
 * @returns Error object or undefined if no error occurred
 */
export function getInitializationError(): Error | undefined {
  return initializationError;
}

/**
 * Get Firebase Admin Auth instance
 * Throws if not initialized
 * @returns Auth instance
 */
export function getAdminAuth(): Auth {
  if (!adminAuth) {
    if (initializationError) {
      throw new Error(
        `Firebase Admin SDK not initialized: ${initializationError.message}`,
      );
    }
    throw new Error(
      'Firebase Admin SDK not initialized. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY environment variables.',
    );
  }
  return adminAuth;
}

/**
 * Verify a Firebase ID token
 * @param token - The Firebase ID token to verify
 * @param checkRevoked - Whether to check if the token has been revoked
 * @returns Decoded token with user information
 * @throws Error if Firebase Admin SDK is not initialized or token verification fails
 */
export async function verifyIdToken(token: string, checkRevoked = true) {
  const auth = getAdminAuth();
  return auth.verifyIdToken(token, checkRevoked);
}

/**
 * Get user by UID
 * @param uid - The user's Firebase UID
 * @returns User record
 * @throws Error if Firebase Admin SDK is not initialized or user is not found
 */
export async function getUser(uid: string) {
  const auth = getAdminAuth();
  return auth.getUser(uid);
}

/**
 * Delete a user account
 * @param uid - The user's Firebase UID
 * @throws Error if Firebase Admin SDK is not initialized or deletion fails
 */
export async function deleteUser(uid: string) {
  const auth = getAdminAuth();
  return auth.deleteUser(uid);
}

/**
 * Get Firebase Admin Firestore instance
 * Throws if not initialized
 * @returns Firestore instance
 */
export function getAdminFirestore(): Firestore {
  if (!adminFirestore) {
    if (initializationError) {
      throw new Error(
        `Firebase Admin SDK not initialized: ${initializationError.message}`,
      );
    }
    throw new Error(
      'Firebase Admin SDK not initialized. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY environment variables.',
    );
  }
  return adminFirestore;
}

// Export types
export type { Auth, Firestore };

// Export the auth and firestore instances (may be undefined if not initialized)
// For advanced users who want to handle initialization themselves
export { adminAuth, adminFirestore };
