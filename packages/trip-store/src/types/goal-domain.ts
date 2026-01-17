/**
 * Domain types for tracking goals (business logic layer)
 * These are provider-agnostic and used throughout the application
 *
 * Key differences from DB types:
 * - All dates are ISO strings (serializable, cacheable)
 * - No database-specific fields (e.g., database-generated timestamps)
 * - Business-focused field names and structures
 */

/**
 * Goal type enum - defines the type of tracking goal
 */
export type GoalType =
  | 'uk_ilr' // UK Indefinite Leave to Remain
  | 'uk_citizenship' // UK Citizenship
  | 'uk_tax_residency' // UK Tax Residency
  | 'schengen_90_180' // Schengen 90/180 day rule
  | 'days_counter' // Simple days counter
  | 'custom_threshold'; // Custom threshold-based goal

/**
 * Goal jurisdiction - where the goal applies
 */
export type GoalJurisdiction = 'uk' | 'schengen' | 'global';

/**
 * Tracking goal entity - core business object
 * Represents a user's travel tracking goal
 */
export interface TrackingGoal {
  /** Unique identifier */
  id: string;
  /** User who owns this goal */
  userId: string;
  /** Type of goal */
  type: GoalType;
  /** Jurisdiction where goal applies */
  jurisdiction: GoalJurisdiction;
  /** Human-readable name */
  name: string;
  /** Goal-specific configuration (JSON object) */
  config: Record<string, unknown>;
  /** Optional: Target date for completion (ISO 8601 format: YYYY-MM-DD) */
  targetDate: string | null;
  /** Whether this goal is currently active */
  isActive: boolean;
  /** Whether this goal has been archived */
  isArchived: boolean;
  /** Display order in UI */
  displayOrder: number;
  /** Optional: Color for UI display */
  color: string | null;
  /** When this goal was created (ISO 8601 timestamp) */
  createdAt: string;
  /** When this goal was last updated (ISO 8601 timestamp) */
  updatedAt: string;
}

/**
 * Data required to create a new goal
 * Excludes generated fields (id, userId, timestamps, isArchived)
 */
export interface CreateGoalInput {
  /** Type of goal */
  type: GoalType;
  /** Jurisdiction where goal applies */
  jurisdiction: GoalJurisdiction;
  /** Human-readable name */
  name: string;
  /** Goal-specific configuration (JSON object) */
  config: Record<string, unknown>;
  /** Optional: Target date for completion (ISO 8601 format: YYYY-MM-DD) */
  targetDate?: string | null;
  /** Whether this goal is currently active (defaults to true) */
  isActive?: boolean;
  /** Display order in UI (defaults to 0) */
  displayOrder?: number;
  /** Optional: Color for UI display */
  color?: string | null;
}

/**
 * Data for updating an existing goal
 * All fields optional (partial update)
 * Excludes immutable fields (type, jurisdiction)
 */
export interface UpdateGoalInput {
  /** Human-readable name */
  name?: string;
  /** Goal-specific configuration (JSON object) */
  config?: Record<string, unknown>;
  /** Target date for completion (ISO 8601 format: YYYY-MM-DD) */
  targetDate?: string | null;
  /** Whether this goal is currently active */
  isActive?: boolean;
  /** Whether this goal has been archived */
  isArchived?: boolean;
  /** Display order in UI */
  displayOrder?: number;
  /** Color for UI display */
  color?: string | null;
}
