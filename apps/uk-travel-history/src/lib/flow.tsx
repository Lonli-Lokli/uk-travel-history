/**
 * Flow: A generator-based control flow utility for Next.js Server Components
 *
 * This utility provides a clean way to handle async operations and errors in
 * Server Components without repetitive try/catch blocks.
 *
 * @example Basic usage with error policies
 * ```tsx
 * export default appFlow.page(async function* MyPage() {
 *   // Redirect on error
 *   const user = (yield call(getUser).orRedirect('/login')) as User;
 *
 *   // Show fallback UI on error
 *   const data = (yield call(fetchData, user.id).orUI(
 *     <ErrorMessage />
 *   )) as Data[];
 *
 *   // Use default value on error
 *   const settings = (yield call(getSettings).optional({})) as Settings;
 *
 *   return <div>{data.map(item => <Item key={item.id} {...item} />)}</div>;
 * });
 * ```
 *
 * @example Parallel execution
 * ```tsx
 * export default appFlow.page(async function* Dashboard() {
 *   // Execute multiple calls in parallel
 *   const [user, posts, comments] = (yield par(
 *     call(getUser).orRedirect('/login'),
 *     call(getPosts).optional([]),
 *     call(getComments).optional([])
 *   )) as [User, Post[], Comment[]];
 *
 *   return <Dashboard user={user} posts={posts} comments={comments} />;
 * });
 * ```
 */

import { Suspense, use, type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { success, failure, type Result } from '@lonli-lokli/ts-result';

// ============================================================================
// Navigation Error Detection
// ============================================================================

/**
 * Checks if an error is a Next.js navigation error (redirect/notFound)
 * These errors should be re-thrown to maintain Next.js behavior
 */
export function isNextNavigationError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || '';
  return msg.includes('NEXT_REDIRECT') || msg.includes('NEXT_NOT_FOUND');
}

// ============================================================================
// Logger Types
// ============================================================================

export type FlowLoggerEvent =
  | {
      type: 'step_error';
      step: string;
      ms: number;
      message?: string;
      error: unknown;
    }
  | {
      type: 'flow_error';
      error: unknown;
    };

export type FlowLogger = (event: FlowLoggerEvent) => void;

// ============================================================================
// Result Helpers
// ============================================================================

/**
 * Converts a Promise to a Result, catching errors
 */
export async function toResult<T>(
  promise: Promise<T>,
): Promise<Result<unknown, T>> {
  try {
    const value = await promise;
    return success(value);
  } catch (error) {
    return failure(error);
  }
}

/**
 * Pattern matching helper for Results
 */
export function matchResult<F, S, R>(
  result: Result<F, S>,
  handlers: {
    success: (value: S) => R;
    failure: (error: F) => R;
  },
): R {
  if (result.isSuccess()) {
    return handlers.success(result.unwrap());
  } else if (result.isFailure()) {
    // For failures, use value property or unwrapOrElse
    return handlers.failure(result.value as F);
  } else {
    // Handle Initial and Pending states - default to failure case
    return handlers.failure(
      new Error('Result is in initial or pending state') as unknown as F,
    );
  }
}

// ============================================================================
// Call Step - Core Building Block
// ============================================================================

type ErrorPolicy<T> =
  | { type: 'redirect'; url: string; message?: string }
  | { type: 'ui'; fallback: ReactNode; message?: string }
  | { type: 'optional'; fallback: T; message?: string }
  | { type: 'throw'; message?: string };

interface CallStep<T> {
  _tag: 'CallStep';
  fn: () => Promise<T>;
  step: string;
  policy?: ErrorPolicy<T>;
  orRedirect(url: string, message?: string): CallStep<T>;
  orUI(fallback: ReactNode, message?: string): CallStep<T>;
  optional(fallback: T, message?: string): CallStep<T>;
  orThrow(message?: string): CallStep<T>;
}

/**
 * Creates a call step that wraps an async function with error handling policies
 */
export function call<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  ...args: A
): CallStep<T> {
  const step: CallStep<T> = {
    _tag: 'CallStep',
    fn: () => fn(...args),
    step: fn.name || 'anonymous',
    policy: undefined,
    orRedirect(url: string, message?: string) {
      return { ...this, policy: { type: 'redirect', url, message } };
    },
    orUI(fallback: ReactNode, message?: string) {
      return { ...this, policy: { type: 'ui', fallback, message } };
    },
    optional(fallback: T, message?: string) {
      return { ...this, policy: { type: 'optional', fallback, message } };
    },
    orThrow(message?: string) {
      return { ...this, policy: { type: 'throw', message } };
    },
  };
  return step;
}

// ============================================================================
// Parallel Step
// ============================================================================

interface ParStep<T extends unknown[]> {
  _tag: 'ParStep';
  steps: { [K in keyof T]: CallStep<T[K]> };
}

/**
 * Creates a parallel step that executes multiple call steps concurrently
 */
export function par<T extends unknown[]>(
  ...steps: { [K in keyof T]: CallStep<T[K]> }
): ParStep<T> {
  return {
    _tag: 'ParStep',
    steps,
  };
}

