/**
 * React hook for authentication state
 */

import { useState, useEffect } from 'react';
import type { AuthState } from '../types/domain';
import { onAuthStateChanged } from './auth-operations';

/**
 * React hook that provides the current authentication state
 * Automatically subscribes to auth state changes and updates when user signs in/out
 *
 * @returns Current auth state with user, loading status, and error
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, loading, error } = useAuth();
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!user) return <div>Not authenticated</div>;
 *
 *   return <div>Hello, {user.displayName}!</div>;
 * }
 * ```
 */
export function useAuth(): AuthState {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((state) => {
      setAuthState(state);
    });

    return unsubscribe;
  }, []);

  return authState;
}
