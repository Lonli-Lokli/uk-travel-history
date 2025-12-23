import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId } = await auth();

  // Allow public routes
  if (isPublicRoute(req)) {
    // For authenticated users on public routes that require passkey
    if (userId && requiresPasskeyRoute(req)) {
      // Check if user has enrolled passkey
      // We'll need to check Supabase for this
      // For now, redirect to onboarding if needed
      const { getSupabaseServerClient } = await import('@uth/utils');
      const supabase = getSupabaseServerClient();

      const { data: user } = await supabase
        .from('users')
        .select('passkey_enrolled')
        .eq('clerk_user_id', userId)
        .single();

      if (user && !user.passkey_enrolled) {
        // User is authenticated but hasn't enrolled passkey
        return NextResponse.redirect(new URL('/onboarding/passkey', req.url));
      }
    }

    return NextResponse.next();
  }

  // For protected routes, ensure authentication
  if (!userId) {
    return NextResponse.redirect(new URL('/claim', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
