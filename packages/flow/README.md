# @uth/flow

Generator-based control flow utility for Next.js Server Components with automatic type inference.

## Purpose

`@uth/flow` provides a clean way to handle async operations and errors in React Server Components without repetitive try/catch blocks. It uses async generators and the `yield*` delegation pattern to maintain type safety while eliminating boilerplate.

## Key Features

- **Type-Safe**: Automatic type inference using `yield*` delegation (workaround for TS issue [#32523](https://github.com/microsoft/TypeScript/issues/32523))
- **Error Policies**: Declarative error handling (redirect, UI fallback, optional, throw)
- **Parallel Execution**: Execute multiple async operations concurrently with `par()`
- **React Integration**: Built-in Suspense support for async rendering
- **Logging**: Optional logger for error tracking and debugging

## High-Level Design

```
┌─────────────────────────────────────────────────┐
│  Server Component                               │
│  export default appFlow.page(function*() {      │
│    const user = yield* call(getUser)            │
│      .orRedirect('/login');                     │
│                                                  │
│    const data = yield* call(fetchData)          │
│      .orUI(<ErrorMessage />);                   │
│                                                  │
│    return <Page user={user} data={data} />;     │
│  });                                             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Flow Executor                                  │
│  - Runs generator step-by-step                  │
│  - Executes CallStep/ParStep                    │
│  - Handles errors per policy                    │
│  - Returns ReactNode                            │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  React Suspense Boundary                        │
│  - Shows pending UI while executing             │
│  - Shows fatal error UI on unhandled errors     │
│  - Renders final result                         │
└─────────────────────────────────────────────────┘
```

## Usage

### Basic Example

```typescript
import { appFlow, call } from '@uth/flow';

export default appFlow.page(async function* MyPage() {
  // Redirect on error - type automatically inferred!
  const user = yield* call(getUser).orRedirect('/login');

  // Show fallback UI on error
  const data = yield* call(fetchData, user.id).orUI(<ErrorMessage />);

  // Use default value on error
  const settings = yield* call(getSettings).optional({});

  return <div>{data.map(item => <Item key={item.id} {...item} />)}</div>;
});
```

### Parallel Execution

```typescript
export default appFlow.page(async function* Dashboard() {
  // Execute multiple calls in parallel - types automatically inferred!
  const [user, posts, comments] = yield* par(
    call(getUser).orRedirect('/login'),
    call(getPosts).optional([]),
    call(getComments).optional([])
  );

  return <Dashboard user={user} posts={posts} comments={comments} />;
});
```

### Error Policies

```typescript
// Redirect to another page
yield* call(requireAuth).orRedirect('/login');

// Show React component as fallback
yield* call(fetchData).orUI(<ErrorFallback />);

// Use default value
yield* call(getOptionalData).optional(null);

// Re-throw error (default behavior)
yield* call(criticalOperation).orThrow();
```

### Custom Flow Options

```typescript
import { createFlow } from '@uth/flow';

const customFlow = createFlow({
  pending: <CustomLoadingSpinner />,
  fatal: (error) => <CustomErrorPage error={error} />,
  logger: (event) => {
    if (event.type === 'step_error') {
      console.error(`Step ${event.step} failed:`, event.error);
    }
  },
});

export default customFlow.page(async function* () {
  // Your logic here
});
```

## API Reference

### `call(fn, ...args)`

Creates a call step that wraps an async function with error handling.

**Parameters:**

- `fn`: Async function to call
- `...args`: Arguments to pass to the function

**Returns:** `CallStep<T>` with chainable error policy methods

**Error Policy Methods:**

- `.orRedirect(url, message?)` - Redirect on error
- `.orUI(fallback, message?)` - Show React component on error
- `.optional(fallback, message?)` - Use default value on error
- `.orThrow(message?)` - Re-throw error (default)

### `par(...steps)`

Executes multiple call steps in parallel.

**Parameters:**

- `...steps`: Array of `CallStep` instances

**Returns:** `ParStep<T[]>` that yields array of results

### `createFlow(options)`

Creates a flow instance with custom configuration.

**Parameters:**

- `options.pending`: ReactNode to show while loading
- `options.fatal`: Function `(error) => ReactNode` for unhandled errors
- `options.logger`: Optional `FlowLogger` for error tracking

**Returns:** `Flow` instance with `.page()` method

### `appFlow`

Pre-configured flow instance used throughout the app.

**Defined in:** `packages/flow/src/lib/appFlow.tsx`

## Type Inference

The library uses TypeScript's `yield*` delegation to preserve type information through generators. This is a workaround for TypeScript issue [#32523](https://github.com/microsoft/TypeScript/issues/32523).

```typescript
// ✅ Type is automatically inferred as User
const user = yield * call(getUser).orRedirect('/login');

// ❌ Without yield*, type would be 'any'
const user = yield call(getUser).orRedirect('/login');
```

## Error Handling

### Navigation Errors

Next.js navigation errors (`NEXT_REDIRECT`, `NEXT_NOT_FOUND`) are automatically detected and re-thrown to maintain Next.js behavior.

### Policy Execution

1. **Redirect**: Calls Next.js `redirect()` function
2. **UI Fallback**: Returns ReactNode, terminating generator early
3. **Optional**: Returns fallback value on error
4. **Throw**: Re-throws original error for outer try/catch

### Logging

Pass a logger to track errors:

```typescript
const flow = createFlow({
  logger: (event) => {
    if (event.type === 'step_error') {
      Sentry.captureException(event.error, {
        tags: { step: event.step },
        contexts: { timing: { duration_ms: event.ms } },
      });
    }
  },
});
```

## Safety Features

- **Infinite Loop Protection**: Maximum 1000 iterations per flow
- **Type Safety**: Full TypeScript support with automatic inference
- **Error Boundaries**: Graceful degradation with custom error UI
- **Suspense Support**: Native React 19 Suspense integration

## Testing

```bash
nx test flow
```

## Dependencies

- `react` ^19.0.0
- `next` ^16.0.0
- `@lonli-lokli/ts-result` - Result type for error handling

## Related

- **[`@uth/utils`](../utils/README.md)** - Logger implementation
- **[Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)** - Official docs
