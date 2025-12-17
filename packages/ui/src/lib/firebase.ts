// Firebase Client SDK Configuration
// Used for client-side authentication with passkey support

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate that required config is present
function validateConfig() {
  const required = ['apiKey', 'authDomain', 'projectId'];
  const missing = required.filter((key) => !firebaseConfig[key as keyof typeof firebaseConfig]);

  if (missing.length > 0) {
    console.warn(
      `Firebase config missing: ${missing.join(', ')}. ` +
      'Authentication will not work until these are configured.'
    );
  }
}

// Initialize Firebase app (singleton pattern)
let app: FirebaseApp | undefined;
let auth: Auth | undefined;

function initializeFirebase() {
  if (typeof window === 'undefined') {
    // Server-side rendering - don't initialize
    return;
  }

  validateConfig();

  // Use existing app if already initialized
  if (getApps().length > 0) {
    app = getApps()[0];
  } else {
    try {
      app = initializeApp(firebaseConfig);
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      // Allow app to continue without auth
      return;
    }
  }

  auth = getAuth(app);
}

// Initialize on module load (client-side only)
if (typeof window !== 'undefined') {
  initializeFirebase();
}

/**
 * Get the Firebase Auth instance
 * @throws Error if called on server-side or if Firebase is not initialized
 */
export function getAuthInstance(): Auth {
  if (typeof window === 'undefined') {
    throw new Error('Firebase Auth can only be used on the client side');
  }

  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Check your Firebase configuration.');
  }

  return auth;
}

// Export auth as-is for backwards compatibility, but prefer getAuthInstance()
export { auth };
export type { Auth };
