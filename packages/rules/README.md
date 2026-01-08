# @uth/rules - Multi-Goal Tracking Rule Engines

A flexible rule engine system for calculating progress, metrics, and warnings for different goal types (immigration, tax residency, personal tracking).

## Overview

The `@uth/rules` package provides a pluggable architecture for implementing goal-specific calculation logic. Each goal type has a dedicated **rule engine** that knows how to:

1. **Calculate progress** - Determine how close the user is to their goal
2. **Generate metrics** - Compute key statistics (days away, days present, violations, etc.)
3. **Issue warnings** - Alert users when they're at risk of breaking limits
4. **Validate configuration** - Ensure goal configs are valid before processing

## Architecture

### Core Concepts

#### Rule Engine

A `RuleEngine` is a class that implements goal-specific calculation logic:

```typescript
interface RuleEngine<TConfig extends GoalConfig> {
  readonly goalType: GoalType;
  readonly jurisdiction: Jurisdiction;

  calculate(
    trips: TripRecord[],
    config: TConfig,
    startDate: Date,
    asOfDate?: Date
  ): GoalCalculation;

  validateConfig(config: unknown): config is TConfig;

  getDisplayInfo(): {
    name: string;
    icon: string;
    description: string;
    category: GoalCategory;
  };
}
```

#### Goal Types

Currently supported goal types:

- **`uk_ilr`** - UK Indefinite Leave to Remain (ILR) tracking
- **`uk_citizenship`** - UK Citizenship/Naturalisation tracking
- **`uk_tax_residency`** - UK tax residency (Statutory Residence Test)
- **`schengen_90_180`** - Schengen 90/180 day rule
- **`days_counter`** - Generic days away/present counter
- **`custom_threshold`** - Custom threshold with configurable limits

#### Registry Pattern

All rule engines are registered in a central **registry** that allows lookup by goal type:

```typescript
import { ruleEngineRegistry } from '@uth/rules';

// Get engine for a specific goal type
const engine = ruleEngineRegistry.get('uk_ilr');

// Get all engines for a jurisdiction
const ukEngines = ruleEngineRegistry.getByJurisdiction('uk');

// Check if a goal type is supported
if (ruleEngineRegistry.isSupported('uk_ilr')) {
  // ...
}
```

### Goal Configuration (Discriminated Union)

Each goal type has its own configuration schema, defined as a discriminated union:

```typescript
type GoalConfig =
  | UKILRConfig
  | UKCitizenshipConfig
  | UKTaxConfig
  | SchengenConfig
  | DaysCounterConfig
  | CustomThresholdConfig;

interface UKILRConfig {
  type: 'uk_ilr';
  trackYears: 2 | 3 | 5 | 10;
  visaStartDate: string;
  vignetteEntryDate?: string;
  visaType?: string;
}

interface DaysCounterConfig {
  type: 'days_counter';
  countDirection: 'days_away' | 'days_present';
  referenceLocation: string;
}
```

The `type` field acts as the discriminant, enabling type-safe access to config properties.

## Built-in Rule Engines

### 1. UK ILR Rule Engine (`uk_ilr`)

Tracks progress toward UK Indefinite Leave to Remain eligibility.

**Configuration:**

```typescript
{
  type: 'uk_ilr',
  trackYears: 5,
  visaStartDate: '2020-01-01',
  vignetteEntryDate: '2020-01-15',
  visaType: 'Skilled Worker'
}
```

**Calculations:**

- Days outside UK (excluding departure/return days)
- Continuous residence (Home Office guidance v22.0)
- Rolling 12-month absence checks (180-day limit)
- Eligibility date projection

**Warnings:**

- 180-day limit exceeded in any 12-month period
- Absences approaching limit
- Continuous residence broken

### 2. Days Counter Rule Engine (`days_counter`)

Generic counter for tracking days away or present in a reference location.

**Configuration:**

```typescript
{
  type: 'days_counter',
  countDirection: 'days_away',
  referenceLocation: 'United Kingdom'
}
```

**Calculations:**

- Total days away/present
- Current streak
- Longest streak
- Average days per month

**No hard limits** - purely informational.

## Usage

### Basic Example

