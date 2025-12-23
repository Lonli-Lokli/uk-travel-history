/**
 * Domain types for client-side authentication (provider-agnostic)
 */

/**
 * Error codes for client-side authentication operations
 */
export enum AuthErrorCode {
  /** User is not authenticated */
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  /** User cancelled the authentication flow */
  USER_CANCELLED = 'USER_CANCELLED',
  /** Invalid credentials provided */
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  /** Authentication configuration is invalid or missing */
  CONFIG_ERROR = 'CONFIG_ERROR',
  /** Error from the underlying auth provider */
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  /** Network or communication error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** User account already exists */
  ACCOUNT_EXISTS = 'ACCOUNT_EXISTS',
  /** Too many attempts, temporarily blocked */
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',
  /** Passkeys are not supported in this browser */
  PASSKEY_NOT_SUPPORTED = 'PASSKEY_NOT_SUPPORTED',
  /** Error during passkey operation */
  PASSKEY_ERROR = 'PASSKEY_ERROR',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Authentication error with structured information
 */
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }

  /**
   * Check if this is a specific error code
   */
  is(code: AuthErrorCode): boolean {
    return this.code === code;
  }

  /**
   * Convert to a JSON-serializable object
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
    };
  }
}

/**
 * Represents an authenticated user
 */
export interface AuthUser {
  /** Unique identifier for the user */
  uid: string;
  /** User's email address (if available) */
  email?: string;
  /** Whether the user's email has been verified */
  emailVerified: boolean;
  /** User's display name (if available) */
  displayName?: string;
  /** URL to user's profile photo (if available) */
  photoURL?: string;
  /** Whether the user is anonymous */
  isAnonymous: boolean;
}

/**
 * Sign-in credentials (email/password)
 */
export interface EmailPasswordCredentials {
  email: string;
  password: string;
}

/**
 * Sign-in result
 */
export interface SignInResult {
  /** The authenticated user */
  user: AuthUser;
  /** ID token that can be sent to the server */
  token: string;
}

/**
 * Authentication state
 */
export interface AuthState {
  /** Current authenticated user (null if not authenticated) */
  user: AuthUser | null;
  /** Whether the auth state is being initialized */
  loading: boolean;
  /** Error if auth state check failed */
  error?: AuthError;
}

/**
 * Callback for auth state changes
 */
export type AuthStateChangeCallback = (state: AuthState) => void;
