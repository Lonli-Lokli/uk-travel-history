# Multi-Goal Tracking System: Refined Implementation Plan

## Executive Summary

Transform the UK ILR-only tracker into a flexible, multi-purpose tracking platform. This plan prioritizes **backward compatibility**, **incremental delivery**, and **user-friendly onboarding**.

### Key Principles

1. **Zero disruption to existing users** - Current ILR tracking must work unchanged until users opt-in
2. **Incremental rollout** - Each phase delivers value independently
3. **Mobile-first UI** - Mini cards must work on small screens
4. **Simple onboarding** - Non-immigration users shouldn't see immigration jargon

---

## Phase 0: Foundation (Pre-requisite)

### 0.1 Feature Flag Setup

Before any multi-goal work, add feature flag in two places:

#### 1. Add to FEATURE_KEYS (`packages/features/src/lib/shapes.ts`)

```typescript
export const FEATURE_KEYS = {
  // ...existing keys...
  MULTI_GOAL_TRACKING: 'multi_goal_tracking',
} as const;
```

#### 2. Add to seed.sql (`supabase/seed.sql`)

```sql
INSERT INTO feature_policies (feature_key, enabled, min_tier, rollout_percentage, beta_users)
VALUES
  ('multi_goal_tracking', false, 'anonymous', NULL, '{}')
ON CONFLICT (feature_key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  min_tier = EXCLUDED.min_tier;
```

#### 3. Add migration for production (`supabase/migrations/YYYYMMDD_add_multi_goal_feature_flag.sql`)

```sql
-- Add multi_goal_tracking feature flag
INSERT INTO feature_policies (feature_key, enabled, min_tier, rollout_percentage, beta_users)
VALUES ('multi_goal_tracking', false, 'anonymous', NULL, '{}')
ON CONFLICT (feature_key) DO NOTHING;
```

**Acceptance:**

- [ ] `FEATURE_KEYS.MULTI_GOAL_TRACKING` exists in `@uth/features`
- [ ] Feature flag exists in seed.sql and defaults to `false`
- [ ] Migration created for production deployment
- [ ] Can be enabled per-user via `beta_users` array

---

## Phase 1: Database Schema

### 1.1 Create `tracking_goals` Table

```sql
CREATE TABLE tracking_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,  -- clerk_user_id (not FK to allow anonymous)

  -- Goal identity
  type VARCHAR(50) NOT NULL,
  jurisdiction VARCHAR(20) NOT NULL DEFAULT 'global',
  name VARCHAR(100) NOT NULL,

  -- Configuration (JSONB for flexibility)
  config JSONB NOT NULL DEFAULT '{}',

  -- Key dates
  start_date DATE NOT NULL,
  target_date DATE,  -- Calculated eligibility date

  -- UI state
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  color VARCHAR(20),  -- Optional UI customization

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_goal_type CHECK (type IN (
    'uk_ilr', 'uk_citizenship', 'uk_tax_residency',
    'schengen_90_180',
    'days_counter', 'custom_threshold'
  )),
  CONSTRAINT valid_jurisdiction CHECK (jurisdiction IN (
    'uk', 'schengen', 'global'
  ))
);

-- Indexes
CREATE INDEX idx_tracking_goals_user ON tracking_goals(user_id);
CREATE INDEX idx_tracking_goals_active ON tracking_goals(user_id, is_active) WHERE NOT is_archived;

-- RLS
ALTER TABLE tracking_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY tracking_goals_select_own ON tracking_goals
  FOR SELECT TO authenticated
  USING (user_id = public.clerk_user_id());

CREATE POLICY tracking_goals_insert_own ON tracking_goals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.clerk_user_id());

CREATE POLICY tracking_goals_update_own ON tracking_goals
  FOR UPDATE TO authenticated
  USING (user_id = public.clerk_user_id());

CREATE POLICY tracking_goals_delete_own ON tracking_goals
  FOR DELETE TO authenticated
  USING (user_id = public.clerk_user_id());
```

### 1.2 Create `goal_templates` Table

```sql
CREATE TABLE goal_templates (
  id VARCHAR(50) PRIMARY KEY,

  -- Categorization
  jurisdiction VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,  -- 'immigration', 'tax', 'personal'

  -- Display
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),

  -- Template data
  type VARCHAR(50) NOT NULL,
  default_config JSONB NOT NULL,
  required_fields JSONB NOT NULL DEFAULT '[]',  -- Fields user must fill

  -- Availability
  display_order INTEGER NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  min_tier VARCHAR(20) DEFAULT 'anonymous'
);

-- Anyone can read templates
ALTER TABLE goal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY goal_templates_select_all ON goal_templates FOR SELECT USING (true);
```

### 1.3 Seed Goal Templates

