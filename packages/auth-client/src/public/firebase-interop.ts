/**
 * Firebase Interoperability Layer (Client)
 * Provides direct access to Firebase client SDK instances for advanced use cases
 *
 * WARNING: These are escape hatches that bypass the SDK abstraction.
 * Use only when the SDK's provider-agnostic API doesn't support your use case.
 * Direct usage couples your code to Firebase.
 */

import { getApps } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFunctions, type Functions } from 'firebase/functions';
import { getAuthProvider } from '../internal/provider-resolver';
import { FirebaseAuthClientAdapter } from '../internal/providers/firebase-adapter';

/**
 * Get Firebase Auth instance
 * @returns Firebase Auth instance
 * @throws Error if Firebase is not configured or not using Firebase provider
 */
export function getAuthInstance(): Auth {
  const provider = getAuthProvider();

  // Check if provider is Firebase
  if (!(provider instanceof FirebaseAuthClientAdapter)) {
    throw new Error('Current auth provider is not Firebase');
  }

  // Get the Firebase app
  const apps = getApps();
  if (apps.length === 0) {
    throw new Error('Firebase is not initialized');
  }

  return getAuth(apps[0]);
}

/**
 * Get Firebase Functions instance
 * @returns Firebase Functions instance
 * @throws Error if Firebase is not configured or not using Firebase provider
 */
export function getFunctionsInstance(): Functions {
  const provider = getAuthProvider();

  // Check if provider is Firebase
  if (!(provider instanceof FirebaseAuthClientAdapter)) {
    throw new Error('Current auth provider is not Firebase');
  }

  // Get the Firebase app
  const apps = getApps();
  if (apps.length === 0) {
    throw new Error('Firebase is not initialized');
  }

  return getFunctions(apps[0]);
}

/**
 * Legacy export - the auth instance
 * @deprecated Access via getAuthInstance() instead
 */
export const auth = typeof window !== 'undefined' ? (() => {
  try {
    return getAuthInstance();
  } catch {
    return undefined;
  }
})() : undefined;

// Export types for convenience
export type { Auth, Functions };
