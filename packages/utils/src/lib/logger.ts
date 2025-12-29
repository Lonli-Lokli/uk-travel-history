// shared/logger.ts
// Enhanced Logger utility with comprehensive Sentry integration

import * as Sentry from '@sentry/nextjs';

/**
 * Log level type
 */
export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

/**
 * Options for logging with additional context
 */
export interface LogOptions {
  /**
   * Tags for categorizing and filtering logs in Sentry
   * Example: { feature: 'payment', flow: 'signup' }
   */
  tags?: Record<string, string>;

  /**
   * Additional context data for debugging
   * Example: { userId: '123', sessionId: 'abc' }
   */
  extra?: Record<string, unknown>;

  /**
   * Named contexts for grouping related data
   * Example: { payment: { billingPeriod: 'monthly', sessionId: '123' } }
   */
  contexts?: Record<string, Record<string, unknown>>;

  /**
   * Fingerprint for grouping similar errors in Sentry
   * Example: ['payment-error', 'stripe-checkout']
   */
  fingerprint?: string[];

  /**
   * Log level (overrides the default level of the method)
   */
  level?: LogLevel;
}

/**
 * Enhanced Logger utility with Sentry integration
 *
 * Use this instead of console.warn/error or direct Sentry calls to ensure
 * consistent logging behavior across the application.
 *
 * @example
 * // Simple logging
 * logger.info('User logged in');
 * logger.warn('API rate limit approaching');
 * logger.error('Payment failed', error);
 *
 * @example
 * // With tags and context
 * logger.error('Payment checkout failed', error, {
 *   tags: { feature: 'payment', flow: 'signup' },
 *   contexts: { payment: { billingPeriod: 'monthly' } },
 *   fingerprint: ['payment-error', 'checkout-failed']
 * });
 */
export const logger = {
  /**
   * Log a debug message (console only in development, not sent to Sentry)
   * Use for verbose debugging information
   */
  debug: (message: string, options?: LogOptions): void => {
    if (getEnvironment() !== 'production') {
      logToConsole('debug', message, options);
    }
  },

  /**
   * Log an informational message (console only, not sent to Sentry)
   * Use for general information about application flow
   */
  info: (message: string, options?: LogOptions): void => {
    logToConsole('info', message, options);
  },

  /**
   * Log a warning and report to Sentry in production
   * Use for unexpected states that don't break functionality but indicate potential issues
   */
  warn: (message: string, options?: LogOptions): void => {
    logToConsole('warn', message, options);

    if (getEnvironment() === 'production') {
      Sentry.captureMessage(message, buildSentryScope('warning', options));
    }
  },

  /**
   * Log an error and report to Sentry in production
   * Use for errors that impact functionality
   */
  error: (message: string, error?: unknown, options?: LogOptions): void => {
    logToConsole('error', message, {
      ...options,
      extra: { ...options?.extra, error },
    });

    if (getEnvironment() === 'production') {
      if (error instanceof Error) {
        Sentry.captureException(
          error,
          buildSentryScope('error', {
            ...options,
            extra: { message, ...options?.extra },
          }),
        );
      } else {
        Sentry.captureMessage(
          message,
          buildSentryScope('error', {
            ...options,
            extra: { error, ...options?.extra },
          }),
        );
      }
    }
  },

  /**
   * Set additional context for subsequent Sentry reports
   * Context persists across all future Sentry events until cleared
   */
  setContext: (name: string, context: Record<string, unknown>): void => {
    Sentry.setContext(name, context);
  },

  /**
   * Set user context for Sentry reports
   * User information persists across all future Sentry events until cleared
   */
  setUser: (
    user: { id?: string; username?: string; email?: string } | null,
  ): void => {
    Sentry.setUser(user);
  },

  /**
   * Add breadcrumb for debugging context
   * Breadcrumbs are attached to subsequent error reports to help trace the sequence of events
   */
  addBreadcrumb: (
    message: string,
    category: string,
    data?: Record<string, unknown>,
  ): void => {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  },
};

/**
 * Log to console with consistent formatting
 */
function logToConsole(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  options?: LogOptions,
): void {
  const consoleMethod =
    level === 'debug' || level === 'info' ? console.log : console[level];

  // Format the message with tags if present
  const formattedMessage = options?.tags
    ? `${message} ${JSON.stringify(options.tags)}`
    : message;

  // Include extra data and contexts if present
  const additionalData = {
    ...options?.extra,
    ...(options?.contexts && Object.keys(options.contexts).length > 0
      ? { contexts: options.contexts }
      : {}),
  };

  if (Object.keys(additionalData).length > 0) {
    consoleMethod(formattedMessage, additionalData);
  } else {
    consoleMethod(formattedMessage);
  }
}

/**
 * Build Sentry scope with tags, contexts, and fingerprint
 */
function buildSentryScope(
  level: Sentry.SeverityLevel,
  options?: LogOptions,
): Sentry.CaptureContext {
  return {
    level: options?.level ?? level,
    tags: options?.tags,
    contexts: options?.contexts,
    fingerprint: options?.fingerprint,
    extra: options?.extra,
  };
}

/**
 * Get current environment
 */
export const getEnvironment = (): 'production' | 'development' => {
  switch (process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV) {
    case 'production':
      return 'production';
    default:
      return 'development';
  }
};
