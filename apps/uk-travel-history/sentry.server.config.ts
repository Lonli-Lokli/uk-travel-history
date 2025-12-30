// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { getEnvironment } from '@uth/utils';

// Get environment with proper handling for all Vercel environments
const environment = getEnvironment();

// Only log in development to avoid noise in production
if (environment === 'development') {
  console.log('[Sentry Server Init] Environment:', environment);
  console.log('[Sentry Server Init] VERCEL_ENV:', process.env.VERCEL_ENV);
  console.log('[Sentry Server Init] NODE_ENV:', process.env.NODE_ENV);
}

Sentry.init({
  dsn: 'https://2186d0cfc8bc7dd8a2e86abf68f70c42@o473632.ingest.us.sentry.io/4510512015409152',
  environment,

  // Adjust sample rate based on environment
  tracesSampleRate: environment === 'production' ? 0.1 : 0,
  profilesSampleRate: environment === 'production' ? 0.1 : 0,

  // Only enable in production to avoid development noise
  enabled: environment === 'production',

  // Enable logs to be sent to Sentry (only in production due to enabled flag)
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Improve error grouping
  beforeSend(event) {
    // Filter out localhost errors in production (shouldn't happen, but just in case)
    if (event.request?.url?.includes('localhost')) {
      return null;
    }
    return event;
  },
});
