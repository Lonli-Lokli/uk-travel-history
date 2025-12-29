// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getEnvironment } from '@uth/utils';

// Diagnostic logging for environment detection
const environment = getEnvironment();
console.log('[Sentry Edge Init] Environment:', environment);
console.log('[Sentry Edge Init] VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('[Sentry Edge Init] NODE_ENV:', process.env.NODE_ENV);

Sentry.init({
  dsn: "https://2186d0cfc8bc7dd8a2e86abf68f70c42@o473632.ingest.us.sentry.io/4510512015409152",
  environment,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});
