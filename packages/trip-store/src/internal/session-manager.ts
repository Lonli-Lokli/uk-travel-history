/**
 * Session management utilities for anonymous/free user trip storage
 */

import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'uth_session_id';

/**
 * Get session ID from request cookies
 * @param request Next.js request
 * @returns Session ID or null if not present
 */
export function getSessionId(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Create a new session ID
 * @returns UUID v4 session ID
 */
export function createSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Set session cookie on response
 * @param response Next.js response
 * @param sessionId Session ID to set
 */
export function setSessionCookie(
  response: NextResponse,
  sessionId: string,
): void {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // No maxAge = session cookie (expires on browser close)
  });
}

/**
 * Clear session cookie (used after migration)
 * @param response Next.js response
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Immediate expiry
  });
}

/**
 * Calculate TTL in seconds until end of current day (midnight UTC)
 * @returns TTL in seconds
 */
export function getEndOfDayTTLSeconds(): number {
  const now = new Date();
  const endOfDay = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1, // Next day
      0,
      0,
      0,
      0, // Midnight UTC
    ),
  );
  const ttlMs = endOfDay.getTime() - now.getTime();
  // Minimum TTL of 1 second
  return Math.max(1, Math.floor(ttlMs / 1000));
}

/**
 * Get the session cookie name (for testing/debugging)
 */
export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

/**
 * Get session ID from Next.js headers (for Server Components/RSC)
 * This uses the cookies() function from next/headers which works in Server Components
 * @returns Session ID or null if not present
 */
export async function getSessionIdFromHeaders(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  } catch {
    // cookies() may throw if called outside of a request context
    return null;
  }
}
