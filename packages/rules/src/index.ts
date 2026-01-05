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
} from './types';

// Registry
export { ruleEngineRegistry } from './registry';

// Engines
export { UKILRRuleEngine, DaysCounterRuleEngine } from './engines';

// Initialize registry with built-in engines
import { ruleEngineRegistry } from './registry';
import { UKILRRuleEngine } from './engines/uk-ilr';
import { DaysCounterRuleEngine } from './engines/days-counter';

// Auto-register built-in engines
ruleEngineRegistry.register(new UKILRRuleEngine());
ruleEngineRegistry.register(new DaysCounterRuleEngine());
