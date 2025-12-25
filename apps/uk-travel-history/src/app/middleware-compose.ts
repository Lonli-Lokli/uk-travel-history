import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware function type - takes a request and returns a response or null to continue
 */
export type MiddlewareFunction = (
  req: NextRequest,
) => Promise<NextResponse | null>;

/**
 * Compose multiple middleware functions into a single middleware
 * Executes middleware in order until one returns a response
 * If all return null, returns NextResponse.next()
 *
 * @example
 * const composed = compose(
 *   loggingMiddleware,
 *   authMiddleware,
 *   rateLimitMiddleware
 * );
 */
export function compose(
  ...middlewares: MiddlewareFunction[]
): MiddlewareFunction {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    for (const middleware of middlewares) {
      const response = await middleware(req);
      if (response) {
        return response;
      }
    }
    return null;
  };
}

/**
 * Create a conditional middleware that only runs if predicate is true
 *
 * @example
 * const conditionalAuth = when(
 *   (req) => req.nextUrl.pathname.startsWith('/api'),
 *   authMiddleware
 * );
 */
export function when(
  predicate: (req: NextRequest) => boolean | Promise<boolean>,
  middleware: MiddlewareFunction,
): MiddlewareFunction {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const shouldRun = await predicate(req);
    if (!shouldRun) {
      return null;
    }
    return middleware(req);
  };
}

/**
 * Chain multiple middleware functions together
 * Unlike compose, chain passes the request through ALL middlewares
 * Useful for side-effect middleware (logging, metrics, etc.)
 *
 * @example
 * const chained = chain(
 *   loggingMiddleware,
 *   metricsMiddleware,
 *   securityHeadersMiddleware
 * );
 */
export function chain(
  ...middlewares: MiddlewareFunction[]
): MiddlewareFunction {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    let lastResponse: NextResponse | null = null;

    for (const middleware of middlewares) {
      const response = await middleware(req);
      if (response) {
        lastResponse = response;
      }
    }

    return lastResponse;
  };
}

/**
 * Create a route matcher predicate
 * Useful for conditional middleware based on route patterns
 *
 * @example
 * const isApiRoute = matchRoute('/api/*');
 * const apiMiddleware = when(isApiRoute, authMiddleware);
 */
export function matchRoute(
  pattern: string | string[],
): (req: NextRequest) => boolean {
  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  return (req: NextRequest): boolean => {
    const path = req.nextUrl.pathname;
    return patterns.some((p) => {
      if (p.endsWith('/*')) {
        return path.startsWith(p.slice(0, -2));
      }
      return path === p;
    });
  };
}

/**
 * Pipe middleware functions left-to-right
 * Alias for compose but more intuitive for left-to-right reading
 *
 * @example
 * const pipeline = pipe(
 *   firstMiddleware,
 *   secondMiddleware,
 *   thirdMiddleware
 * );
 */
export const pipe = compose;