```sql
INSERT INTO goal_templates (id, jurisdiction, category, name, description, icon, type, default_config, required_fields, display_order) VALUES
-- UK Immigration
('uk_ilr_5yr', 'uk', 'immigration', 'UK ILR (5-Year)', 'Indefinite Leave to Remain via standard 5-year route', 'home', 'uk_ilr', '{"trackYears": 5}', '["visaStartDate"]', 1),
('uk_ilr_3yr', 'uk', 'immigration', 'UK ILR (3-Year)', 'ILR via family/spouse route', 'home', 'uk_ilr', '{"trackYears": 3}', '["visaStartDate"]', 2),
('uk_ilr_10yr', 'uk', 'immigration', 'UK ILR (10-Year)', 'Long residence route', 'home', 'uk_ilr', '{"trackYears": 10}', '["visaStartDate"]', 3),
('uk_citizenship', 'uk', 'immigration', 'British Citizenship', 'Naturalisation after ILR', 'flag', 'uk_citizenship', '{"qualifyingYears": 5}', '["ilrGrantDate"]', 4),

-- UK Tax
('uk_tax', 'uk', 'tax', 'UK Tax Residency', 'Statutory Residence Test tracking', 'calculator', 'uk_tax_residency', '{}', '["taxYear"]', 10),

-- Schengen
('schengen_90_180', 'schengen', 'immigration', 'Schengen 90/180', '90 days per 180-day rolling window', 'globe', 'schengen_90_180', '{}', '[]', 20),

-- Personal / Generic
('days_away', 'global', 'personal', 'Days Away', 'Count days spent away from home', 'plane', 'days_counter', '{"countDirection": "days_away", "referenceLocation": "Home"}', '[]', 100),
('days_present', 'global', 'personal', 'Days Present', 'Count days in a specific location', 'map-pin', 'days_counter', '{"countDirection": "days_present", "referenceLocation": "UK"}', '[]', 101),
('custom', 'global', 'personal', 'Custom Goal', 'Set your own day limit and window', 'settings', 'custom_threshold', '{"thresholdDays": 180, "windowDays": 365}', '["thresholdDays", "windowDays"]', 110);

-- Note: 'custom' template requires paid tier (min_tier = 'monthly')
UPDATE goal_templates SET min_tier = 'monthly' WHERE id = 'custom';
```

### 1.4 Migration Script for Existing Users

**Important:** This does NOT auto-migrate. Users must opt-in.

```sql
-- Function to migrate a user's ILR data to a goal
CREATE OR REPLACE FUNCTION migrate_user_to_goal(p_user_id TEXT)
RETURNS UUID AS $$
DECLARE
  v_user RECORD;
  v_goal_id UUID;
BEGIN
  -- Get user's current ILR data from wherever it's stored (travelStore exports to localStorage/DB)
  -- This is a placeholder - actual implementation depends on where user data lives

  -- For now, this function would be called from the app layer
  -- which has access to the user's travelStore data
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

**Acceptance:**

- [ ] `tracking_goals` table created with RLS
- [ ] `goal_templates` table seeded
- [ ] Indexes verified with EXPLAIN ANALYZE
- [ ] Migration function stub exists

---

## Phase 2: Domain Types & Rule Engines

### 2.1 Core Types (`packages/rules/src/types.ts`)

```typescript
// Jurisdiction - where the tracking rules apply
export type Jurisdiction = 'uk' | 'schengen' | 'global';

// Goal type - which rule set to use
export type GoalType = 'uk_ilr' | 'uk_citizenship' | 'uk_tax_residency' | 'schengen_90_180' | 'days_counter' | 'custom_threshold';

// Category for UI grouping
export type GoalCategory = 'immigration' | 'tax' | 'personal';

// Status indicators
export type GoalStatus =
  | 'not_started' // No trips, no progress
  | 'in_progress' // Tracking but not yet eligible
  | 'on_track' // Will meet target at current rate
  | 'at_risk' // May exceed limits soon
  | 'limit_exceeded' // Already broke a limit
  | 'eligible' // Can apply now
  | 'achieved'; // Goal completed

// Main goal entity
export interface TrackingGoal {
  id: string;
  userId: string;
  type: GoalType;
  jurisdiction: Jurisdiction;
  name: string;
  config: GoalConfig;
  startDate: string; // ISO date
  targetDate: string | null;
  isActive: boolean;
  isArchived: boolean;
  displayOrder: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

// Discriminated union for goal configs
export type GoalConfig = UKILRConfig | UKCitizenshipConfig | UKTaxConfig | SchengenConfig | DaysCounterConfig | CustomThresholdConfig;

export interface UKILRConfig {
  type: 'uk_ilr';
  trackYears: 3 | 5 | 10;
  visaStartDate: string;
  vignetteEntryDate?: string;
  visaType?: string;
}

export interface UKCitizenshipConfig {
  type: 'uk_citizenship';
  ilrGrantDate: string;
  qualifyingYears: 3 | 5;
  marriedToBritish: boolean;
}

export interface UKTaxConfig {
  type: 'uk_tax_residency';
  taxYear: string; // "2024-25"
}

export interface SchengenConfig {
  type: 'schengen_90_180';
  homeCountry?: string;
}

export interface DaysCounterConfig {
  type: 'days_counter';
  countDirection: 'days_away' | 'days_present';
  referenceLocation: string;
}

export interface CustomThresholdConfig {
  type: 'custom_threshold';
  thresholdDays: number;
  windowDays: number;
  countDirection: 'days_away' | 'days_present';
  description?: string;
}

// Calculation result
export interface GoalCalculation {
  goalId: string;
  goalType: GoalType;
  status: GoalStatus;

