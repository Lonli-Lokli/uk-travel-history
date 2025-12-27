/**
 * Next.js 16 Proxy Entry Point
 *
 * This file satisfies Next.js 16's proxy.ts naming convention requirement.
 * The actual proxy logic is in src/app/proxy.ts for better code organization.
 *
 * Per Next.js 16 documentation: https://nextjs.org/docs/app/getting-started/proxy
 * - File must be named proxy.ts (not middleware.ts)
 * - Must be at project root or src/ directory level
 * - Config must be exported from this file
 */

import proxyFunction from './src/app/proxy';

export default proxyFunction;

// Next.js requires config to be defined directly in proxy.ts
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
