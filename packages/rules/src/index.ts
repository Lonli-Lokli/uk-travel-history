/**
 * @uth/rules - Multi-Goal Tracking Rule Engines
 *
 * This package provides rule engines for different goal types.
 * Each engine calculates progress, metrics, and warnings based on trip data.
 */

// Types
export type {
  Jurisdiction,
  GoalType,
  GoalCategory,
  GoalStatus,
  GoalConfig,
  UKILRConfig,
  UKCitizenshipConfig,
  UKTaxConfig,
  SchengenConfig,
  DaysCounterConfig,
  CustomThresholdConfig,
  GoalCalculation,
  GoalMetric,
  GoalWarning,
  GoalRequirement,
  RuleEngine,
  TrackingGoal,
} from './lib/types';

// Re-export commonly used types from internal module
export type {
  TripRecord,
  TripWithCalculations,
  RollingDataPoint,
  TimelinePoint,
  TripBar,
  ILRTrack,
  TravelCalculationResult,
  ILRSummary,
  PreEntryPeriodInfo,
} from './lib/internal';

// Registry
export { ruleEngineRegistry } from './lib/registry';

// Engines
export { UKILRRuleEngine, DaysCounterRuleEngine } from './lib/engines';

// Initialize registry with built-in engines
import { ruleEngineRegistry } from './lib/registry';
import { UKILRRuleEngine } from './lib/engines/uk-ilr';
import { DaysCounterRuleEngine } from './lib/engines/days-counter';

// Auto-register built-in engines
ruleEngineRegistry.register(new UKILRRuleEngine());
ruleEngineRegistry.register(new DaysCounterRuleEngine());