  // Progress
  progressPercent: number; // 0-100

  // Key dates
  eligibilityDate: string | null;
  daysUntilEligible: number | null;

  // Metrics vary by goal type
  metrics: GoalMetric[];

  // Warnings/alerts
  warnings: GoalWarning[];

  // For complex goals: checklist items
  requirements?: GoalRequirement[];
}

export interface GoalMetric {
  key: string;
  label: string;
  value: number | string;
  limit?: number | null;
  unit: 'days' | 'months' | 'years' | 'percent' | 'none';
  status: 'ok' | 'warning' | 'exceeded';
  tooltip?: string;
}

export interface GoalWarning {
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  action?: string;
}

export interface GoalRequirement {
  key: string;
  label: string;
  status: 'met' | 'pending' | 'not_met' | 'unknown';
  detail?: string;
}
```

### 2.2 Rule Engine Interface (`packages/rules/src/engine.ts`)

```typescript
import { TripRecord } from '@uth/calculators';

export interface RuleEngine<TConfig extends GoalConfig = GoalConfig> {
  readonly goalType: GoalType;
  readonly jurisdiction: Jurisdiction;

  // Calculate results
  calculate(trips: TripRecord[], config: TConfig, startDate: Date, asOfDate?: Date): GoalCalculation;

  // Validate config
  validateConfig(config: unknown): config is TConfig;

  // UI metadata
  getDisplayInfo(): {
    name: string;
    icon: string;
    description: string;
    category: GoalCategory;
  };
}

// Registry
class RuleEngineRegistry {
  private engines = new Map<GoalType, RuleEngine>();

  register(engine: RuleEngine): void {
    this.engines.set(engine.goalType, engine);
  }

  get(type: GoalType): RuleEngine | undefined {
    return this.engines.get(type);
  }

  getAll(): RuleEngine[] {
    return Array.from(this.engines.values());
  }

  getByJurisdiction(jurisdiction: Jurisdiction): RuleEngine[] {
    return this.getAll().filter((e) => e.jurisdiction === jurisdiction);
  }
}

export const ruleEngineRegistry = new RuleEngineRegistry();
```

### 2.3 UK ILR Rule Engine

**Refactor existing `@uth/calculators` logic into rule engine format.**

```typescript
// packages/rules/src/engines/uk-ilr.ts
export class UKILRRuleEngine implements RuleEngine<UKILRConfig> {
  readonly goalType = 'uk_ilr' as const;
  readonly jurisdiction = 'uk' as const;

  calculate(trips: TripRecord[], config: UKILRConfig, startDate: Date, asOfDate: Date = new Date()): GoalCalculation {
    // Use existing calculateTravelData from @uth/calculators
    // Transform to GoalCalculation format
    // ...
  }

  validateConfig(config: unknown): config is UKILRConfig {
    // Validate required fields
  }

  getDisplayInfo() {
    return {
      name: 'UK Indefinite Leave to Remain',
      icon: 'home',
      description: 'Track continuous residence for ILR eligibility',
      category: 'immigration' as const,
    };
  }
}
```

### 2.4 Days Counter Rule Engine (Simplest)

```typescript
// packages/rules/src/engines/days-counter.ts
export class DaysCounterRuleEngine implements RuleEngine<DaysCounterConfig> {
  readonly goalType = 'days_counter' as const;
  readonly jurisdiction = 'global' as const;

