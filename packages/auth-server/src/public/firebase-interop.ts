/**
 * Firebase Interoperability Layer
 * Provides direct access to Firebase Admin SDK instances for advanced use cases
 *
 * WARNING: These are escape hatches that bypass the SDK abstraction.
 * Use only when the SDK's provider-agnostic API doesn't support your use case.
 * Direct usage couples your code to Firebase.
 */

import { getApps } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuthProvider } from '../internal/provider-resolver';
import { FirebaseAuthServerAdapter } from '../internal/providers/firebase-adapter';

/**
 * Get Firebase Admin Auth instance
 * @returns Firebase Admin Auth instance
 * @throws Error if Firebase is not configured or not using Firebase provider
 */
export function getAdminAuth(): Auth {
  const provider = getAuthProvider();

  // Check if provider is Firebase
  if (!(provider instanceof FirebaseAuthServerAdapter)) {
    throw new Error('Current auth provider is not Firebase');
  }

  // Get the Firebase app
  const apps = getApps();
  if (apps.length === 0) {
    throw new Error('Firebase Admin SDK is not initialized');
  }

  return getAuth(apps[0]);
}

/**
 * Get Firebase Admin Firestore instance
 * @returns Firebase Admin Firestore instance
 * @throws Error if Firebase is not configured or not using Firebase provider
 */
export function getAdminFirestore(): Firestore {
  const provider = getAuthProvider();

  // Check if provider is Firebase
  if (!(provider instanceof FirebaseAuthServerAdapter)) {
    throw new Error('Current auth provider is not Firebase');
  }

  // Get the Firebase app
  const apps = getApps();
  if (apps.length === 0) {
    throw new Error('Firebase Admin SDK is not initialized');
  }

  return getFirestore(apps[0]);
}

// Export types for convenience
export type { Auth, Firestore };
