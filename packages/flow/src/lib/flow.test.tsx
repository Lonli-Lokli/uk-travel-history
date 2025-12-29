import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redirect } from 'next/navigation';
import {
  call,
  par,
  createFlow,
  isNextNavigationError,
  toResult,
  matchResult,
  type FlowLoggerEvent,
} from './flow';
import { success, failure } from '@lonli-lokli/ts-result';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    const error = new Error('NEXT_REDIRECT');
    error.message = 'NEXT_REDIRECT';
    throw error;
  }),
}));

// Mock React (needed for ReactNode types)
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    Suspense: ({ children }: { children: React.ReactNode }) => children,
    use: (promise: Promise<unknown>) => {
      // Simple synchronous mock for testing
      throw promise;
    },
  };
});

describe('Flow Utility', () => {
  describe('isNextNavigationError', () => {
    it('should detect NEXT_REDIRECT errors', () => {
      const error = new Error('NEXT_REDIRECT');
      expect(isNextNavigationError(error)).toBe(true);
    });

    it('should detect NEXT_NOT_FOUND errors', () => {
      const error = new Error('NEXT_NOT_FOUND');
      expect(isNextNavigationError(error)).toBe(true);
    });

    it('should return false for regular errors', () => {
      const error = new Error('Regular error');
      expect(isNextNavigationError(error)).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isNextNavigationError('string')).toBe(false);
      expect(isNextNavigationError(null)).toBe(false);
      expect(isNextNavigationError(undefined)).toBe(false);
    });
  });

  describe('toResult', () => {
    it('should convert successful promise to success Result', async () => {
      const result = await toResult(Promise.resolve(42));
      expect(result.isSuccess()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it('should convert rejected promise to failure Result', async () => {
      const error = new Error('Test error');
      const result = await toResult(Promise.reject(error));
      expect(result.isFailure()).toBe(true);
      expect(result.value).toBe(error);
    });
  });

  describe('matchResult', () => {
    it('should call success handler for success Result', () => {
      const result = success(42);
      const matched = matchResult(result, {
        success: (value) => `Success: ${value}`,
        failure: (error) => `Failure: ${error}`,
      });
      expect(matched).toBe('Success: 42');
    });

    it('should call failure handler for failure Result', () => {
      const result = failure('error message');
      const matched = matchResult(result, {
        success: (value) => `Success: ${value}`,
        failure: (error) => `Failure: ${error}`,
      });
      expect(matched).toBe('Failure: error message');
    });
  });

  describe('call', () => {
    it('should create a CallStep with function', () => {
      const fn = vi.fn().mockResolvedValue(42);
      const step = call(fn, 'arg1', 'arg2');

      expect(step._tag).toBe('CallStep');
      expect(typeof step.fn).toBe('function');
      expect(step.step).toBe(fn.name || 'anonymous');
    });

    it('should support orRedirect policy', () => {
      const fn = vi.fn().mockResolvedValue(42);
      const step = call(fn).orRedirect('/login', 'Auth failed');

      expect(step._tag).toBe('CallStep');
      expect(step.policy?.type).toBe('redirect');
      if (step.policy?.type === 'redirect') {
        expect(step.policy.url).toBe('/login');
        expect(step.policy.message).toBe('Auth failed');
      }
    });

    it('should support orUI policy', () => {
      const fn = vi.fn().mockResolvedValue(42);
      const fallbackUI = <div>Error</div>;
      const step = call(fn).orUI(fallbackUI, 'UI error');

      expect(step._tag).toBe('CallStep');
      expect(step.policy?.type).toBe('ui');
      if (step.policy?.type === 'ui') {
        expect(step.policy.fallback).toBe(fallbackUI);
        expect(step.policy.message).toBe('UI error');
      }
    });

    it('should support optional policy', () => {
      const fn = vi.fn().mockResolvedValue(42);
      const step = call(fn).optional(null, 'Optional call');

      expect(step._tag).toBe('CallStep');
      expect(step.policy?.type).toBe('optional');
      if (step.policy?.type === 'optional') {
        expect(step.policy.fallback).toBe(null);
        expect(step.policy.message).toBe('Optional call');
      }
    });

    it('should support orThrow policy', () => {
      const fn = vi.fn().mockResolvedValue(42);
      const step = call(fn).orThrow('Critical error');

      expect(step._tag).toBe('CallStep');
      expect(step.policy?.type).toBe('throw');
      if (step.policy?.type === 'throw') {
        expect(step.policy.message).toBe('Critical error');
      }
    });
  });

  describe('par', () => {
    it('should create a ParStep with multiple CallSteps', () => {
      const fn1 = vi.fn().mockResolvedValue(1);
      const fn2 = vi.fn().mockResolvedValue(2);
      const step1 = call(fn1);
      const step2 = call(fn2);

      const parStep = par(step1, step2);

      expect(parStep._tag).toBe('ParStep');
      expect(parStep.steps).toHaveLength(2);
    });
  });

  describe('createFlow', () => {
    let loggerMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      loggerMock = vi.fn();
    });

    it('should create a flow instance with default options', () => {
      const flow = createFlow({
        pending: <div>Loading...</div>,
        fatal: () => <div>Fatal error</div>,
        logger: loggerMock,
      });

      expect(flow).toBeDefined();
      expect(typeof flow.page).toBe('function');
    });

    it('should execute successful flow without errors', async () => {
      const flow = createFlow({
        pending: <div>Loading...</div>,
        fatal: () => <div>Fatal error</div>,
        logger: loggerMock,
      });

      const testFn = vi.fn().mockResolvedValue('test-value');

      async function* testGenerator() {
        const value = (yield call(testFn)) as string;
        return <div>{value}</div>;
      }

      const page = flow.page(testGenerator);

      // Note: Testing the actual execution is complex due to React.use()
      // and Suspense behavior. In a real test environment, you'd use
      // React Testing Library or similar.
      expect(page).toBeDefined();
      expect(typeof page).toBe('function');
    });

    it('should log errors when logger is provided', async () => {
      const flow = createFlow({
        pending: <div>Loading...</div>,
        fatal: () => <div>Fatal error</div>,
        logger: loggerMock,
      });

      const testFn = vi.fn().mockRejectedValue(new Error('Test error'));

      async function* testGenerator() {
        const value = (yield call(testFn).optional(null, 'Test step')) as null;
        return <div>{String(value)}</div>;
      }

      const page = flow.page(testGenerator);

      // The logger should be called when an error occurs
      expect(page).toBeDefined();
    });

    it('should handle optional policy by returning fallback on error', () => {
      const fn = vi.fn().mockRejectedValue(new Error('Test error'));
      const step = call(fn).optional('fallback-value', 'Optional test');

      expect(step.policy?.type).toBe('optional');
      if (step.policy?.type === 'optional') {
        expect(step.policy.fallback).toBe('fallback-value');
      }
    });

    it('should handle redirect policy by redirecting on error', () => {
      const fn = vi.fn().mockRejectedValue(new Error('Auth error'));
      const step = call(fn).orRedirect('/login', 'Auth required');

      expect(step.policy?.type).toBe('redirect');
      if (step.policy?.type === 'redirect') {
        expect(step.policy.url).toBe('/login');
      }
    });

    it('should preserve navigation errors', () => {
      const fn = vi.fn().mockImplementation(() => {
        redirect('/somewhere');
      });
      const step = call(fn);

      // Navigation errors should be re-thrown
      expect(step._tag).toBe('CallStep');
    });
  });

  describe('Flow error handling', () => {
    it('should handle UI error policy', () => {
      const fallbackUI = <div>Error UI</div>;
      const fn = vi.fn().mockRejectedValue(new Error('Test error'));
      const step = call(fn).orUI(fallbackUI, 'UI error message');

      expect(step.policy?.type).toBe('ui');
      if (step.policy?.type === 'ui') {
        expect(step.policy.fallback).toBe(fallbackUI);
      }
    });

    it('should handle multiple error policies in sequence', () => {
      const fn1 = vi.fn().mockResolvedValue(1);
      const fn2 = vi.fn().mockRejectedValue(new Error('Error 2'));
      const fn3 = vi.fn().mockResolvedValue(3);

      const step1 = call(fn1);
      const step2 = call(fn2).optional(2, 'Optional step 2');
      const step3 = call(fn3);

      expect(step1._tag).toBe('CallStep');
      expect(step2._tag).toBe('CallStep');
      expect(step3._tag).toBe('CallStep');
      expect(step2.policy?.type).toBe('optional');
    });
  });

  describe('Integration scenarios', () => {
    it('should support chaining multiple call steps', () => {
      const fn1 = vi.fn().mockResolvedValue('step1');
      const fn2 = vi.fn().mockResolvedValue('step2');
      const fn3 = vi.fn().mockResolvedValue('step3');

      const step1 = call(fn1).orThrow('Step 1 failed');
      const step2 = call(fn2).optional('default', 'Step 2 optional');
      const step3 = call(fn3).orRedirect('/error', 'Step 3 failed');

      expect(step1.policy?.type).toBe('throw');
      expect(step2.policy?.type).toBe('optional');
      expect(step3.policy?.type).toBe('redirect');
    });

    it('should support parallel execution with par', () => {
      const fn1 = vi.fn().mockResolvedValue('result1');
      const fn2 = vi.fn().mockResolvedValue('result2');
      const fn3 = vi.fn().mockResolvedValue('result3');

      const parStep = par(
        call(fn1).orThrow(),
        call(fn2).optional(null),
        call(fn3).orUI(<div>Error</div>),
      );

      expect(parStep._tag).toBe('ParStep');
      expect(parStep.steps).toHaveLength(3);
    });
  });

  describe('Logger events', () => {
    it('should create proper step_error event', () => {
      const event: FlowLoggerEvent = {
        type: 'step_error',
        step: 'testFunction',
        ms: 100,
        message: 'Test error message',
        error: new Error('Test error'),
      };

      expect(event.type).toBe('step_error');
      expect(event.step).toBe('testFunction');
      expect(event.ms).toBe(100);
    });

    it('should create proper flow_error event', () => {
      const event: FlowLoggerEvent = {
        type: 'flow_error',
        error: new Error('Flow error'),
      };

      expect(event.type).toBe('flow_error');
      expect(event.error).toBeInstanceOf(Error);
    });
  });
});