  calculate(trips: TripRecord[], config: DaysCounterConfig, startDate: Date, asOfDate: Date = new Date()): GoalCalculation {
    const daysAway = this.calculateDaysAway(trips, startDate, asOfDate);
    const totalDays = this.daysBetween(startDate, asOfDate);
    const daysPresent = totalDays - daysAway;

    const value = config.countDirection === 'days_away' ? daysAway : daysPresent;

    return {
      goalId: '', // Set by caller
      goalType: 'days_counter',
      status: 'in_progress',
      progressPercent: 0, // No target for simple counter
      eligibilityDate: null,
      daysUntilEligible: null,
      metrics: [
        {
          key: 'total_days',
          label: config.countDirection === 'days_away' ? 'Days Away' : 'Days Present',
          value,
          unit: 'days',
          status: 'ok',
          tooltip: `Since ${format(startDate, 'MMM d, yyyy')}`,
        },
        {
          key: 'tracking_period',
          label: 'Tracking Period',
          value: totalDays,
          unit: 'days',
          status: 'ok',
        },
      ],
      warnings: [],
    };
  }
}
```

**Acceptance:**

- [ ] `packages/rules` package created
- [ ] Core types exported
- [ ] `UKILRRuleEngine` extracts logic from `@uth/calculators`
- [ ] `DaysCounterRuleEngine` implemented
- [ ] Unit tests for both engines
- [ ] Registry populated on app boot

---

## Phase 3: API Layer

### 3.1 Database Access (`packages/db/src/goals.ts`)

```typescript
// Add to @uth/db package

export interface CreateGoalInput {
  type: GoalType;
  jurisdiction: Jurisdiction;
  name: string;
  config: GoalConfig;
  startDate: string;
}

export interface UpdateGoalInput {
  name?: string;
  config?: Partial<GoalConfig>;
  isActive?: boolean;
  isArchived?: boolean;
  displayOrder?: number;
  color?: string;
}

// CRUD operations
export async function createGoal(userId: string, input: CreateGoalInput): Promise<TrackingGoal>;
export async function getGoal(goalId: string): Promise<TrackingGoal | null>;
export async function getUserGoals(userId: string, includeArchived?: boolean): Promise<TrackingGoal[]>;
export async function updateGoal(goalId: string, input: UpdateGoalInput): Promise<TrackingGoal>;
export async function deleteGoal(goalId: string): Promise<void>;
export async function reorderGoals(userId: string, goalIds: string[]): Promise<void>;

// Templates
export async function getGoalTemplates(jurisdiction?: Jurisdiction): Promise<GoalTemplate[]>;
```

### 3.2 API Routes

| Method | Path                        | Description               |
| ------ | --------------------------- | ------------------------- |
| GET    | `/api/goals`                | List user's goals         |
| POST   | `/api/goals`                | Create new goal           |
| GET    | `/api/goals/[id]`           | Get goal with calculation |
| PATCH  | `/api/goals/[id]`           | Update goal               |
| DELETE | `/api/goals/[id]`           | Delete goal               |
| POST   | `/api/goals/reorder`        | Reorder goals             |
| GET    | `/api/goals/templates`      | Get available templates   |
| POST   | `/api/goals/[id]/calculate` | Force recalculate         |

### 3.3 Route Implementation Example

```typescript
// app/api/goals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@uth/auth-server';
import { db } from '@uth/db';
import { checkFeatureAccess } from '@uth/features';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check feature flag
  const hasAccess = await checkFeatureAccess('multi_goal_tracking', user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Feature not available' }, { status: 403 });
  }

  const includeArchived = request.nextUrl.searchParams.get('archived') === 'true';
  const goals = await db.getUserGoals(user.id, includeArchived);

  return NextResponse.json({ goals });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await checkFeatureAccess('multi_goal_tracking', user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Feature not available' }, { status: 403 });
  }

  // Check goal limit: 1 for free tier, unlimited for paid
  const existingGoals = await db.getUserGoals(user.id, false);
  const userProfile = await db.getUserProfile(user.id);
  const isPaid = userProfile?.subscription_tier !== 'free';

  if (!isPaid && existingGoals.length >= 1) {
    return NextResponse.json({ error: 'Free tier limited to 1 goal. Upgrade to add more.' }, { status: 403 });
  }

  const body = await request.json();
  // Validate body...

  const goal = await db.createGoal(user.id, body);
  return NextResponse.json({ goal }, { status: 201 });
}
```

**Acceptance:**

- [ ] All CRUD operations in `@uth/db`
- [ ] All API routes implemented
- [ ] Authentication required
- [ ] Feature flag check on all routes
- [ ] Goal limit enforced (1 for free, unlimited for paid)
- [ ] Integration tests passing

---

## Phase 4: Client State Management

### 4.0 Server-Side Loading & Hydration Pattern

**CRITICAL**: Follow the existing `AccessContext` → `Providers` → `store.hydrate()` pattern.

#### Current Architecture (Reference)

```
┌─────────────────────────────────────────────────────────────────────┐
│ layout.tsx (Server Component)                                        │
│   const accessContext = await loadAccessContext();                  │
│   <Providers accessContext={accessContext}>                         │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Providers.tsx (Client Component)                                     │
│   useEffect(() => {                                                  │
│     authStore.hydrate(accessContext.user);                          │
│     monetizationStore.hydrate(tier, role, policies);                │
│     paymentStore.hydrate(accessContext.pricing);                    │
│   }, [accessContext]);                                              │
└─────────────────────────────────────────────────────────────────────┘
```

#### Extended Architecture for Goals

```
┌─────────────────────────────────────────────────────────────────────┐
│ layout.tsx (Server Component)                                        │
│   const accessContext = await loadAccessContext();                  │
│   // AccessContext now includes: goals, goalCalculations            │
│   <Providers accessContext={accessContext}>                         │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Providers.tsx (Client Component)                                     │
│   useEffect(() => {                                                  │
│     // ...existing hydration...                                      │
│     if (accessContext.goals) {                                      │
│       goalsStore.hydrate(accessContext.goals, accessContext.goalCalculations);
│     }                                                                │
│   }, [accessContext]);                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.1 Extend AccessContext (`packages/db/src/types/domain.ts`)

