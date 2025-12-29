/**
 * Tests for /api/cron/supabase-keepalive endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { configureRouteLogger } from '@uth/flow';

// Mock dependencies
vi.mock('@uth/db', () => ({
  keepalive: vi.fn(),
}));

// Create mock logger for testing
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

import { keepalive } from '@uth/db';

const mockKeepalive = vi.mocked(keepalive);

describe('GET /api/cron/supabase-keepalive', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Configure route logger with mock
    configureRouteLogger({
      logger: mockLogger,
    });

    process.env.CRON_SECRET = 'test-cron-secret';

    // Setup default mock implementation
    mockKeepalive.mockResolvedValue(1);
  });

  it('should successfully call keepalive with valid secret', async () => {
    // Arrange
    const request = new NextRequest('http://localhost:3000/api/cron/supabase-keepalive', {
      method: 'GET',
      headers: {
        'authorization': 'Bearer test-cron-secret',
      },
    });

    // Act
    const response = await GET(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.result).toBe(1);
    expect(data.timestamp).toBeDefined();
  });

  it('should return 401 if authorization header is missing', async () => {
    // Arrange
    const request = new NextRequest('http://localhost:3000/api/cron/supabase-keepalive', {
      method: 'GET',
    });

    // Act
    const response = await GET(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 if cron secret is invalid', async () => {
    // Arrange
    const request = new NextRequest('http://localhost:3000/api/cron/supabase-keepalive', {
      method: 'GET',
      headers: {
        'authorization': 'Bearer wrong-secret',
      },
    });

    // Act
    const response = await GET(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 500 if CRON_SECRET is not configured', async () => {
    // Arrange
    delete process.env.CRON_SECRET;
    const request = new NextRequest('http://localhost:3000/api/cron/supabase-keepalive', {
      method: 'GET',
      headers: {
        'authorization': 'Bearer test-cron-secret',
      },
    });

    // Act
    const response = await GET(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data.error).toBe('Cron secret not configured');
  });
});
