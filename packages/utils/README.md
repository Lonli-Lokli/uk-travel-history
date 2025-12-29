# @uth/utils

Shared utilities and helper functions used across the application.

## Purpose

Common utilities for logging, date manipulation, validation, and styling.

## Utilities

### Logger

Sentry-integrated logging with context support.

```typescript
import { logger } from '@uth/utils';

// Log levels
logger.info('User logged in', { extra: { userId: '123' } });
logger.warn('Rate limit approaching', { extra: { requests: 95 } });
logger.error('Payment failed', error, {
  tags: { service: 'stripe' },
  contexts: { payment: { amount: 99 } },
});

// Breadcrumbs
logger.addBreadcrumb('Button clicked', 'user', { buttonId: 'checkout' });
```

### Date Utilities

```typescript
import { formatDate, parseDate, isValidDate } from '@uth/utils';

const formatted = formatDate(new Date(), 'dd/MM/yyyy'); // "28/12/2025"
const parsed = parseDate('2025-12-28'); // Date object
const valid = isValidDate('2025-12-28'); // true
```

### Styling Utilities

```typescript
import { cn } from '@uth/utils';

// Merge Tailwind classes
const className = cn('base-class', isActive && 'active-class', 'override-class');
```

### Validation

```typescript
import { isValidEmail, sanitizeInput } from '@uth/utils';

const valid = isValidEmail('user@example.com'); // true
const safe = sanitizeInput(userInput); // XSS protection
```

## API Reference

### Logger

#### `logger.info(message, context?)`

Log informational message.

#### `logger.warn(message, context?)`

Log warning.

#### `logger.error(message, error?, context?)`

Log error with optional Error object.

#### `logger.addBreadcrumb(message, category?, data?)`

Add breadcrumb for error context.

**Context Options:**

```typescript
{
  tags?: Record<string, string>;
  contexts?: Record<string, any>;
  extra?: Record<string, any>;
}
```

### Date Functions

#### `formatDate(date, format): string`

Format date using date-fns pattern.

#### `parseDate(str): Date | null`

Parse ISO date string.

#### `isValidDate(str): boolean`

Check if string is valid date.

#### `differenceInDays(start, end): number`

Calculate days between dates.

### Styling

#### `cn(...classes): string`

Merge Tailwind classes using `tailwind-merge` and `clsx`.

## Environment Support

Works in both Node.js (server) and browser environments.

## Testing

```bash
nx test utils
```

## Dependencies

- `@sentry/nextjs` - Error tracking
- `date-fns` - Date manipulation
- `clsx` - className utility
- `tailwind-merge` - Tailwind class merging

## Related

- **[`@uth/flow`](../flow/README.md)** - Uses logger for error tracking
- **[Sentry Docs](https://docs.sentry.io/)** - Error tracking platform