```typescript
// Add to AccessContext interface
export interface AccessContext {
  // ...existing fields...

  /**
   * User's tracking goals (null if feature disabled or no goals)
   * Loaded server-side for instant hydration
   */
  goals: TrackingGoalData[] | null;

  /**
   * Pre-computed goal calculations (null if no goals)
   * Calculations done server-side to prevent client-side flicker
   */
  goalCalculations: Record<string, GoalCalculationData> | null;
}

// Serializable goal data (no Date objects, use ISO strings)
export interface TrackingGoalData {
  id: string;
  userId: string;
  type: string;
  jurisdiction: string;
  name: string;
  config: Record<string, unknown>;
  startDate: string; // ISO date string
  targetDate: string | null;
  isActive: boolean;
  isArchived: boolean;
  displayOrder: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 Update Providers.tsx (`apps/uk-travel-history/src/components/Providers.tsx`)

```typescript
import { goalsStore } from '@uth/stores';

export function Providers({ children, accessContext }: ProvidersProps) {
  useEffect(() => {
    // ...existing hydration...
    authStore.hydrate(authUser);
    monetizationStore.hydrate(tierId, roleId, policies);
    paymentStore.hydrate(accessContext.pricing);

    // NEW: Hydrate goals store with server-loaded data
    if (accessContext.goals !== undefined) {
      goalsStore.hydrate(accessContext.goals, accessContext.goalCalculations);
    }

    authStore.initializeAuthSubscription();
  }, [accessContext]);

  // ...rest unchanged...
}
```

### 4.3 Update loadAccessContext (`packages/features/src/lib/access-context.ts`)

```typescript
export async function loadAccessContext(): Promise<AccessContext> {
  // ...existing auth, tier, role, policies loading...

  // Load goals if feature is enabled
  let goals: TrackingGoalData[] | null = null;
  let goalCalculations: Record<string, GoalCalculationData> | null = null;

  const multiGoalEnabled = policies['multi_goal_tracking']?.enabled ?? false;

  if (user && multiGoalEnabled) {
    goals = await db.getUserGoals(user.uid, false); // exclude archived

    // Pre-compute calculations server-side
    if (goals.length > 0) {
      const { ruleEngineRegistry } = await import('@uth/rules');
      goalCalculations = {};

      for (const goal of goals) {
        const engine = ruleEngineRegistry.get(goal.type);
        if (engine) {
          // Note: trips must come from somewhere - see section 4.4
          goalCalculations[goal.id] = engine.calculate([], goal.config, new Date(goal.startDate));
        }
      }
    }
  }

  return {
    // ...existing fields...
    goals,
    goalCalculations,
  };
}
```

### 4.3 Goals Store (`packages/stores/src/lib/goalsStore.ts`)

```typescript
import { makeAutoObservable, runInAction } from 'mobx';
import type { TrackingGoalData, GoalCalculationData } from '@uth/db';
import { TrackingGoal, GoalCalculation, GoalType, GoalConfig } from '@uth/rules';

export class GoalsStore {
  // State
  goals: TrackingGoal[] = [];
  calculations: Map<string, GoalCalculation> = new Map();
  activeGoalId: string | null = null;
  isLoading = false;
  error: string | null = null;
  isFeatureEnabled = false;
  isHydrated = false;

  constructor() {
    makeAutoObservable(this);
  }

  // ============================================================================
  // HYDRATION (called from Providers.tsx with server-loaded data)
  // ============================================================================

  /**
   * Hydrate store with server-loaded goals data.
   * This prevents flicker by having data ready immediately on page render.
   */
  hydrate(goals: TrackingGoalData[] | null, calculations: Record<string, GoalCalculationData> | null): void {
    if (!goals) {
      this.isHydrated = true;
      return;
    }

    // Convert serialized data to domain types
    this.goals = goals.map((g) => ({
      ...g,
      // Dates are already ISO strings, keep as-is for serialization
    })) as TrackingGoal[];

    // Hydrate calculations map
    if (calculations) {
      this.calculations = new Map(Object.entries(calculations).map(([id, calc]) => [id, calc as GoalCalculation]));
    }

    // Set first goal as active if none selected
    if (this.goals.length > 0 && !this.activeGoalId) {
      this.activeGoalId = this.goals[0].id;
    }

    this.isFeatureEnabled = true;
    this.isHydrated = true;
  }

  // Computed
  get hasGoals(): boolean {
    return this.goals.length > 0;
  }

  get activeGoals(): TrackingGoal[] {
    return this.goals.filter((g) => g.isActive && !g.isArchived).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  get activeGoal(): TrackingGoal | null {
    if (!this.activeGoalId) return this.activeGoals[0] ?? null;
    return this.goals.find((g) => g.id === this.activeGoalId) ?? null;
  }

  get activeCalculation(): GoalCalculation | null {
    if (!this.activeGoal) return null;
    return this.calculations.get(this.activeGoal.id) ?? null;
  }

  // Actions
  async fetchGoals(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch('/api/goals');
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      runInAction(() => {
        this.goals = data.goals;
        this.isLoading = false;

        // Calculate all active goals
        this.activeGoals.forEach((goal) => {
          this.calculateGoal(goal.id);
        });
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to fetch goals';
        this.isLoading = false;
      });
    }
  }

