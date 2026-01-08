const { composePlugins, withNx } = require('@nx/next');
const { withSentryConfig } = require('@sentry/nextjs');
const { execSync } = require('child_process');

// Get Git commit hash at build time
const getGitCommitHash = () => {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch (_error) {
    return 'unknown';
  }
};

const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
  env: {
    NEXT_PUBLIC_GIT_COMMIT_HASH: getGitCommitHash(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  turbopack: {
    rules: {
      '*.svg': {
        as: '*.js',
        loaders: ['@svgr/webpack'],
      },
    },
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = withSentryConfig(composePlugins(...plugins)(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: 'echo-xl',
  project: 'uk-travel-history',

  // Authentication token for source maps upload (configured in Vercel)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Hide source maps from public access for security
  hideSourceMaps: true,

  // Sentry webpack configuration
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: true,
  },
});
