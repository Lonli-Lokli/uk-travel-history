const { composePlugins, withNx } = require('@nx/next');
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],

  // webpack: (config, { isServer }) => {
  //   if (isServer) {
  //     // Alias canvas to false to avoid native binding issues
  //     // pdfjs-dist will work without canvas for text extraction
  //     config.resolve.alias = {
  //       ...config.resolve.alias,
  //       canvas: false,
  //     };
  //   }
  //   return config;
  // },
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

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
});
