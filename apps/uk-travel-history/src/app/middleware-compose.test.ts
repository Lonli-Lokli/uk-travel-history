import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  compose,
  when,
  chain,
  matchRoute,
  pipe,
  type MiddlewareFunction,
} from './middleware-compose';

describe('Middleware Composition Utilities', () => {
  const createMockRequest = (path: string): NextRequest => {
    return new NextRequest(new URL(path, 'https://example.com'));
  };

  describe('compose', () => {
    it('should execute middleware in order until one returns a response', async () => {
      const middleware1: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(null);
      const middleware2: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(NextResponse.next());
      const middleware3: MiddlewareFunction = vi.fn(); // Should not be called

      const composed = compose(middleware1, middleware2, middleware3);
      const req = createMockRequest('/test');
      const response = await composed(req);

      expect(middleware1).toHaveBeenCalledWith(req);
      expect(middleware2).toHaveBeenCalledWith(req);
      expect(middleware3).not.toHaveBeenCalled();
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should return null if all middleware return null', async () => {
      const middleware1: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(null);
      const middleware2: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(null);

      const composed = compose(middleware1, middleware2);
      const req = createMockRequest('/test');
      const response = await composed(req);

      expect(response).toBeNull();
    });

    it('should handle empty middleware array', async () => {
      const composed = compose();
      const req = createMockRequest('/test');
      const response = await composed(req);

      expect(response).toBeNull();
    });
  });

  describe('when', () => {
    it('should run middleware when predicate is true', async () => {
      const middleware: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(NextResponse.next());
      const predicate = vi.fn().mockReturnValue(true);

      const conditional = when(predicate, middleware);
      const req = createMockRequest('/test');
      await conditional(req);

      expect(predicate).toHaveBeenCalledWith(req);
      expect(middleware).toHaveBeenCalledWith(req);
    });

    it('should not run middleware when predicate is false', async () => {
      const middleware: MiddlewareFunction = vi.fn();
      const predicate = vi.fn().mockReturnValue(false);

      const conditional = when(predicate, middleware);
      const req = createMockRequest('/test');
      const response = await conditional(req);

      expect(predicate).toHaveBeenCalledWith(req);
      expect(middleware).not.toHaveBeenCalled();
      expect(response).toBeNull();
    });

    it('should handle async predicates', async () => {
      const middleware: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(NextResponse.next());
      const predicate = vi.fn().mockResolvedValue(true);

      const conditional = when(predicate, middleware);
      const req = createMockRequest('/test');
      await conditional(req);

      expect(predicate).toHaveBeenCalledWith(req);
      expect(middleware).toHaveBeenCalledWith(req);
    });
  });

  describe('chain', () => {
    it('should execute all middleware regardless of return values', async () => {
      const middleware1: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(null);
      const middleware2: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(NextResponse.next());
      const middleware3: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(null);

      const chained = chain(middleware1, middleware2, middleware3);
      const req = createMockRequest('/test');
      const response = await chained(req);

      expect(middleware1).toHaveBeenCalledWith(req);
      expect(middleware2).toHaveBeenCalledWith(req);
      expect(middleware3).toHaveBeenCalledWith(req);
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should return last non-null response', async () => {
      const response1 = NextResponse.json({ data: 1 });
      const response2 = NextResponse.json({ data: 2 });

      const middleware1: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(response1);
      const middleware2: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(null);
      const middleware3: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(response2);

      const chained = chain(middleware1, middleware2, middleware3);
      const req = createMockRequest('/test');
      const response = await chained(req);

      expect(response).toBe(response2);
    });

    it('should return null if all middleware return null', async () => {
      const middleware1: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(null);
      const middleware2: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(null);

      const chained = chain(middleware1, middleware2);
      const req = createMockRequest('/test');
      const response = await chained(req);

      expect(response).toBeNull();
    });
  });

  describe('matchRoute', () => {
    it('should match exact routes', () => {
      const matcher = matchRoute('/api/test');
      const req = createMockRequest('/api/test');

      expect(matcher(req)).toBe(true);
    });

    it('should not match different routes', () => {
      const matcher = matchRoute('/api/test');
      const req = createMockRequest('/api/other');

      expect(matcher(req)).toBe(false);
    });

    it('should match wildcard routes', () => {
      const matcher = matchRoute('/api/*');
      const req1 = createMockRequest('/api/test');
      const req2 = createMockRequest('/api/foo/bar');

      expect(matcher(req1)).toBe(true);
      expect(matcher(req2)).toBe(true);
    });

    it('should not match routes outside wildcard prefix', () => {
      const matcher = matchRoute('/api/*');
      const req = createMockRequest('/other/route');

      expect(matcher(req)).toBe(false);
    });

    it('should match multiple route patterns', () => {
      const matcher = matchRoute(['/api/*', '/admin', '/dashboard']);
      const req1 = createMockRequest('/api/test');
      const req2 = createMockRequest('/admin');
      const req3 = createMockRequest('/dashboard');
      const req4 = createMockRequest('/other');

      expect(matcher(req1)).toBe(true);
      expect(matcher(req2)).toBe(true);
      expect(matcher(req3)).toBe(true);
      expect(matcher(req4)).toBe(false);
    });
  });

  describe('pipe', () => {
    it('should be an alias for compose', () => {
      expect(pipe).toBe(compose);
    });

    it('should work the same as compose', async () => {
      const middleware1: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(null);
      const middleware2: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(NextResponse.next());

      const piped = pipe(middleware1, middleware2);
      const req = createMockRequest('/test');
      const response = await piped(req);

      expect(middleware1).toHaveBeenCalledWith(req);
      expect(middleware2).toHaveBeenCalledWith(req);
      expect(response).toBeInstanceOf(NextResponse);
    });
  });

  describe('Integration: Real-world composition patterns', () => {
    it('should compose conditional middleware correctly', async () => {
      const apiMiddleware: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ auth: 'required' }));
      const loggingMiddleware: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(null);

      const isApiRoute = matchRoute('/api/*');
      const composed = compose(
        loggingMiddleware,
        when(isApiRoute, apiMiddleware),
      );

      const apiReq = createMockRequest('/api/test');
      const webReq = createMockRequest('/home');

      const apiResponse = await composed(apiReq);
      const webResponse = await composed(webReq);

      expect(loggingMiddleware).toHaveBeenCalledTimes(2);
      expect(apiMiddleware).toHaveBeenCalledTimes(1);
      expect(apiResponse).toBeInstanceOf(NextResponse);
      expect(webResponse).toBeNull();
    });

    it('should handle complex middleware chains', async () => {
      const authCheck: MiddlewareFunction = vi.fn().mockResolvedValue(null);
      const rateLimit: MiddlewareFunction = vi.fn().mockResolvedValue(null);
      const apiHandler: MiddlewareFunction = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }));

      const isApiRoute = matchRoute('/api/*');
      const composed = compose(
        authCheck,
        when(isApiRoute, chain(rateLimit, apiHandler)),
      );

      const req = createMockRequest('/api/data');
      const response = await composed(req);

      expect(authCheck).toHaveBeenCalled();
      expect(rateLimit).toHaveBeenCalled();
      expect(apiHandler).toHaveBeenCalled();
      expect(response).toBeInstanceOf(NextResponse);
    });
  });
});
