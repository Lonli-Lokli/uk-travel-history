/**
 * Tests for session management utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest, NextResponse } from 'next/server';
import {
  getSessionId,
  createSessionId,
  setSessionCookie,
  clearSessionCookie,
  getEndOfDayTTLSeconds,
  getSessionCookieName,
} from './session-manager';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

describe('getSessionId', () => {
  it('should return session ID from cookies', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const mockRequest = {
      cookies: {
        get: vi.fn().mockReturnValue({ value: sessionId }),
      },
    } as unknown as NextRequest;

    const result = getSessionId(mockRequest);

    expect(result).toBe(sessionId);
    expect(mockRequest.cookies.get).toHaveBeenCalledWith('uth_session_id');
  });

  it('should return null if cookie does not exist', () => {
    const mockRequest = {
      cookies: {
        get: vi.fn().mockReturnValue(undefined),
      },
    } as unknown as NextRequest;

    const result = getSessionId(mockRequest);

    expect(result).toBeNull();
  });
});

describe('createSessionId', () => {
  it('should create a valid UUID v4', () => {
    const sessionId = createSessionId();

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(sessionId).toMatch(uuidV4Regex);
  });

  it('should create unique session IDs', () => {
    const id1 = createSessionId();
    const id2 = createSessionId();
    const id3 = createSessionId();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });
});

describe('setSessionCookie', () => {
  it('should set session cookie with correct options', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const mockCookies = {
      set: vi.fn(),
    };
    const mockResponse = {
      cookies: mockCookies,
    } as unknown as NextResponse;

    setSessionCookie(mockResponse, sessionId);

    expect(mockCookies.set).toHaveBeenCalledWith(
      'uth_session_id',
      sessionId,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
  });

  it('should set secure flag in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const mockCookies = {
      set: vi.fn(),
    };
    const mockResponse = {
      cookies: mockCookies,
    } as unknown as NextResponse;

    setSessionCookie(mockResponse, sessionId);

    expect(mockCookies.set).toHaveBeenCalledWith(
      'uth_session_id',
      sessionId,
      expect.objectContaining({
        secure: true,
      }),
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should not set secure flag in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const mockCookies = {
      set: vi.fn(),
    };
    const mockResponse = {
      cookies: mockCookies,
    } as unknown as NextResponse;

    setSessionCookie(mockResponse, sessionId);

    expect(mockCookies.set).toHaveBeenCalledWith(
      'uth_session_id',
      sessionId,
      expect.objectContaining({
        secure: false,
      }),
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should set session cookie without maxAge (session cookie)', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const mockCookies = {
      set: vi.fn(),
    };
    const mockResponse = {
      cookies: mockCookies,
    } as unknown as NextResponse;

    setSessionCookie(mockResponse, sessionId);

    const callArgs = mockCookies.set.mock.calls[0][2];
    expect(callArgs).not.toHaveProperty('maxAge');
  });
});

describe('clearSessionCookie', () => {
  it('should clear session cookie by setting maxAge to 0', () => {
    const mockCookies = {
      set: vi.fn(),
    };
    const mockResponse = {
      cookies: mockCookies,
    } as unknown as NextResponse;

    clearSessionCookie(mockResponse);

    expect(mockCookies.set).toHaveBeenCalledWith(
      'uth_session_id',
      '',
      expect.objectContaining({
        maxAge: 0,
      }),
    );
  });

  it('should maintain security settings when clearing', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const mockCookies = {
      set: vi.fn(),
    };
    const mockResponse = {
      cookies: mockCookies,
    } as unknown as NextResponse;

    clearSessionCookie(mockResponse);

    expect(mockCookies.set).toHaveBeenCalledWith(
      'uth_session_id',
      '',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      }),
    );

    process.env.NODE_ENV = originalEnv;
  });
});

describe('getEndOfDayTTLSeconds', () => {
  it('should return seconds until end of day (midnight UTC)', () => {
    const ttl = getEndOfDayTTLSeconds();

    // TTL should be positive
    expect(ttl).toBeGreaterThan(0);

    // TTL should be at most 24 hours (86400 seconds)
    expect(ttl).toBeLessThanOrEqual(86400);

    // TTL should be at least 1 second (as per the function)
    expect(ttl).toBeGreaterThanOrEqual(1);
  });

  it('should return different values at different times', () => {
    const ttl1 = getEndOfDayTTLSeconds();

    // Wait a tiny bit (this is a race condition risk, but minimal)
    const now = Date.now();
    while (Date.now() === now) {
      // busy wait
    }

    const ttl2 = getEndOfDayTTLSeconds();

    // TTL should decrease slightly as time passes
    // (or be the same if we're still in the same second)
    expect(ttl2).toBeLessThanOrEqual(ttl1);
  });

  it('should calculate correct end of day', () => {
    const now = new Date();
    const ttl = getEndOfDayTTLSeconds();

    // Calculate expected end of day
    const expectedEndOfDay = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      ),
    );

    const actualEndOfDay = new Date(now.getTime() + ttl * 1000);

    // Allow for small time difference (1 second) due to execution time
    const diff = Math.abs(
      actualEndOfDay.getTime() - expectedEndOfDay.getTime(),
    );
    expect(diff).toBeLessThan(1000); // Less than 1 second difference
  });
});

describe('getSessionCookieName', () => {
  it('should return the session cookie name', () => {
    expect(getSessionCookieName()).toBe('uth_session_id');
  });
});
