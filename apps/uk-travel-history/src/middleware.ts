import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@uth/db';
import { logger } from '@uth/utils';

/**
 * Determine the auth provider from environment
 * Defaults to 'clerk' if not specified
 */
function getAuthProvider(): 'clerk' | 'firebase' {
  const provider = process.env.UTH_AUTH_PROVIDER;
  if (provider === 'firebase') {
    return 'firebase';
  }
  return 'clerk';
}

/**
 * Check if Clerk credentials are configured
 */
function hasClerkCredentials(): boolean {
  return !!(
    process.env.CLERK_SECRET_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );
}

/**
 * Middleware handler for Clerk-based auth
 * Checks passkey enrollment and redirects if needed
 */
async function handleClerkMiddleware(auth: any, req: NextRequest) {
  // Dynamically import Clerk functions only when needed
  const { clerkClient, createRouteMatcher } = await import('@clerk/nextjs/server');

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
        const passkeyEnrolled = user.publicMetadata?.passkey_enrolled as boolean | undefined;

        if (passkeyEnrolled === true) {
          // Fast path: metadata confirms enrollment
          return NextResponse.next();
        }

        // Fallback to Supabase if metadata not set or false
        const supabase = getSupabaseServerClient();
        const { data: dbUser, error } = await supabase
          .from('users')
          .select('passkey_enrolled')
          .eq('clerk_user_id', userId)
          .single();

        if (error || !dbUser) {
          // User not found in database yet - redirect to onboarding
          return NextResponse.redirect(new URL('/onboarding/passkey', req.url));
        }

        if (!dbUser.passkey_enrolled) {
          // User hasn't enrolled passkey
          return NextResponse.redirect(new URL('/onboarding/passkey', req.url));
        }

        // If we get here, Supabase says enrolled but metadata doesn't
        // Sync metadata in background (fire and forget)
        client.users.updateUser(userId, {
          publicMetadata: {
            ...user.publicMetadata,
            passkey_enrolled: true,
          },
        }).catch((err) => {
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
}

/**
 * Main middleware function
 * Respects UTH_AUTH_PROVIDER setting:
 * - 'clerk' (default): Runs Clerk middleware with passkey enforcement
 * - 'firebase': Skips middleware (Firebase auth handles it separately)
 */
async function middleware(req: NextRequest) {
  const authProvider = getAuthProvider();

  // Firebase mode: Skip all middleware (legacy auth flow)
  if (authProvider === 'firebase') {
    return NextResponse.next();
  }

  // Clerk mode: Check if credentials are configured
  if (!hasClerkCredentials()) {
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      logger.error(
        '\n⚠️  Clerk credentials missing!\n' +
        'Set CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local\n' +
        'Or set UTH_AUTH_PROVIDER=firebase to use legacy auth.\n',
        undefined
      );
    }
    // Allow request through without auth (app will show appropriate UI)
    return NextResponse.next();
  }

  // Clerk mode with credentials: Use Clerk middleware
  // Dynamic import to avoid module-load-time errors
  const { clerkMiddleware } = await import('@clerk/nextjs/server');
  const wrappedMiddleware = clerkMiddleware(handleClerkMiddleware);
  return wrappedMiddleware(req, {} as any);
}

export default middleware;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
