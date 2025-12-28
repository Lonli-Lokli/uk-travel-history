/**
 * Route Logger Configuration
 *
 * Provides dependency injection for logger in API routes
 * Allows tests to inject custom logger implementations
 */

import { logger } from '@uth/utils';
import type { LogOptions } from '@uth/utils';

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  error: (message: string, error?: unknown, options?: LogOptions) => void;
  warn: (message: string, options?: LogOptions) => void;
  info: (message: string, options?: LogOptions) => void;
  debug: (message: string, options?: LogOptions) => void;
}

/**
 * Configuration for route logger
 */
export interface RouteLoggerConfig {
  logger?: Logger;
}

/**
 * Global configuration
 */
let config: RouteLoggerConfig = {};

/**
 * Configure the route logger
 *
 * @example
 * // In tests
 * configureRouteLogger({
 *   logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
 * });
 *
 * @example
 * // Reset to defaults
 * configureRouteLogger({});
 */
export function configureRouteLogger(newConfig: RouteLoggerConfig): void {
  config = newConfig;
}

/**
 * Get the configured logger or fall back to default
 */
export function getRouteLogger(): Logger {
  return config.logger || logger;
}
