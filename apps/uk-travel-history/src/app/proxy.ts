import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserByAuthId } from '@uth/db';
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
 * Passkey enrollment check middleware
 * Verifies that authenticated users have enrolled passkeys for sensitive routes
 */
const passkeyEnrollmentMiddleware = async (
  auth: any,
  req: NextRequest,
): Promise<NextResponse> => {
  const { clerkClient, createRouteMatcher } =
    await import('@clerk/nextjs/server');

  // Define public routes that don't require authentication
  const isPublicRoute = createRouteMatcher([
    '/',
    '/travel',
    '/api/billing/checkout',
    '/api/stripe/webhook',
    '/api/cron/supabase-keepalive',
    '/api/parse',
    '/api/export',
  ]);

  // Define routes that require passkey enrollment
  const requiresPasskeyRoute = createRouteMatcher([
    '/travel',
    '/api/parse',
    '/api/export',
  ]);

  const { userId } = await auth();

  // Allow public routes
  if (isPublicRoute(req)) {
    // For authenticated users on public routes that require passkey
    if (userId && requiresPasskeyRoute(req)) {
      try {
        // First check Clerk public metadata (cached)
        const client = await clerkClient();
        const user = await client.users.getUser(userId);

        // Check metadata cache first
        const passkeyEnrolled = user.publicMetadata?.passkey_enrolled as
          | boolean
          | undefined;

        if (passkeyEnrolled === true) {
          // Fast path: metadata confirms enrollment
          return NextResponse.next();
        }

        // Fallback to database if metadata not set or false
        const dbUser = await getUserByAuthId(userId);

        if (!dbUser) {
          // User not found in database yet - redirect to onboarding
          return NextResponse.redirect(new URL('/onboarding/passkey', req.url));
        }

        if (!dbUser.passkeyEnrolled) {
          // User hasn't enrolled passkey
          return NextResponse.redirect(new URL('/onboarding/passkey', req.url));
        }

        // If we get here, Supabase says enrolled but metadata doesn't
        // Sync metadata in background (fire and forget)
        client.users
          .updateUser(userId, {
            publicMetadata: {
              ...user.publicMetadata,
              passkey_enrolled: true,
            },
          })
          .catch((err) => {
            logger.error('Failed to sync passkey metadata', err);
          });
      } catch (error) {
        logger.error('Error checking passkey enrollment', error);
        // On error, allow through to avoid blocking legitimate users
        // The actual protected resources will handle auth
        return NextResponse.next();
      }
    }

    return NextResponse.next();
  }

  // For protected routes, ensure authentication
  if (!userId) {
    return NextResponse.redirect(new URL('/claim', req.url));
  }

  return NextResponse.next();
};

/**
 * Clerk authentication middleware
 * Integrates with Clerk's clerkMiddleware and handles passkey enforcement
 */
const clerkAuthMiddleware: MiddlewareFunction = async (
  req: NextRequest,
): Promise<NextResponse | null> => {
  const { clerkMiddleware } = await import('@clerk/nextjs/server');
  const wrappedMiddleware = clerkMiddleware(passkeyEnrollmentMiddleware);
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
 * 3. If Clerk: check credentials → run Clerk auth → enforce passkey
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
