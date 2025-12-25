import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Initialize Edge Config with overrides if needed
  if (process.env.EDGE_CONFIG) {
    // Edge Config is configured via environment variables by default
    // If you need programmatic overrides, you can create a custom client here:
    // const edgeConfig = createClient(process.env.EDGE_CONFIG);
    // Then pass it to your feature flag functions
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
