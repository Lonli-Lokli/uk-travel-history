/**
 * Next.js Middleware for route protection and authentication
 *
 * This middleware integrates Clerk authentication and protects routes
 * based on authentication status.
 *
 * Route Strategy:
 * - Public routes: Accessible to everyone (landing, about, terms, etc.)
 * - Protected routes: Require authentication (travel, status, onboarding)
 * - Premium routes: Future expansion for subscription-gated features
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public routes accessible to everyone
const isPublicRoute = createRouteMatcher([
  '/',                    // Landing page
  '/about',               // About page
  '/terms',               // Terms page
  '/status',              // Status page (can be public for SEO)
  '/sign-in(.*)',         // Clerk sign-in pages
  '/sign-up(.*)',         // Clerk sign-up pages
  '/api/parse',           // PDF parsing (can work client-side)
  '/api/export',          // Excel export (can work client-side)
  '/api/webhooks/(.*)',   // Webhook endpoints (verified separately)
  '/api/cron/(.*)',       // Cron endpoints (verified by Vercel)
]);

// Routes that explicitly require authentication
const isProtectedRoute = createRouteMatcher([
  '/travel',              // Main application
  '/onboarding/(.*)',     // Onboarding flows
  '/claim',               // Account claiming (technically auth, but Clerk handles it)
  '/api/billing/(.*)',    // Billing operations
  '/api/user/(.*)',       // User operations
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect routes that require authentication
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Public routes are accessible without authentication
  // No action needed for public routes
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