// ============================================================================
// Flow Options & Context
// ============================================================================

export interface FlowOptions {
  pending: ReactNode;
  fatal: (error: unknown) => ReactNode;
  logger?: FlowLogger;
}

interface FlowContext {
  pending: ReactNode;
  fatal: (error: unknown) => ReactNode;
  logger?: FlowLogger;
}

// ============================================================================
// Flow Executor
// ============================================================================

async function executeCallStep<T>(
  step: CallStep<T>,
  ctx: FlowContext,
): Promise<T> {
  const startTime = Date.now();

  try {
    return await step.fn();
  } catch (error) {
    // Always re-throw navigation errors
    if (isNextNavigationError(error)) {
      throw error;
    }

    const ms = Date.now() - startTime;

    // Log the error
    if (ctx.logger) {
      ctx.logger({
        type: 'step_error',
        step: step.step,
        ms,
        message: step.policy?.message,
        error,
      });
    }

    // Handle based on policy
    const policy = step.policy || { type: 'throw' };

    switch (policy.type) {
      case 'redirect':
        redirect(policy.url);
        throw new Error('Unreachable: redirect should throw');

      case 'ui':
        // For UI errors, we throw a special error that will be caught
        // by the flow executor and rendered as UI
        throw { _flowUIError: true, fallback: policy.fallback };

      case 'optional':
        return policy.fallback;

      case 'throw':
      default:
        throw error;
    }
  }
}

async function executeParStep<T extends unknown[]>(
  parStep: ParStep<T>,
  ctx: FlowContext,
): Promise<T> {
  const promises = parStep.steps.map((step) => executeCallStep(step, ctx));
  return (await Promise.all(promises)) as T;
}

/**
 * Maximum number of iterations allowed in a flow to prevent infinite loops
 * This is a safety mechanism - most flows complete in < 100 iterations
 */
const MAX_FLOW_ITERATIONS = 1000;

/**
 * Executes a flow generator, handling all call/par steps and errors
 */
async function executeFlow<P, R>(
  gen: (
    props: P,
  ) => AsyncGenerator<CallStep<unknown> | ParStep<unknown[]>, R, unknown>,
  props: P,
  ctx: FlowContext,
): Promise<R> {
  const iterator = gen(props);
  let lastValue: unknown = undefined;
  let iterations = 0;

  try {
    while (true) {
      // Prevent infinite loops
      if (++iterations > MAX_FLOW_ITERATIONS) {
        throw new Error(
          `Flow exceeded maximum iterations (${MAX_FLOW_ITERATIONS}). ` +
            `This likely indicates an infinite loop in the generator function.`,
        );
      }

      const { value, done } = await iterator.next(lastValue);

      if (done) {
        return value as R;
      }

      // Execute the yielded step
      if ('_tag' in value) {
        if (value._tag === 'CallStep') {
          lastValue = await executeCallStep(value as CallStep<unknown>, ctx);
        } else if (value._tag === 'ParStep') {
          lastValue = await executeParStep(value as ParStep<unknown[]>, ctx);
        }
      }
    }
  } catch (error) {
    // Re-throw navigation errors
    if (isNextNavigationError(error)) {
      throw error;
    }

    // Handle UI errors
    if (
      error &&
      typeof error === 'object' &&
      '_flowUIError' in error &&
      error._flowUIError === true
    ) {
      return (error as unknown as { fallback: ReactNode }).fallback as R;
    }

    // Log flow-level errors
    if (ctx.logger) {
      ctx.logger({
        type: 'flow_error',
        error,
      });
    }

    // Render fatal error UI
    return ctx.fatal(error) as R;
  }
}

// ============================================================================
// Flow Factory
// ============================================================================

export interface Flow {
  page<P = void>(
    gen: (
      props: P,
    ) => AsyncGenerator<
      CallStep<unknown> | ParStep<unknown[]>,
      ReactNode,
      unknown
    >,
    options?: Partial<FlowOptions>,
  ): (props: P) => ReactNode;
}

/**
 * Creates a flow instance with shared configuration
 */
export function createFlow(defaultOptions: FlowOptions): Flow {
  return {
    page<P = void>(
      gen: (
        props: P,
      ) => AsyncGenerator<
        CallStep<unknown> | ParStep<unknown[]>,
        ReactNode,
        unknown
      >,
      options?: Partial<FlowOptions>,
    ) {
      const opts = { ...defaultOptions, ...options };
      const ctx: FlowContext = {
        pending: opts.pending,
        fatal: opts.fatal,
        logger: opts.logger,
      };

      return function FlowPage(props: P): ReactNode {
        const promise = executeFlow(gen, props, ctx);

        return (
          <Suspense fallback={ctx.pending}>
            <FlowPageInner promise={promise} />
          </Suspense>
        );
      };
    },
  };
}

/**
 * Inner component that uses React.use() to await the flow promise
 */
function FlowPageInner({
  promise,
}: {
  promise: Promise<ReactNode>;
}): ReactNode {
  const result = use(promise);
  return result;
}
