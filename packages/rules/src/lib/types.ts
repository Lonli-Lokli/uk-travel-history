/**
 * Core types for multi-goal tracking rule engines
 */

import type {
  TripRecord,
  RollingDataPoint,
  TimelinePoint,
  TripBar,
} from './internal';

// ============================================================================
// Jurisdiction & Goal Types
// ============================================================================

export type Jurisdiction = 'uk' | 'schengen' | 'global';

export type GoalType =
  | 'uk_ilr'
  | 'uk_citizenship'
  | 'uk_tax_residency'
  | 'schengen_90_180'
  | 'days_counter'
  | 'custom_threshold';

export type GoalCategory = 'immigration' | 'tax' | 'personal';

// ============================================================================
// Goal Status
// ============================================================================

export type GoalStatus =
  | 'not_started' // No trips, no progress
  | 'in_progress' // Tracking but not yet eligible
  | 'on_track' // Will meet target at current rate
  | 'at_risk' // May exceed limits soon
  | 'limit_exceeded' // Already broke a limit
  | 'eligible' // Can apply now
  | 'achieved'; // Goal completed

// ============================================================================
// Goal Configuration (Discriminated Union)
// ============================================================================

export type GoalConfig =
  | UKILRConfig
  | UKCitizenshipConfig
  | UKTaxConfig
  | SchengenConfig
  | DaysCounterConfig
  | CustomThresholdConfig;

export interface UKILRConfig {
  type: 'uk_ilr';
  trackYears: 2 | 3 | 5 | 10;
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

// ============================================================================
// Goal Calculation Result
// ============================================================================

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

  // Optional visualization data (for charts/graphs)
  // Populated by rule engines that support visualization (e.g., UK ILR, Schengen)
  visualization?: GoalVisualizationData;
}

export interface GoalVisualizationData {
  rollingAbsenceData?: RollingDataPoint[];
  timelinePoints?: TimelinePoint[];
  tripBars?: TripBar[];
}

// Re-export visualization types for external consumption
export type { RollingDataPoint, TimelinePoint, TripBar };

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
  /** Detailed explanation with concrete dates/numbers (bullet points) */
  details?: string[];
  /** Related trip IDs that are causing this warning */
  relatedTripIds?: string[];
  /** Offending date windows (for rolling limit violations) */
  offendingWindows?: Array<{
    start: string;
    end: string;
    days: number;
  }>;
}

export interface GoalRequirement {
  key: string;
  label: string;
  status: 'met' | 'pending' | 'not_met' | 'unknown';
  detail?: string;
}

// ============================================================================
// Rule Engine Interface
// ============================================================================

export interface RuleEngine<TConfig extends GoalConfig = GoalConfig> {
  readonly goalType: GoalType;
  readonly jurisdiction: Jurisdiction;

  /**
   * Calculate goal progress and metrics
   */
  calculate(
    trips: TripRecord[],
    config: TConfig,
    startDate: Date,
    asOfDate?: Date,
  ): GoalCalculation;

  /**
   * Validate configuration
   */
  validateConfig(config: unknown): config is TConfig;

  /**
   * Get display metadata for UI
   */
  getDisplayInfo(): {
    name: string;
    icon: string;
    description: string;
    category: GoalCategory;
  };
}

// ============================================================================
// Tracking Goal Entity
// ============================================================================

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
