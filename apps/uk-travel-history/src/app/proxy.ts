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
 * Route authorization middleware
 * Handles authentication and authorization for protected routes
 * Part of issue #100: defense-in-depth security with middleware + RLS
 */
const routeAuthorizationMiddleware = async (
  auth: any,
  req: NextRequest,
): Promise<NextResponse> => {
  const { clerkClient, createRouteMatcher } =
    await import('@clerk/nextjs/server');

  // Define public routes that don't require authentication
  const isPublicRoute = createRouteMatcher([
    '/',
    '/about',
    '/terms',
    '/status',
    '/travel',
    '/api/parse',
    '/api/billing/checkout',
    '/api/stripe/webhook',
    '/api/webhooks/clerk',
    '/api/cron/supabase-keepalive',
  ]);

  // Define routes that require premium subscription
  // These routes get double-checked: here in middleware AND in route handlers
  const requiresPremiumRoute = createRouteMatcher([
    '/api/export',
    '/api/import-full',
  ]);

  const { userId } = await auth();

  // Allow public routes without auth check
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // For all non-public routes, require authentication
  if (!userId) {
    return NextResponse.redirect(new URL('/claim', req.url));
  }

  // For premium routes, check subscription status using Clerk metadata
  // This provides early rejection before reaching route handlers
  if (requiresPremiumRoute(req)) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);

      // Check if user has premium access via public metadata
      // This is synced from Stripe webhooks or subscription updates
      const subscriptionTier = user.publicMetadata?.subscription_tier as
        | string
        | undefined;
      const subscriptionStatus = user.publicMetadata?.subscription_status as
        | string
        | undefined;

      // Allow access if user has active premium subscription
      // Tiers: 'free', 'monthly', 'yearly', 'lifetime'
      // Statuses: 'active', 'trialing', 'past_due', 'canceled', etc.
      const hasPremiumTier = ['monthly', 'yearly', 'lifetime'].includes(
        subscriptionTier || '',
      );
      const hasActiveStatus = ['active', 'trialing'].includes(
        subscriptionStatus || '',
      );

      if (!hasPremiumTier || !hasActiveStatus) {
        // User doesn't have premium access - return 403
        return NextResponse.json(
          {
            error: 'Premium subscription required',
            code: 'premium_required',
          },
          { status: 403 },
        );
      }

      // User has premium access - allow through
      // Route handler will perform additional validation via assertFeatureAccess
      return NextResponse.next();
    } catch (error) {
      logger.error('Error checking premium access in middleware', error);
      // On error, allow through to route handler
      // The route handler's assertFeatureAccess will be the final gate
      return NextResponse.next();
    }
  }

  // For other protected routes, allow authenticated users through
  return NextResponse.next();
};

/**
 * Clerk authentication middleware
 * Integrates with Clerk's clerkMiddleware and handles route authorization
 */
const clerkAuthMiddleware: MiddlewareFunction = async (
  req: NextRequest,
): Promise<NextResponse | null> => {
  const { clerkMiddleware } = await import('@clerk/nextjs/server');
  const wrappedMiddleware = clerkMiddleware(routeAuthorizationMiddleware);
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
 * 3. If Clerk: check credentials → run Clerk auth → enforce route authorization
 *
 * Authorization layers (defense-in-depth for issue #100):
 * - Middleware: Early rejection for premium routes using Clerk metadata
 * - Route handlers: Feature-based enforcement via assertFeatureAccess
 * - Database: Supabase RLS policies enforce data access
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