  async createGoal(input: CreateGoalInput): Promise<TrackingGoal> {
    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    runInAction(() => {
      this.goals.push(data.goal);
      this.calculateGoal(data.goal.id);
    });

    return data.goal;
  }

  setActiveGoal(goalId: string | null): void {
    this.activeGoalId = goalId;
  }

  calculateGoal(goalId: string): void {
    const goal = this.goals.find((g) => g.id === goalId);
    if (!goal) return;

    // Get trips from travelStore
    const { travelStore } = require('./travelStore');
    const trips = travelStore.trips;

    // Get rule engine
    const { ruleEngineRegistry } = require('@uth/rules');
    const engine = ruleEngineRegistry.get(goal.type);
    if (!engine) return;

    const calculation = engine.calculate(trips, goal.config, new Date(goal.startDate));
    calculation.goalId = goalId;

    runInAction(() => {
      this.calculations.set(goalId, calculation);
    });
  }

  // Recalculate all active goals (call when trips change)
  recalculateAll(): void {
    this.activeGoals.forEach((goal) => {
      this.calculateGoal(goal.id);
    });
  }
}

export const goalsStore = new GoalsStore();
```

### 4.2 Travel Store Integration

```typescript
// In travelStore.ts - add reaction to recalculate goals when trips change

import { reaction } from 'mobx';
import { goalsStore } from './goalsStore';

// In constructor or init:
reaction(
  () => this.trips.slice(), // Observe trips array
  () => {
    if (goalsStore.isFeatureEnabled) {
      goalsStore.recalculateAll();
    }
  },
  { delay: 300 }, // Debounce
);
```

**Acceptance:**

- [ ] `GoalsStore` implemented
- [ ] Integrates with `travelStore` for trip data
- [ ] Calculations cached and updated reactively
- [ ] Feature flag check on initialization

---

## Phase 5: UI Components

### 5.0 Use @uth/widgets Feature Controls

**CRITICAL**: Use existing feature control components from `@uth/widgets` for consistency.

#### Available Components (from widgets package)

| Component                 | Purpose                                   | Use Case                                      |
| ------------------------- | ----------------------------------------- | --------------------------------------------- |
| `FeatureGate`             | Wrap content that requires feature access | Hide entire sections for non-enabled users    |
| `FeatureButton`           | Button with auto premium badge            | "Add Goal" button for free tier users         |
| `useFeatureGate(feature)` | Hook for custom logic                     | Check `canAddMore` based on tier + goal count |

#### Integration with Goal Limits

```tsx
// GoalMiniCardsRow.tsx
import { FeatureButton, useFeatureGate } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';
import { observer } from 'mobx-react-lite';

export const GoalMiniCardsRow = observer(({ goals, onAddGoal, onUpgrade }) => {
  const { hasAccess: isPremium } = useFeatureGate(FEATURE_KEYS.PREMIUM_FEATURES);
  const canAddMore = isPremium || goals.length < 1;

  return (
    <div className="flex gap-2 overflow-x-auto">
      {goals.map((goal) => (
        <GoalMiniCard key={goal.id} goal={goal} />
      ))}

      {canAddMore ? (
        <button onClick={onAddGoal}>+ Add Goal</button>
      ) : (
        // Use FeatureButton - auto shows "PRO" badge and triggers upgrade flow
        <FeatureButton feature={FEATURE_KEYS.PREMIUM_FEATURES} onClick={onAddGoal} variant="outline">
          + Add Goal
        </FeatureButton>
      )}
    </div>
  );
});
```

#### Feature Flag for Multi-Goal UI

```tsx
// TravelPageClient.tsx
import { FeatureGate } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';

export const TravelPageClient = observer(() => {
  return (
    <FeatureGate
      feature={FEATURE_KEYS.MULTI_GOAL_TRACKING}
      fallback={<LegacyTravelPage />} // Show old UI if feature disabled
    >
      <MultiGoalTravelPage />
    </FeatureGate>
  );
});
```

### 5.1 Component Architecture

```
components/goals/
├── GoalMiniCard.tsx           # Single compact goal card
├── GoalMiniCardsRow.tsx       # Horizontal scrollable row of mini cards
├── GoalDetailPanel.tsx        # Full detail view for selected goal
├── GoalEmptyState.tsx         # When no goals exist
├── AddGoalFlow/
│   ├── AddGoalModal.tsx       # Main modal container
│   ├── CategoryStep.tsx       # Step 1: Choose category
│   ├── TemplateStep.tsx       # Step 2: Choose template
│   └── ConfigureStep.tsx      # Step 3: Configure details
├── details/                   # Goal-type-specific detail views
│   ├── UKILRDetail.tsx
│   ├── DaysCounterDetail.tsx
│   └── ...
└── shared/
    ├── ProgressRing.tsx       # Circular progress indicator
    ├── MetricBadge.tsx        # Stat display
    └── StatusIndicator.tsx    # Status dot/label
