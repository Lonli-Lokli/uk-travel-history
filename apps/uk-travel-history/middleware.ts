/**
 * Next.js Middleware Entry Point
 *
 * This file exists to satisfy Clerk's middleware detection for currentUser().
 * The actual middleware logic is in proxy.ts for better organization.
 *
 * Clerk's currentUser() function looks for middleware.ts to verify that
 * clerkMiddleware() is being used. By importing from proxy.ts, we
 * maintain our custom middleware structure while satisfying Clerk's requirements.
 */

import proxy from './src/app/proxy';

export default proxy;

// Next.js requires config to be defined directly in middleware.ts
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
