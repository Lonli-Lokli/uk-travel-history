// Authentication Store with Passkey Support
// Manages user authentication state using Firebase + WebAuthn (Passkeys)

import { makeAutoObservable, runInAction } from 'mobx';
import {
  signInWithCustomToken,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

/**
 * Passkey credential response from firebase-web-authn extension
 */
interface PasskeyCredential {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
  type: 'public-key';
}

class AuthStore {
  user: User | null = null;
  isLoading = true;
  isAuthenticating = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);

    // Listen for auth state changes
    if (typeof window !== 'undefined' && auth) {
      onAuthStateChanged(auth, (user) => {
        runInAction(() => {
          this.user = user;
          this.isLoading = false;
        });
      });
    } else {
      // If auth is not available, set loading to false immediately
      this.isLoading = false;
    }
  }

  /**
   * Check if passkey/WebAuthn is supported in the browser
   */
  get isPasskeySupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === 'function'
    );
  }

  /**
   * Sign in with passkey
   * This works with the firebase-web-authn extension
   */
  async signInWithPasskey(): Promise<void> {
    if (!this.isPasskeySupported) {
      throw new Error('Passkeys are not supported in this browser');
    }

    this.isAuthenticating = true;
    this.error = null;

    try {
      // Step 1: Request authentication options from the extension
      const optionsResponse = await fetch('/api/auth/passkey/signin/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to start passkey sign-in');
      }

      const options = await optionsResponse.json();

      // Step 2: Use WebAuthn API to get credential
      const credential = (await navigator.credentials.get({
        publicKey: options.publicKey,
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('No credential received');
      }

      // Step 3: Send credential to extension for verification
      const verifyResponse = await fetch('/api/auth/passkey/signin/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: {
            id: credential.id,
            rawId: this.arrayBufferToBase64(credential.rawId),
            response: {
              clientDataJSON: this.arrayBufferToBase64(
                (credential.response as AuthenticatorAssertionResponse).clientDataJSON
              ),
              authenticatorData: this.arrayBufferToBase64(
                (credential.response as AuthenticatorAssertionResponse).authenticatorData
              ),
              signature: this.arrayBufferToBase64(
                (credential.response as AuthenticatorAssertionResponse).signature
              ),
              userHandle: (credential.response as AuthenticatorAssertionResponse).userHandle
                ? this.arrayBufferToBase64(
                    (credential.response as AuthenticatorAssertionResponse).userHandle!
                  )
                : undefined,
            },
            type: credential.type,
          },
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to verify passkey');
      }

      const { customToken } = await verifyResponse.json();

      // Step 4: Sign in to Firebase with custom token
      if (!auth) {
        throw new Error('Firebase Auth is not initialized');
      }
      await signInWithCustomToken(auth, customToken);

      runInAction(() => {
        this.isAuthenticating = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to sign in with passkey';
        this.isAuthenticating = false;
      });
      throw error;
    }
  }

  /**
   * Register a new passkey
   */
  async registerPasskey(email: string, displayName?: string): Promise<void> {
    if (!this.isPasskeySupported) {
      throw new Error('Passkeys are not supported in this browser');
    }

    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please enter a valid email address');
    }

    this.isAuthenticating = true;
    this.error = null;

    try {
      // Step 1: Request registration options from the extension
      const optionsResponse = await fetch('/api/auth/passkey/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to start passkey registration');
      }

      const options = await optionsResponse.json();

      // Step 2: Create credential using WebAuthn API
      const credential = (await navigator.credentials.create({
        publicKey: options.publicKey,
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('No credential created');
      }

      // Step 3: Send credential to extension for verification
      const verifyResponse = await fetch('/api/auth/passkey/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: {
            id: credential.id,
            rawId: this.arrayBufferToBase64(credential.rawId),
            response: {
              clientDataJSON: this.arrayBufferToBase64(
                (credential.response as AuthenticatorAttestationResponse).clientDataJSON
              ),
              attestationObject: this.arrayBufferToBase64(
                (credential.response as AuthenticatorAttestationResponse).attestationObject
              ),
            },
            type: credential.type,
          },
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to verify passkey registration');
      }

      const { customToken } = await verifyResponse.json();

      // Step 4: Sign in to Firebase with custom token
      if (!auth) {
        throw new Error('Firebase Auth is not initialized');
      }
      await signInWithCustomToken(auth, customToken);

      runInAction(() => {
        this.isAuthenticating = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to register passkey';
        this.isAuthenticating = false;
      });
      throw error;
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized');
    }
    await firebaseSignOut(auth);
  }

  /**
   * Get the current user's ID token
   * Used for authenticated API requests
   */
  async getIdToken(): Promise<string | null> {
    if (!this.user) return null;
    return this.user.getIdToken();
  }

  /**
   * Helper to convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chars: string[] = [];
    for (let i = 0; i < bytes.byteLength; i++) {
      chars.push(String.fromCharCode(bytes[i]));
    }
    return btoa(chars.join(''));
  }
}

export const authStore = new AuthStore();