```

### 5.2 GoalMiniCard Design

**Mobile-first, compact, informative at a glance.**

```tsx
// Approximate dimensions: ~100px wide, ~70px tall
// Shows: Icon, Progress %, Short name, Status indicator

interface GoalMiniCardProps {
  goal: TrackingGoal;
  calculation: GoalCalculation | null;
  isSelected: boolean;
  onClick: () => void;
}

/*
Visual:
┌───────────────┐
│  [Icon]  78%  │  <- Progress ring or percentage
│   ILR 2025    │  <- Goal name (truncated)
│    ● On Track │  <- Status dot + label
└───────────────┘
*/
```

### 5.3 GoalMiniCardsRow Design

**Horizontal scroll on mobile, wrap on desktop.**

```tsx
interface GoalMiniCardsRowProps {
  goals: TrackingGoal[];
  calculations: Map<string, GoalCalculation>;
  activeGoalId: string | null;
  onGoalSelect: (goalId: string) => void;
  onAddGoal: () => void;
  canAddMore: boolean; // false if free tier and already has 1 goal
  onUpgrade: () => void;
}

/*
Mobile (< 640px):
┌──────────────────────────────────────────────────────┐
│ [Card 1] [Card 2] [Card 3] [+]    ← Horizontal scroll│
└──────────────────────────────────────────────────────┘

Desktop (≥ 640px):
┌──────────────────────────────────────────────────────┐
│ [Card 1] [Card 2] [Card 3] [Card 4] [+Add Goal]      │
└──────────────────────────────────────────────────────┘

Free tier with 1 goal (shows upgrade prompt):
┌──────────────────────────────────────────────────────┐
│ [Card 1] [🔒 Upgrade to add more goals]              │
└──────────────────────────────────────────────────────┘
*/
```

### 5.4 Add Goal Flow

**Three-step wizard optimized for clarity.**

**Tier restrictions:**

- Anonymous/Free users: Can only select from predefined templates (no "Custom Goal")
- Paid users: Full access to all templates including custom goals

**Step 1: Category Selection**

```
What would you like to track?

  [🏠 Immigration]        [💷 Tax]        [📊 Personal]
  "Visa, residency,       "Tax years,     "Days away,
   citizenship"            SRT"            custom goals"
```

**Step 2: Template Selection** (filtered by category)

```
Choose a goal type:

  UK Indefinite Leave to Remain (5-Year)  →
  UK Indefinite Leave to Remain (3-Year)  →
  UK Citizenship (Naturalisation)         →

  [← Back]
```

**Step 3: Configuration** (based on template)

```
Configure your goal:

  Goal Name: [UK ILR                    ]

  Visa Start Date: [01/03/2022          ] *Required

  Vignette Entry:  [15/02/2022          ] Optional

  [← Back]                    [Create Goal →]
```

### 5.5 GoalDetailPanel

**Replaces current SummaryCards when a goal is selected.**

```tsx
interface GoalDetailPanelProps {
  goal: TrackingGoal;
  calculation: GoalCalculation;
}

