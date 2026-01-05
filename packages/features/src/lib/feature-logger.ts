/**
 * Feature Logger Configuration
 *
 * Provides dependency injection for logger in feature code
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
 * Configuration for feature logger
 */
export interface FeatureLoggerConfig {
  logger?: Logger;
}

/**
 * Global configuration
 */
let config: FeatureLoggerConfig = {};

/**
 * Configure the feature logger
 *
 * @example
 * // In tests
 * configureFeatureLogger({
 *   logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
 * });
 *
 * @example
 * // Reset to defaults
 * configureFeatureLogger({});
 */
export function configureFeatureLogger(newConfig: RouteLoggerConfig): void {
  config = newConfig;
}

/**
 * Get the configured logger or fall back to default
 */
export function getFeatureLogger(): Logger {
  return config.logger || logger;
}
