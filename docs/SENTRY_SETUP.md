# Sentry Integration Setup Guide

This document explains the Sentry integration for the UK Travel History application and how to configure it properly.

## Overview

The application uses Sentry for error tracking and performance monitoring in production. The setup follows the official Next.js integration patterns with proper environment handling.

## Configuration Files

### Core Configuration Files

1. **`sentry.client.config.ts`** - Client-side (browser) initialization
2. **`sentry.server.config.ts`** - Server-side (Node.js) initialization
3. **`sentry.edge.config.ts`** - Edge runtime (middleware) initialization
4. **`instrumentation.ts`** - Next.js instrumentation entry point
5. **`next.config.js`** - Build-time configuration with `withSentryConfig()`

### Supporting Files

1. **`.sentryclirc`** - Sentry CLI configuration (org/project settings)
2. **`.env.example`** - Environment variable documentation

## Key Features

### 1. Environment-Based Behavior

The integration automatically adjusts based on the environment:

- **Development (localhost)**: Sentry is **disabled** to avoid noise
- **Production (Vercel)**: Sentry is **enabled** with full error tracking

Environment detection uses this priority:
1. `NEXT_PUBLIC_VERCEL_ENV` (client-side)
2. `VERCEL_ENV` (server-side)
3. `NODE_ENV` (fallback)

### 2. Source Maps Upload

Source maps are automatically uploaded during production builds to provide readable stack traces in Sentry.

**Requirements:**
- `SENTRY_AUTH_TOKEN` environment variable must be set in Vercel
- Token needs these scopes: `project:read`, `project:releases`, `org:read`

**How it works:**
1. During `nx build`, Next.js compiles your code
2. The Sentry webpack plugin uploads source maps to Sentry
3. Source maps are hidden from public access (`hideSourceMaps: true`)
4. In production, Sentry shows original TypeScript code in error stack traces

### 3. Error Filtering

All Sentry config files include a `beforeSend` hook that filters out:
- Localhost errors (even if they somehow reach production)
- Any other noise you want to exclude

### 4. Sampling

To control costs and volume:
- **Error tracking**: 100% sampling (all errors captured)
- **Performance traces**: 10% sampling
- **Profiling**: 10% sampling

Adjust these in the `sentry.*.config.ts` files if needed.

## Setup Instructions

### For Local Development

No setup needed! Sentry is automatically disabled in development to avoid noise.

### For Vercel Deployment

1. **Get a Sentry Auth Token**
   - Go to https://sentry.io/settings/account/api/auth-tokens/
   - Click "Create New Token"
   - Name: "Vercel Deploy Token" (or similar)
   - Scopes: `project:read`, `project:releases`, `org:read`
   - Copy the token (you won't see it again!)

2. **Add to Vercel Environment Variables**
   - Go to your project in Vercel
   - Navigate to Settings → Environment Variables
   - Add variable:
     - Name: `SENTRY_AUTH_TOKEN`
     - Value: (paste your token)
     - Environments: Check Production, Preview, and Development
   - Click "Save"

3. **Redeploy**
   - Trigger a new deployment
   - Check the build logs for "Uploading source maps to Sentry"
   - You should see successful upload messages

## Verifying the Setup

### 1. Check Source Maps Upload

After deploying, check your build logs in Vercel:

```
✓ Sentry source maps uploaded successfully
✓ Source Map Upload: 45 files uploaded
```

### 2. Test Error Reporting

Create a test error in production:

```typescript
// Add this to any page temporarily
if (typeof window !== 'undefined') {
  throw new Error('Test Sentry error - please ignore');
}
```

Then:
1. Visit the page in production
2. Go to Sentry dashboard: https://sentry.io/organizations/echo-xl/issues/
3. You should see the error appear within seconds
4. Click on it and verify the stack trace shows readable TypeScript code (not minified)

### 3. Verify Environment Detection

Check the Sentry dashboard:
- Production errors should have `environment: production`
- No development/localhost errors should appear

## Troubleshooting

### Issue: "Source maps not uploaded"

**Symptoms:**
- Build succeeds but no source maps uploaded
- Error stack traces show minified code

**Solutions:**
1. Verify `SENTRY_AUTH_TOKEN` is set in Vercel
2. Check token has correct scopes
3. Look for errors in build logs like "Invalid token" or "Permission denied"
4. Ensure `.sentryclirc` exists and has correct org/project

### Issue: "Only localhost errors reported"

**Symptoms:**
- Errors from localhost show up in Sentry
- Production errors don't show up

**Root cause:** Environment detection is broken

**Solutions:**
1. Check that `VERCEL_ENV=production` in your Vercel environment
2. Verify `getEnvironment()` function in `packages/utils/src/lib/logger.ts`
3. Check Sentry init config has `enabled: environment === 'production'`
4. Look at your Vercel deployment logs for environment variable values

### Issue: "Build fails with Sentry error"

**Symptoms:**
- Build fails with Sentry-related error
- "Failed to upload source maps"

**Solutions:**
1. Check that `.sentryclirc` has correct org and project names
2. Verify network connectivity (rare, but Vercel needs to reach sentry.io)
3. Check Sentry.io status page for outages
4. Try regenerating your auth token

## Configuration Reference

### Sentry Init Options

All three config files (`client`, `server`, `edge`) use these options:

```typescript
Sentry.init({
  dsn: 'YOUR_DSN_HERE',
  environment: 'production' | 'development',

  // Sampling
  tracesSampleRate: 0.1,        // 10% of transactions
  profilesSampleRate: 0.1,      // 10% of transactions profiled

  // Features
  enabled: true,                 // Enable/disable Sentry
  enableLogs: true,              // Send console logs to Sentry
  sendDefaultPii: true,          // Send user info (email, etc)

  // Filtering
  beforeSend(event) {
    // Filter out unwanted errors
    return event;
  },
});
```

### Next.js Webpack Plugin Options

In `next.config.js`:

```javascript
withSentryConfig(nextConfig, {
  // Authentication
  org: 'echo-xl',
  project: 'uk-travel-history',
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Source maps
  widenClientFileUpload: true,    // Upload more files
  hideSourceMaps: true,           // Don't serve to browsers
  reactComponentAnnotation: true, // Better React debugging

  // Build behavior
  silent: !process.env.CI,        // Only log in CI
  disableLogger: true,            // Faster dev builds

  // Advanced
  tunnelRoute: '/monitoring',     // Bypass ad blockers
  automaticVercelMonitors: true,  // Vercel cron monitoring
})
```

## Additional Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Source Maps Guide](https://docs.sentry.io/platforms/javascript/sourcemaps/)
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)

## Support

If you encounter issues not covered here:
1. Check the [Sentry documentation](https://docs.sentry.io/)
2. Review build logs in Vercel
3. Check the Sentry dashboard for error details
4. Create an issue in the repository
