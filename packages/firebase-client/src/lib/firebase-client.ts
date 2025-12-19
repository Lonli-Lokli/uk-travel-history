// Firebase Client SDK Configuration
// Used for client-side authentication with passkey support

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFunctions, type Functions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { logger } from '@uth/utils';

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
  const missing = required.filter(
    (key) => !firebaseConfig[key as keyof typeof firebaseConfig],
  );

  if (missing.length > 0) {
    console.warn(
      `Firebase config missing: ${missing.join(', ')}. ` +
        'Authentication will not work until these are configured.',
    );
  }
}

// Initialize Firebase app (singleton pattern)
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let functions: Functions | undefined;

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
      logger.error('Failed to initialize Firebase:', error);
      // Allow app to continue without auth
      return;
    }
  }

  // Only get auth and functions if app was successfully initialized
  if (app) {
    try {
      auth = getAuth(app);
    } catch (error) {
      logger.error('Failed to get Firebase Auth:', error);
      // Allow app to continue without auth
    }

    try {
      functions = getFunctions(app);
    } catch (error) {
      logger.error('Failed to get Firebase Functions:', error);
      // Allow app to continue without functions
    }

    // Initialize App Check if reCAPTCHA site key is provided
    const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (recaptchaSiteKey) {
      try {
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(recaptchaSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } catch (error) {
        logger.error('Failed to initialize App Check:', error);
        // Allow app to continue without App Check
      }
    }
  }
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
    throw new Error(
      'Firebase Auth is not initialized. Check your Firebase configuration.',
    );
  }

  return auth;
}

/**
 * Get the Firebase Functions instance
 * @throws Error if called on server-side or if Firebase is not initialized
 */
export function getFunctionsInstance(): Functions {
  if (typeof window === 'undefined') {
    throw new Error('Firebase Functions can only be used on the client side');
  }

  if (!functions) {
    throw new Error(
      'Firebase Functions is not initialized. Check your Firebase configuration.',
    );
  }

  return functions;
}

// Export auth and functions as-is for backwards compatibility, but prefer getInstance() methods
export { auth, functions };
export type { Auth, Functions };