```typescript
import { ruleEngineRegistry } from '@uth/rules';
import type { UKILRConfig } from '@uth/rules';

// Get the UK ILR engine
const engine = ruleEngineRegistry.get('uk_ilr');

if (!engine) {
  throw new Error('UK ILR engine not registered');
}

// Define goal config
const config: UKILRConfig = {
  type: 'uk_ilr',
  trackYears: 5,
  visaStartDate: '2020-01-01',
  vignetteEntryDate: '2020-01-15',
};

// Validate config
if (!engine.validateConfig(config)) {
  throw new Error('Invalid config');
}

// Calculate progress
const result = engine.calculate(
  trips,
  config,
  new Date('2020-01-01'),
  new Date() // as of date
);

// Access results
console.log('Status:', result.status); // 'on_track' | 'at_risk' | 'eligible' | etc.
console.log('Progress:', result.progressPercent); // 0-100
console.log('Eligibility date:', result.eligibilityDate);
console.log('Metrics:', result.metrics);
console.log('Warnings:', result.warnings);
```

### Integration with MobX Store

The rule engines are designed to work seamlessly with the `goalsStore` from `@uth/stores`:

```typescript
import { makeObservable, observable, action, computed } from 'mobx';
import { ruleEngineRegistry } from '@uth/rules';
import type { TrackingGoal, GoalCalculation } from '@uth/rules';

class GoalsStore {
  goals: TrackingGoal[] = [];
  calculations = new Map<string, GoalCalculation>();

  recalculateGoal(goal: TrackingGoal, trips: TripRecord[]) {
    const engine = ruleEngineRegistry.get(goal.type);
    if (!engine) return;

    const calculation = engine.calculate(
      trips,
      goal.config,
      new Date(goal.startDate),
      new Date()
    );

    this.calculations.set(goal.id, calculation);
  }
}
```

## Adding a New Goal Type

To add support for a new goal type, follow these steps:

### 1. Define the Goal Type

Add the goal type to the union in `src/lib/types.ts`:

```typescript
export type GoalType =
  | 'uk_ilr'
  | 'uk_citizenship'
  | 'my_new_goal'; // Add here
```

### 2. Define the Configuration Schema

Add a new config interface to `src/lib/types.ts`:

```typescript
export interface MyNewGoalConfig {
  type: 'my_new_goal';
  someRequiredField: string;
  optionalField?: number;
}

// Add to the GoalConfig union
export type GoalConfig =
  | UKILRConfig
  | UKCitizenshipConfig
  | MyNewGoalConfig; // Add here
```

### 3. Create the Rule Engine

Create a new file `src/lib/engines/my-new-goal.ts`:

```typescript
import type {
  RuleEngine,
  GoalCalculation,
  MyNewGoalConfig,
  GoalMetric,
  GoalWarning,
} from '../types';
import type { TripRecord } from '@uth/calculators';

export class MyNewGoalRuleEngine
  implements RuleEngine<MyNewGoalConfig>
{
  readonly goalType = 'my_new_goal' as const;
  readonly jurisdiction = 'global' as const;

  calculate(
    trips: TripRecord[],
    config: MyNewGoalConfig,
    startDate: Date,
    asOfDate: Date = new Date()
  ): GoalCalculation {
    // Implement calculation logic here
    const metrics: GoalMetric[] = [
      {
        key: 'example_metric',
        label: 'Example Metric',
        value: 42,
        unit: 'days',
        status: 'ok',
      },
    ];

    const warnings: GoalWarning[] = [];

    return {
      goalId: '', // Will be set by caller
      goalType: this.goalType,
      status: 'in_progress',
      progressPercent: 50,
      eligibilityDate: null,
      daysUntilEligible: null,
      metrics,
      warnings,
    };
  }

  validateConfig(config: unknown): config is MyNewGoalConfig {
    if (typeof config !== 'object' || config === null) return false;
    const c = config as Record<string, unknown>;
    return (
      c.type === 'my_new_goal' &&
      typeof c.someRequiredField === 'string'
    );
  }

  getDisplayInfo() {
    return {
      name: 'My New Goal',
      icon: '🎯',
      description: 'Track my new goal type',
      category: 'personal' as const,
    };
  }
}
```

### 4. Register the Engine

Add the engine to `src/index.ts`:

```typescript
import { MyNewGoalRuleEngine } from './lib/engines/my-new-goal';

// Auto-register
ruleEngineRegistry.register(new MyNewGoalRuleEngine());
```

Also export it:

```typescript
export { MyNewGoalRuleEngine } from './lib/engines/my-new-goal';
```

