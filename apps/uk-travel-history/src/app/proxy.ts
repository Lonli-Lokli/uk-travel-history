import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@uth/utils';
import { compose, when, type MiddlewareFunction } from './middleware-compose';

/**
 * Determine the auth provider from environment
 * Defaults to 'clerk' if not specified
 */
const getAuthProvider = (): 'clerk' | 'firebase' => {
  const provider = process.env.UTH_AUTH_PROVIDER;
  return provider === 'firebase' ? 'firebase' : 'clerk';
};

/**
 * Check if Clerk credentials are configured
 */
const hasClerkCredentials = (): boolean => {
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
      logger.error(
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
 * Route protection middleware for issue #100: Public sign-up model
 * Handles AUTHENTICATION only (not authorization)
 *
 * Security model:
 * - Middleware: Route-level authentication (this function)
 * - API Routes: Feature-based authorization via @uth/features
 * - Database: RLS policies enforce data isolation + premium access
 */
const routeProtectionMiddleware = async (
  auth: any,
  req: NextRequest,
): Promise<NextResponse> => {
  const { createRouteMatcher } = await import('@clerk/nextjs/server');

  // Public routes - no authentication required
  const isPublicRoute = createRouteMatcher([
    '/',
    '/about',
    '/terms',
    '/status',
    '/travel', // Free feature - accessible to all
    '/api/parse', // Free feature
    '/api/export', // Premium check happens in route handler
    '/api/billing/checkout',
    '/api/stripe/webhook',
    '/api/webhooks/clerk',
    '/api/cron/supabase-keepalive',
  ]);

  const { userId } = await auth();

  // Allow public routes without authentication
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Protected routes require authentication
  if (!userId) {
    return NextResponse.redirect(new URL('/claim', req.url));
  }

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
 * Composition strategy (issue #100: public sign-up model):
 * 1. Check auth provider mode (Firebase vs Clerk)
 * 2. If Firebase: pass through (auth handled in API routes)
 * 3. If Clerk: check credentials → run Clerk auth → protect routes
 *
 * This demonstrates functional programming principles:
 * - Pure functions for each concern (auth provider check, credential check, etc.)
 * - Conditional composition via `when()` helper
 * - Clear separation of concerns (authentication vs authorization)
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
