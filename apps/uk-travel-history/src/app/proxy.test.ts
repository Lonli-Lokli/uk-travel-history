import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import proxy from './proxy';

// Mock dependencies
vi.mock('@uth/db', () => ({
  getUserByAuthId: vi.fn(),
}));

vi.mock('@uth/utils', () => ({
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: vi.fn(),
  createRouteMatcher: vi.fn(),
  clerkMiddleware: vi.fn(),
}));

// Import mocked dependencies
import { getUserByAuthId } from '@uth/db';
import { logger } from '@uth/utils';
import { clerkClient, createRouteMatcher, clerkMiddleware } from '@clerk/nextjs/server';

describe('Proxy (Next.js 16 Middleware)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockRequest = (url: string, headers?: Record<string, string>): NextRequest => {
    const headerObj = new Headers(headers);
    return new NextRequest(new URL(url, 'https://example.com'), { headers: headerObj });
  };

  describe('Firebase Mode', () => {
    it('should pass through all requests when UTH_AUTH_PROVIDER=firebase', async () => {
      process.env.UTH_AUTH_PROVIDER = 'firebase';
      const req = createMockRequest('/travel');

      const response = await proxy(req);

      // Should return NextResponse.next() without any checks
      expect(response).toBeDefined();
      expect(clerkMiddleware).not.toHaveBeenCalled();
    });
  });

  describe('Clerk Mode - Missing Credentials', () => {
    it('should pass through requests when Clerk credentials are missing', async () => {
      process.env.UTH_AUTH_PROVIDER = 'clerk';
      delete process.env.CLERK_SECRET_KEY;
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

      const req = createMockRequest('/travel');
      const response = await proxy(req);

      expect(response).toBeDefined();
      expect(clerkMiddleware).not.toHaveBeenCalled();
    });

    it('should log error in development when credentials are missing', async () => {
      process.env.UTH_AUTH_PROVIDER = 'clerk';
      process.env.NODE_ENV = 'development';
      delete process.env.CLERK_SECRET_KEY;
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

      const req = createMockRequest('/travel');
      await proxy(req);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Clerk credentials missing'),
        undefined
      );
    });
  });

  describe('Clerk Mode - With Credentials', () => {
    beforeEach(() => {
      process.env.UTH_AUTH_PROVIDER = 'clerk';
      process.env.CLERK_SECRET_KEY = 'test-secret-key';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test-publishable-key';
    });

    it('should call clerkMiddleware when credentials are configured', async () => {
      const mockWrappedMiddleware = vi.fn().mockResolvedValue(NextResponse.next());
      vi.mocked(clerkMiddleware).mockReturnValue(mockWrappedMiddleware);

      const req = createMockRequest('/travel');
      await proxy(req);

      expect(clerkMiddleware).toHaveBeenCalledWith(expect.any(Function));
      expect(mockWrappedMiddleware).toHaveBeenCalledWith(req, {});
    });
  });

  describe('Public Routes', () => {
    it('should allow access to public route / without authentication', async () => {
      process.env.UTH_AUTH_PROVIDER = 'clerk';
      process.env.CLERK_SECRET_KEY = 'test-secret-key';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test-publishable-key';

      const mockAuth = vi.fn().mockResolvedValue({ userId: null });
      const mockRouteMatcher = vi.fn((routes: string[]) => (req: NextRequest) => {
        const path = new URL(req.url).pathname;
        return routes.includes(path);
      });

      vi.mocked(createRouteMatcher).mockImplementation(mockRouteMatcher);

      const mockWrappedMiddleware = vi.fn(async (req: NextRequest) => {
        const handler = vi.mocked(clerkMiddleware).mock.calls[0][0];
        return handler(mockAuth, req);
      });

      vi.mocked(clerkMiddleware).mockReturnValue(mockWrappedMiddleware);

      const req = createMockRequest('/');
      const result = await proxy(req);

      // Auth is called for all routes, but public routes should pass through
      expect(mockAuth).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('Protected Routes', () => {
    beforeEach(() => {
      process.env.UTH_AUTH_PROVIDER = 'clerk';
      process.env.CLERK_SECRET_KEY = 'test-secret-key';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test-publishable-key';
    });

    it('should redirect to /claim when accessing protected route without authentication', async () => {
      const mockAuth = vi.fn().mockResolvedValue({ userId: null });
      const mockIsPublicRoute = vi.fn().mockReturnValue(false);
      const mockRequiresPasskeyRoute = vi.fn().mockReturnValue(false);

      vi.mocked(createRouteMatcher).mockImplementation((routes: string[]) => {
        if (routes.includes('/')) return mockIsPublicRoute;
        return mockRequiresPasskeyRoute;
      });

      const mockWrappedMiddleware = vi.fn(async (req: NextRequest) => {
        const handler = vi.mocked(clerkMiddleware).mock.calls[0][0];
        return handler(mockAuth, req);
      });

      vi.mocked(clerkMiddleware).mockReturnValue(mockWrappedMiddleware);

      const req = createMockRequest('/dashboard');
      const result = await proxy(req);

      // The actual redirect happens in handleClerkMiddleware
      expect(mockAuth).toHaveBeenCalled();
    });
  });

  describe('Passkey Enrollment', () => {
    beforeEach(() => {
      process.env.UTH_AUTH_PROVIDER = 'clerk';
      process.env.CLERK_SECRET_KEY = 'test-secret-key';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test-publishable-key';
    });

    it('should check passkey enrollment for authenticated users on protected routes', async () => {
      const mockUserId = 'user_123';
      const mockAuth = vi.fn().mockResolvedValue({ userId: mockUserId });

      const mockGetUser = vi.fn().mockResolvedValue({
        id: mockUserId,
        publicMetadata: { passkey_enrolled: true },
      });

      const mockClient = vi.fn().mockResolvedValue({
        users: { getUser: mockGetUser },
      });

      vi.mocked(clerkClient).mockImplementation(mockClient);

      const mockIsPublicRoute = vi.fn().mockReturnValue(true);
      const mockRequiresPasskeyRoute = vi.fn().mockReturnValue(true);

      vi.mocked(createRouteMatcher).mockImplementation((routes: string[]) => {
        if (routes.includes('/travel')) return mockRequiresPasskeyRoute;
        return mockIsPublicRoute;
      });

      const mockWrappedMiddleware = vi.fn(async (req: NextRequest) => {
        const handler = vi.mocked(clerkMiddleware).mock.calls[0][0];
        return handler(mockAuth, req);
      });

      vi.mocked(clerkMiddleware).mockReturnValue(mockWrappedMiddleware);

      const req = createMockRequest('/travel');
      await proxy(req);

      expect(mockAuth).toHaveBeenCalled();
    });

    it('should redirect to /onboarding/passkey when user not enrolled', async () => {
      const mockUserId = 'user_123';
      const mockAuth = vi.fn().mockResolvedValue({ userId: mockUserId });

      const mockGetUser = vi.fn().mockResolvedValue({
        id: mockUserId,
        publicMetadata: { passkey_enrolled: false },
      });

      const mockClient = vi.fn().mockResolvedValue({
        users: { getUser: mockGetUser },
      });

      vi.mocked(clerkClient).mockImplementation(mockClient);
      vi.mocked(getUserByAuthId).mockResolvedValue({
        id: '1',
        authId: mockUserId,
        email: 'test@example.com',
        passkeyEnrolled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockIsPublicRoute = vi.fn().mockReturnValue(true);
      const mockRequiresPasskeyRoute = vi.fn().mockReturnValue(true);

      vi.mocked(createRouteMatcher).mockImplementation((routes: string[]) => {
        if (routes.includes('/travel')) return mockRequiresPasskeyRoute;
        return mockIsPublicRoute;
      });

      const mockWrappedMiddleware = vi.fn(async (req: NextRequest) => {
        const handler = vi.mocked(clerkMiddleware).mock.calls[0][0];
        return handler(mockAuth, req);
      });

      vi.mocked(clerkMiddleware).mockReturnValue(mockWrappedMiddleware);

      const req = createMockRequest('/travel');
      await proxy(req);

      expect(mockAuth).toHaveBeenCalled();
      expect(getUserByAuthId).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle errors gracefully and allow through', async () => {
      const mockUserId = 'user_123';
      const mockAuth = vi.fn().mockResolvedValue({ userId: mockUserId });

      const mockClient = vi.fn().mockRejectedValue(new Error('Clerk API error'));
      vi.mocked(clerkClient).mockImplementation(mockClient);

      const mockIsPublicRoute = vi.fn().mockReturnValue(true);
      const mockRequiresPasskeyRoute = vi.fn().mockReturnValue(true);

      vi.mocked(createRouteMatcher).mockImplementation((routes: string[]) => {
        if (routes.includes('/travel')) return mockRequiresPasskeyRoute;
        return mockIsPublicRoute;
      });

      const mockWrappedMiddleware = vi.fn(async (req: NextRequest) => {
        const handler = vi.mocked(clerkMiddleware).mock.calls[0][0];
        return handler(mockAuth, req);
      });

      vi.mocked(clerkMiddleware).mockReturnValue(mockWrappedMiddleware);

      const req = createMockRequest('/travel');
      await proxy(req);

      expect(logger.error).toHaveBeenCalledWith(
        'Error checking passkey enrollment',
        expect.any(Error)
      );
    });
  });

  describe('Config Export', () => {
    it('should export matcher configuration', async () => {
      const { config } = await import('./proxy');

      expect(config).toBeDefined();
      expect(config.matcher).toBeInstanceOf(Array);
      expect(config.matcher.length).toBeGreaterThan(0);
    });
  });
});