### 5. Add Tests

Create `src/lib/engines/my-new-goal.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MyNewGoalRuleEngine } from './my-new-goal';
import type { MyNewGoalConfig } from '../types';

describe('MyNewGoalRuleEngine', () => {
  const engine = new MyNewGoalRuleEngine();

  it('should validate correct config', () => {
    const config: MyNewGoalConfig = {
      type: 'my_new_goal',
      someRequiredField: 'test',
    };
    expect(engine.validateConfig(config)).toBe(true);
  });

  it('should calculate correctly', () => {
    const config: MyNewGoalConfig = {
      type: 'my_new_goal',
      someRequiredField: 'test',
    };
    const result = engine.calculate(
      [],
      config,
      new Date('2024-01-01'),
      new Date('2024-06-01')
    );
    expect(result.goalType).toBe('my_new_goal');
    expect(result.status).toBe('in_progress');
  });
});
```

## Calculation Results

### GoalCalculation

```typescript
interface GoalCalculation {
  goalId: string;
  goalType: GoalType;
  status: GoalStatus;
  progressPercent: number; // 0-100
  eligibilityDate: string | null;
  daysUntilEligible: number | null;
  metrics: GoalMetric[];
  warnings: GoalWarning[];
  requirements?: GoalRequirement[]; // Optional checklist
}
```

### GoalMetric

```typescript
interface GoalMetric {
  key: string; // Unique identifier (e.g., 'days_outside_uk')
  label: string; // Display name (e.g., 'Days Outside UK')
  value: number | string;
  limit?: number | null; // Max allowed value
  unit: 'days' | 'months' | 'years' | 'percent' | 'none';
  status: 'ok' | 'warning' | 'exceeded';
  tooltip?: string; // Additional context
}
```

### GoalWarning

```typescript
interface GoalWarning {
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  action?: string; // Optional CTA
}
```

### GoalStatus

```typescript
type GoalStatus =
  | 'not_started' // No trips, no progress
  | 'in_progress' // Tracking but not yet eligible
  | 'on_track' // Will meet target at current rate
  | 'at_risk' // May exceed limits soon
  | 'limit_exceeded' // Already broke a limit
  | 'eligible' // Can apply now
  | 'achieved'; // Goal completed
```

## Best Practices

### 1. Keep Engines Pure

Rule engines should be **pure functions** - same input always produces same output. Avoid:

- Fetching data inside `calculate()`
- Mutating input arrays
- Accessing external state
- Using non-deterministic functions (except `Date` for `asOfDate`)

### 2. Validate Configurations

Always implement robust `validateConfig()`:

```typescript
validateConfig(config: unknown): config is UKILRConfig {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as Record<string, unknown>;

  // Check type discriminant
  if (c.type !== 'uk_ilr') return false;

  // Validate required fields
  if (![2, 3, 5, 10].includes(c.trackYears as number)) return false;
  if (typeof c.visaStartDate !== 'string') return false;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.visaStartDate)) return false;

  return true;
}
```

### 3. Use Type Guards

Leverage TypeScript's type narrowing:

```typescript
const engine = ruleEngineRegistry.get(goal.type);
if (!engine) throw new Error('Engine not found');

// Now TypeScript knows engine is defined
const result = engine.calculate(...);
```

### 4. Provide Helpful Warnings

Generate actionable warnings:

```typescript
warnings.push({
  severity: 'warning',
  title: 'Approaching 180-day limit',
  message: 'You have 150 days outside UK in the last 12 months. Limit is 180 days.',
  action: 'Plan your trips carefully to avoid breaking continuous residence.'
});
```

### 5. Test Edge Cases

Test your engines with:

- Empty trip arrays
- Overlapping trips
- Trips spanning goal start/end dates
- Invalid configs
- Boundary conditions (exactly at limits)

## Testing

Run tests:

```bash
npm test
```

Run with coverage:

```bash
npm run test:coverage
```

## Dependencies

- **`@uth/calculators`** - Trip calculation utilities (days outside, date ranges, etc.)
- **`date-fns`** - Date manipulation

## Related Packages

- **`@uth/stores`** - MobX stores for state management (uses `@uth/rules` for calculations)
- **`@uth/db`** - Database operations (stores goal configs in DB)
- **`@uth/features`** - Feature flags (controls which goal types are available)

## License

Private package - not for public distribution.
