/**
 * Shared flow instance for the UK Travel History application
 *
 * This file creates a centralized flow instance with application-specific
 * error handling and logging configuration.
 */

import React from "react";
import { createFlow, type FlowLoggerEvent } from "@/lib/flow";
import { logger } from "@uth/utils";

/**
 * Application-wide flow instance
 *
 * Provides consistent error handling and logging across all server components
 */
export const appFlow = createFlow({
  pending: (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-slate-600">Loading…</div>
    </div>
  ),
  fatal: () => {
    // Generate unique error ID for support tracking
    const errorId = crypto.randomUUID();

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-md mx-auto p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-lg font-semibold text-red-900 mb-2">
            System Error
          </h2>
          <p className="text-sm text-red-700 mb-3">
            An unexpected error occurred. Please try again later or contact support if the problem persists.
          </p>
          <p className="text-xs text-red-600 font-mono">
            Error ID: {errorId}
          </p>
        </div>
      </div>
    );
  },
  logger: (e: FlowLoggerEvent) => {
    // Generate unique error ID for tracking
    const errorId = crypto.randomUUID();

    if (e.type === "step_error") {
      logger.error(`Flow step failed: ${e.step}`, {
        extra: {
          errorId,
          step: e.step,
          ms: e.ms,
          message: e.message,
          error: e.error instanceof Error ? e.error.message : String(e.error),
          stack: e.error instanceof Error ? e.error.stack : undefined,
        },
      });
    }
    if (e.type === "flow_error") {
      logger.error("Flow error", {
        extra: {
          errorId,
          error: e.error instanceof Error ? e.error.message : String(e.error),
          stack: e.error instanceof Error ? e.error.stack : undefined,
        },
      });
    }
  },
});
