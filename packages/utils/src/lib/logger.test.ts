// logger.test.ts
// Comprehensive tests for the enhanced logger

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import { logger, getEnvironment } from './logger';

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setContext: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Store original environment
    originalEnv = process.env.NODE_ENV;

    // Clear Vercel env vars to ensure NODE_ENV takes precedence in tests
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    delete process.env.VERCEL_ENV;

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore environment
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('getEnvironment', () => {
    it('returns production when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(getEnvironment()).toBe('production');
    });

    it('returns development when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      expect(getEnvironment()).toBe('development');
    });

    it('returns development when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      expect(getEnvironment()).toBe('development');
    });

    it('prioritizes NEXT_PUBLIC_VERCEL_ENV over NODE_ENV', () => {
      process.env.NEXT_PUBLIC_VERCEL_ENV = 'production';
      process.env.NODE_ENV = 'development';
      expect(getEnvironment()).toBe('production');
    });

    it('prioritizes VERCEL_ENV over NODE_ENV but after NEXT_PUBLIC_VERCEL_ENV', () => {
      process.env.VERCEL_ENV = 'production';
      process.env.NODE_ENV = 'development';
      expect(getEnvironment()).toBe('production');
    });
  });

  describe('debug', () => {
    it('logs to console in development', () => {
      process.env.NODE_ENV = 'development';
      logger.debug('Debug message');
      expect(consoleLogSpy).toHaveBeenCalledWith('Debug message');
    });

    it('does not log to console in production', () => {
      process.env.NODE_ENV = 'production';
      logger.debug('Debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('logs with options in development', () => {
      process.env.NODE_ENV = 'development';
      logger.debug('Debug message', {
        tags: { feature: 'test' },
        extra: { data: 'value' },
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Debug message {"feature":"test"}',
        { data: 'value' }
      );
    });

    it('never sends to Sentry', () => {
      process.env.NODE_ENV = 'production';
      logger.debug('Debug message');
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('logs to console in development', () => {
      process.env.NODE_ENV = 'development';
      logger.info('Info message');
      expect(consoleLogSpy).toHaveBeenCalledWith('Info message');
    });

    it('logs to console in production', () => {
      process.env.NODE_ENV = 'production';
      logger.info('Info message');
      expect(consoleLogSpy).toHaveBeenCalledWith('Info message');
    });

    it('logs with options', () => {
      logger.info('Info message', {
        tags: { feature: 'test' },
        extra: { data: 'value' },
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Info message {"feature":"test"}',
        { data: 'value' }
      );
    });

    it('never sends to Sentry', () => {
      process.env.NODE_ENV = 'production';
      logger.info('Info message');
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('logs to console in development', () => {
      process.env.NODE_ENV = 'development';
      logger.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Warning message');
    });

    it('logs to console in production', () => {
      process.env.NODE_ENV = 'production';
      logger.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Warning message');
    });

    it('does not send to Sentry in development', () => {
      process.env.NODE_ENV = 'development';
      logger.warn('Warning message');
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });

    it('sends to Sentry in production', () => {
      process.env.NODE_ENV = 'production';
      logger.warn('Warning message');
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Warning message', {
        level: 'warning',
        tags: undefined,
        contexts: undefined,
        fingerprint: undefined,
        extra: undefined,
      });
    });

    it('sends to Sentry with tags and contexts in production', () => {
      process.env.NODE_ENV = 'production';
      logger.warn('Warning message', {
        tags: { feature: 'payment', flow: 'signup' },
        contexts: { payment: { billingPeriod: 'monthly' } },
        extra: { userId: '123' },
        fingerprint: ['warning-type'],
      });
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Warning message', {
        level: 'warning',
        tags: { feature: 'payment', flow: 'signup' },
        contexts: { payment: { billingPeriod: 'monthly' } },
        fingerprint: ['warning-type'],
        extra: { userId: '123' },
      });
    });
  });

  describe('error', () => {
    it('logs to console in development', () => {
      process.env.NODE_ENV = 'development';
      logger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error message', {
        error: undefined,
      });
    });

    it('logs to console in production', () => {
      process.env.NODE_ENV = 'production';
      logger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error message', {
        error: undefined,
      });
    });

    it('logs error object to console', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error occurred', {
        error,
      });
    });

    it('does not send to Sentry in development', () => {
      process.env.NODE_ENV = 'development';
      logger.error('Error message');
      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });

    it('sends Error to Sentry.captureException in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        level: 'error',
        tags: undefined,
        contexts: undefined,
        fingerprint: undefined,
        extra: { message: 'Error occurred' },
      });
    });

    it('sends non-Error to Sentry.captureMessage in production', () => {
      process.env.NODE_ENV = 'production';
      logger.error('Error occurred', 'string error');
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Error occurred', {
        level: 'error',
        tags: undefined,
        contexts: undefined,
        fingerprint: undefined,
        extra: { error: 'string error' },
      });
    });

    it('sends to Sentry with tags and contexts in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Payment failed');
      logger.error('Checkout error', error, {
        tags: { service: 'payment', operation: 'create_checkout' },
        contexts: { payment: { billingPeriod: 'monthly' } },
        extra: { userId: '123' },
        fingerprint: ['payment-error', 'checkout'],
      });
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        level: 'error',
        tags: { service: 'payment', operation: 'create_checkout' },
        contexts: { payment: { billingPeriod: 'monthly' } },
        fingerprint: ['payment-error', 'checkout'],
        extra: { message: 'Checkout error', userId: '123' },
      });
    });
  });

  describe('setContext', () => {
    it('calls Sentry.setContext', () => {
      logger.setContext('user', { id: '123', email: 'test@example.com' });
      expect(Sentry.setContext).toHaveBeenCalledWith('user', {
        id: '123',
        email: 'test@example.com',
      });
    });
  });

  describe('setUser', () => {
    it('calls Sentry.setUser with user object', () => {
      logger.setUser({ id: '123', username: 'testuser', email: 'test@example.com' });
      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
      });
    });

    it('calls Sentry.setUser with null to clear user', () => {
      logger.setUser(null);
      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe('addBreadcrumb', () => {
    it('calls Sentry.addBreadcrumb', () => {
      logger.addBreadcrumb('User clicked button', 'ui', { buttonId: 'submit' });
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'User clicked button',
        category: 'ui',
        data: { buttonId: 'submit' },
        level: 'info',
      });
    });

    it('calls Sentry.addBreadcrumb without data', () => {
      logger.addBreadcrumb('Page loaded', 'navigation');
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Page loaded',
        category: 'navigation',
        data: undefined,
        level: 'info',
      });
    });
  });

  describe('Console formatting', () => {
    it('formats messages with tags', () => {
      logger.info('Test message', { tags: { feature: 'test', level: 'info' } });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Test message {"feature":"test","level":"info"}'
      );
    });

    it('includes extra data', () => {
      logger.info('Test message', { extra: { userId: '123', sessionId: 'abc' } });
      expect(consoleLogSpy).toHaveBeenCalledWith('Test message', {
        userId: '123',
        sessionId: 'abc',
      });
    });

    it('includes contexts in extra data', () => {
      logger.info('Test message', {
        contexts: { payment: { amount: 100 } },
        extra: { userId: '123' },
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('Test message', {
        userId: '123',
        contexts: { payment: { amount: 100 } },
      });
    });

    it('handles all options together', () => {
      logger.warn('Test message', {
        tags: { feature: 'test' },
        extra: { data: 'value' },
        contexts: { user: { id: '123' } },
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Test message {"feature":"test"}',
        {
          data: 'value',
          contexts: { user: { id: '123' } },
        }
      );
    });
  });
});
