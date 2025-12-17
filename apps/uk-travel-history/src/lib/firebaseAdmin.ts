// Firebase Admin SDK Configuration
// Used for server-side token verification and user management

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let adminApp: App;
let adminAuth: Auth;

/**
 * Initialize Firebase Admin SDK
 * Uses service account credentials from environment variables
 */
function initializeFirebaseAdmin() {
  // Only initialize once
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    adminAuth = getAuth(adminApp);
    return;
  }

  // Validate required credentials
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      'Firebase Admin SDK credentials not configured. ' +
      'Server-side authentication will not work.'
    );
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
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
}

// Initialize on module load
initializeFirebaseAdmin();

/**
 * Verify a Firebase ID token
 * @param token - The Firebase ID token to verify
 * @param checkRevoked - Whether to check if the token has been revoked
 * @returns Decoded token with user information
 */
export async function verifyIdToken(token: string, checkRevoked = true) {
  if (!adminAuth) {
    throw new Error('Firebase Admin SDK not initialized');
  }

  return adminAuth.verifyIdToken(token, checkRevoked);
}

/**
 * Get user by UID
 * @param uid - The user's Firebase UID
 */
export async function getUser(uid: string) {
  if (!adminAuth) {
    throw new Error('Firebase Admin SDK not initialized');
  }

  return adminAuth.getUser(uid);
}

/**
 * Delete a user account
 * @param uid - The user's Firebase UID
 */
export async function deleteUser(uid: string) {
  if (!adminAuth) {
    throw new Error('Firebase Admin SDK not initialized');
  }

  return adminAuth.deleteUser(uid);
}

export { adminAuth };
export type { Auth };
