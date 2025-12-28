import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { compose, logger, MiddlewareFunction, when } from '@uth/utils';
import type { LogOptions } from '@uth/utils';

/**
 * Logger interface for dependency injection
 * Allows tests to provide custom logger implementations
 */
export interface Logger {
  error: (message: string, error?: unknown, options?: LogOptions) => void;
  warn: (message: string, options?: LogOptions) => void;
  info: (message: string, options?: LogOptions) => void;
  debug: (message: string, options?: LogOptions) => void;
}

/**
 * Configuration options for the proxy middleware
 * Allows injection of dependencies for better testability
 */
export interface ProxyConfig {
  /**
   * Logger implementation (defaults to @uth/utils logger)
   */
  logger?: Logger;

  /**
   * Get auth provider (defaults to reading from process.env)
   */
  getAuthProvider?: () => 'clerk' | 'firebase';

  /**
   * Check if Clerk credentials are configured (defaults to checking process.env)
   */
  hasClerkCredentials?: () => boolean;
}

/**
 * Global configuration for the proxy middleware
 * Can be set via configureProxy() for testing or customization
 */
let proxyConfig: ProxyConfig = {};

/**
 * Configure the proxy middleware with custom dependencies
 * Useful for testing or customizing behavior
 *
 * @example
 * // In tests
 * configureProxy({
 *   logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
 * });
 *
 * @example
 * // Reset to defaults
 * configureProxy({});
 */
export function configureProxy(config: ProxyConfig): void {
  proxyConfig = config;
}

/**
 * Get the configured logger or fall back to default
 */
function getLogger(): Logger {
  return proxyConfig.logger || logger;
}

/**
 * Determine the auth provider from environment
 * Defaults to 'clerk' if not specified
 */
const getAuthProvider = (): 'clerk' | 'firebase' => {
  if (proxyConfig.getAuthProvider) {
    return proxyConfig.getAuthProvider();
  }
  const provider = process.env.UTH_AUTH_PROVIDER;
  return provider === 'firebase' ? 'firebase' : 'clerk';
};

/**
 * Check if Clerk credentials are configured
 */
const hasClerkCredentials = (): boolean => {
  if (proxyConfig.hasClerkCredentials) {
    return proxyConfig.hasClerkCredentials();
  }
  return !!(
    process.env.CLERK_SECRET_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );
};

/**
 * Firebase mode middleware - always passes through
 * Firebase auth is handled in API routes via serverAuth utilities
 */
const firebaseMiddleware: MiddlewareFunction = async (
  _req: NextRequest,
): Promise<NextResponse | null> => {
  return NextResponse.next();
};

/**
 * Middleware that logs missing Clerk credentials in development
 */
const clerkCredentialsCheckMiddleware: MiddlewareFunction = async (
  _req: NextRequest,
): Promise<NextResponse | null> => {
  if (!hasClerkCredentials()) {
    if (process.env.NODE_ENV === 'development') {
      const log = getLogger();
      log.error(
        '\n⚠️  Clerk credentials missing!\n' +
          'Set CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local\n' +
          'Or set UTH_AUTH_PROVIDER=firebase to use legacy auth.\n',
        undefined,
      );
    }
    // Allow through without auth (app will show appropriate UI)
    return NextResponse.next();
  }
  // Return null to continue to next middleware
  return null;
};

/**
 * Route protection middleware for public sign-up model
 * Per issue #100: Public sign-up enabled, passkeys optional, RLS enforces security
 */
const routeProtectionMiddleware = async (
  auth: any,
  req: NextRequest,
): Promise<NextResponse> => {
  const { createRouteMatcher } = await import('@clerk/nextjs/server');

  // Define public routes that don't require authentication
  // Per issue #100: landing, pricing, docs/blog, public previews, free features
  const isPublicRoute = createRouteMatcher([
    '/',
    '/about',
    '/terms',
    '/status',
    '/travel', // Free tier access to travel tracker
    '/api/parse',
    '/api/export',
    '/api/billing/checkout',
    '/api/stripe/webhook',
    '/api/webhooks/clerk',
    '/api/cron/supabase-keepalive',
    '/api/user/provision', // Manual user provisioning fallback
  ]);

  // Define protected routes that require authentication
  // Per issue #100: member/premium routes redirect to /sign-in
  const isProtectedRoute = createRouteMatcher([
    '/api/billing/(.*)',
  ]);

  const { userId } = await auth();

  // Allow public routes without authentication
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Protected routes require authentication
  if (isProtectedRoute(req) && !userId) {
    // Redirect to sign-in for protected routes
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Default: allow through
  // RLS policies in Supabase will enforce actual data access control
  return NextResponse.next();
};

/**
 * Clerk authentication middleware
 * Integrates with Clerk's clerkMiddleware and handles route protection
 */
const clerkAuthMiddleware: MiddlewareFunction = async (
  req: NextRequest,
): Promise<NextResponse | null> => {
  const { clerkMiddleware } = await import('@clerk/nextjs/server');
  const wrappedMiddleware = clerkMiddleware(routeProtectionMiddleware);
  const result = await wrappedMiddleware(req, {} as any);
  // Clerk middleware can return Response or undefined, convert to NextResponse | null
  if (!result) return null;
  return result instanceof NextResponse ? result : NextResponse.next();
};

/**
 * Main proxy function using functional composition
 *
 * Composition strategy:
 * 1. Check auth provider mode (Firebase vs Clerk)
 * 2. If Firebase: pass through (auth handled in API routes)
 * 3. If Clerk: check credentials → run Clerk auth → protect routes
 *
 * Per issue #100: Public sign-up model with RLS-enforced security
 * - No passkey enforcement (passkeys optional)
 * - Route protection: public routes open, member/premium routes require auth
 * - Data security enforced by Supabase RLS policies, not middleware
 *
 * This demonstrates functional programming principles:
 * - Pure functions for each concern (auth provider check, credential check, etc.)
 * - Conditional composition via `when()` helper
 * - Clear separation of concerns
 */
const proxy = async (req: NextRequest): Promise<NextResponse> => {
  const authProvider = getAuthProvider();

  // Functional composition based on auth provider
  const middleware = compose(
    // Firebase mode: always pass through
    when(() => authProvider === 'firebase', firebaseMiddleware),

    // Clerk mode: check credentials first
    when(() => authProvider === 'clerk', clerkCredentialsCheckMiddleware),

    // Clerk mode with credentials: run full auth flow
    when(
      () => authProvider === 'clerk' && hasClerkCredentials(),
      clerkAuthMiddleware,
    ),
  );

  const response = await middleware(req);

  // If no middleware returned a response, pass through
  return response || NextResponse.next();
};

export default proxy;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};


