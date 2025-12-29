// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { getEnvironment } from '@uth/utils';

// Diagnostic logging for environment detection
const environment = getEnvironment();
console.log('[Sentry Client Init] Environment:', environment);
console.log(
  '[Sentry Client Init] NEXT_PUBLIC_VERCEL_ENV:',
  process.env.NEXT_PUBLIC_VERCEL_ENV,
);
console.log('[Sentry Client Init] NODE_ENV:', process.env.NODE_ENV);

Sentry.init({
  dsn: 'https://2186d0cfc8bc7dd8a2e86abf68f70c42@o473632.ingest.us.sentry.io/4510512015409152',
  environment,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