/*
┌─────────────────────────────────────────────────────────────┐
│ UK ILR (5-Year)                              [Edit] [Archive]│
│                                                              │
│ ┌──────────┐  Status: On Track                              │
│ │   78%    │  Eligible: March 15, 2027                      │
│ │  ████    │  Days Until: 247                               │
│ └──────────┘                                                 │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Days Outside UK    │ Max 12-Month    │ Days Available  │  │
│ │      156           │     98          │      82         │  │
│ │   of 450 limit     │   of 180 limit  │   this window   │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ⚠️ Planning a 3-week trip? You have 82 days available.     │
└─────────────────────────────────────────────────────────────┘
*/
```

### 5.6 Empty State / Onboarding

```tsx
/*
When user has no goals:

┌─────────────────────────────────────────────────────────────┐
│                                                              │
│           📊 Start Tracking Your Time                        │
│                                                              │
│   Track your days for visa applications, tax purposes,       │
│   or just to see how much you travel.                        │
│                                                              │
│           [+ Create Your First Goal]                         │
│                                                              │
│   ─────────────────────────────────────                     │
│                                                              │
│   Popular goals:                                             │
│   • UK ILR - Track continuous residence                      │
│   • Schengen 90/180 - Stay within limits                    │
│   • Days Away - Simple travel counter                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
*/
```

### 5.7 Updated TravelPageClient

```tsx
export const TravelPageClient = observer(() => {
  const isMultiGoalEnabled = goalsStore.isFeatureEnabled;

  // Render old UI if feature disabled
  if (!isMultiGoalEnabled) {
    return <LegacyTravelPage />;
  }

  // New multi-goal UI
  return (
    <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
      {/* Goal Selection Row */}
      {goalsStore.hasGoals ? <GoalMiniCardsRow goals={goalsStore.activeGoals} calculations={goalsStore.calculations} activeGoalId={goalsStore.activeGoalId} onGoalSelect={goalsStore.setActiveGoal} onAddGoal={() => setShowAddModal(true)} /> : <GoalEmptyState onAddGoal={() => setShowAddModal(true)} />}

      {/* Selected Goal Detail */}
      {goalsStore.activeGoal && goalsStore.activeCalculation && <GoalDetailPanel goal={goalsStore.activeGoal} calculation={goalsStore.activeCalculation} />}

      {/* Trip Table */}
      <TravelHistoryCard />

      {/* Add Goal Modal */}
      <AddGoalModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onGoalCreated={(goal) => {
          goalsStore.setActiveGoal(goal.id);
          setShowAddModal(false);
        }}
      />
    </div>
  );
});
```

**Acceptance:**

- [ ] All components created
- [ ] Mobile-responsive mini cards row
- [ ] Add goal wizard works end-to-end
- [ ] Goal selection switches detail view
- [ ] Empty state shows for new users
- [ ] Feature flag hides new UI when disabled

---

## Phase 6: Migration & Rollout

### 6.1 Migration UI for Existing Users

When multi-goal is enabled for a user with existing ILR data:

```tsx
/*
┌─────────────────────────────────────────────────────────────┐
│ 🎉 New Feature: Multi-Goal Tracking                         │
│                                                              │
│ We've upgraded the app to track multiple goals at once!     │
│                                                              │
│ Your existing ILR tracking data is safe. Would you like to: │
│                                                              │
│ [Convert to New System]  [Keep Using Classic View]          │
│                                                              │
│ Converting will:                                             │
│ • Create an "ILR Tracking" goal with your current settings  │
│ • Keep all your trip data                                   │
│ • Let you add more goals (citizenship, Schengen, etc.)      │
└─────────────────────────────────────────────────────────────┘
*/
```

### 6.2 Rollout Plan

| Stage | Scope                 | Duration | Success Criteria                  |
| ----- | --------------------- | -------- | --------------------------------- |
| Alpha | Internal + beta_users | 1 week   | No data loss, calculations match  |
| Beta  | 10% rollout           | 2 weeks  | <1% error rate, positive feedback |
| GA    | 50% rollout           | 1 week   | Stable metrics                    |
| Full  | 100%                  | Ongoing  | -                                 |

### 6.3 Backward Compatibility

- **Feature flag off**: Existing `SummaryCards` + `VisaDetailsCard` work unchanged
- **Feature flag on, no migration**: Show migration prompt
- **Feature flag on, migrated**: Show new multi-goal UI
- **Fallback**: User can switch back to "Classic View" in settings

---

## Summary Checklist

### Phase 0 (Foundation)

- [ ] `FEATURE_KEYS.MULTI_GOAL_TRACKING` added to `@uth/features`
- [ ] Feature flag in `seed.sql` (defaults to `false`)
- [ ] Migration for production deployment

### Phase 1 (Database)

- [ ] `tracking_goals` table with RLS
- [ ] `goal_templates` table seeded
- [ ] `custom` template requires `min_tier = 'monthly'`
- [ ] Migration tested locally with `npx supabase db reset`

### Phase 2 (Rule Engines)

- [ ] `@uth/rules` package created
- [ ] `UKILRRuleEngine` (refactored from calculators)
- [ ] `DaysCounterRuleEngine`
- [ ] Unit tests passing

### Phase 3 (API)

- [ ] CRUD endpoints for goals
- [ ] Templates endpoint
- [ ] Feature flag checks via `checkFeatureAccess()`
- [ ] Goal limit enforced (1 for free, unlimited for paid)
- [ ] Integration tests passing

### Phase 4 (State & Hydration)

- [ ] `GoalsStore` with MobX
- [ ] `GoalsStore.hydrate()` method for server data
- [ ] `AccessContext` extended with `goals` and `goalCalculations`
- [ ] `loadAccessContext()` loads goals server-side
- [ ] `Providers.tsx` calls `goalsStore.hydrate()`
- [ ] Integration with `travelStore` for reactive recalculation

### Phase 5 (UI with @uth/widgets)

- [ ] `FeatureGate` wraps multi-goal UI with `fallback={<LegacyTravelPage />}`
- [ ] `FeatureButton` for "Add Goal" when free tier limit reached
- [ ] `useFeatureGate()` for `canAddMore` logic
- [ ] `GoalMiniCard` + `GoalMiniCardsRow`
- [ ] `AddGoalModal` wizard (3 steps)
- [ ] `GoalDetailPanel` per goal type
- [ ] `GoalEmptyState`
- [ ] Mobile responsiveness tested
- [ ] Custom goal template hidden for anonymous/free users

### Phase 6 (Rollout)

- [ ] Migration UI for existing users
- [ ] Alpha testing (internal + beta_users)
- [ ] Beta rollout (10%)
- [ ] GA rollout (50% → 100%)

---

## Decisions Made

1. **Storage**: Trips stored in memory/localStorage only. DB storage for premium users is a separate future task.
2. **Anonymous goals**: Anonymous users can only use predefined goal templates (no custom goals).
3. **Goal limits**: **1 goal for free tier, unlimited for paid**.
4. **Archiving vs deletion**: Soft delete - goals are marked as `is_archived = true` (supports undo).
5. **Sharing**: Not in scope for this implementation.
