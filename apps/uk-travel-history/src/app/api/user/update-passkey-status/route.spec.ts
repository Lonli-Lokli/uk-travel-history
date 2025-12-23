/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@uth/utils', () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockAuth = vi.mocked(await import('@clerk/nextjs/server')).auth;
const mockGetSupabaseServerClient = vi.mocked(
  await import('@uth/utils')
).getSupabaseServerClient;

describe('POST /api/user/update-passkey-status', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Supabase client
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    mockGetSupabaseServerClient.mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully update passkey status to true', async () => {
    // Arrange
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);

    const request = new NextRequest('http://localhost:3000/api/user/update-passkey-status', {
      method: 'POST',
      body: JSON.stringify({ enrolled: true }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith({ passkey_enrolled: true });
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('clerk_user_id', 'user_123');
  });

  it('should successfully update passkey status to false', async () => {
    // Arrange
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);

    const request = new NextRequest('http://localhost:3000/api/user/update-passkey-status', {
      method: 'POST',
      body: JSON.stringify({ enrolled: false }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(mockSupabaseClient.update).toHaveBeenCalledWith({ passkey_enrolled: false });
  });

  it('should return 401 when user is not authenticated', async () => {
    // Arrange
    mockAuth.mockResolvedValue({ userId: null } as any);

    const request = new NextRequest('http://localhost:3000/api/user/update-passkey-status', {
      method: 'POST',
      body: JSON.stringify({ enrolled: true }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 when enrolled field is missing', async () => {
    // Arrange
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);

    const request = new NextRequest('http://localhost:3000/api/user/update-passkey-status', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toContain('enrolled must be a boolean');
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should return 400 when enrolled is not a boolean', async () => {
    // Arrange
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);

    const request = new NextRequest('http://localhost:3000/api/user/update-passkey-status', {
      method: 'POST',
      body: JSON.stringify({ enrolled: 'yes' }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toContain('enrolled must be a boolean');
  });

  it('should return 500 when Supabase update fails', async () => {
    // Arrange
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);

    mockSupabaseClient.eq.mockResolvedValue({
      error: { message: 'Database error' },
    });

    const request = new NextRequest('http://localhost:3000/api/user/update-passkey-status', {
      method: 'POST',
      body: JSON.stringify({ enrolled: true }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to update passkey status' });
  });

  it('should handle JSON parse errors', async () => {
    // Arrange
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any);

    const request = new NextRequest('http://localhost:3000/api/user/update-passkey-status', {
      method: 'POST',
      body: 'invalid json',
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });

  it('should handle auth errors gracefully', async () => {
    // Arrange
    mockAuth.mockRejectedValue(new Error('Auth service unavailable'));

    const request = new NextRequest('http://localhost:3000/api/user/update-passkey-status', {
      method: 'POST',
      body: JSON.stringify({ enrolled: true }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });
});
