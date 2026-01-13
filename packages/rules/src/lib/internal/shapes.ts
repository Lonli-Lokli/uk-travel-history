export interface TripRecord {
  id: string;
  title?: string;
  outDate: string;
  inDate: string;
  outRoute: string;
  inRoute: string;
}

export interface TripWithCalculations extends TripRecord {
  calendarDays: number | null;
  fullDays: number | null;
  isIncomplete: boolean;
}

export interface RollingDataPoint {
  date: string;
  rollingDays: number;
  riskLevel: 'low' | 'caution' | 'critical';
  formattedDate: string;
  /**
   * ISO date when the oldest absence in the current rolling 12-month window will expire (365 days from its start).
   * At this point, that absence will no longer be counted in the rolling window.
   * Null if no absences are contributing to this data point.
   */
  nextExpirationDate: string | null;
  /**
   * Number of absence days that will be freed up when the oldest trip expires.
   * This represents the clipped days from the oldest interval within the current rolling window.
   * Null if no absences are contributing to this data point.
   */
  daysToExpire: number | null;
}

export interface TimelinePoint {
  date: string;
  daysSinceStart: number;
  tripCount: number;
  formattedDate: string;
}

export interface TripBar {
  date: string;
  tripStart: number;
  tripEnd: number;
  tripDuration: number;
  tripLabel: string;
  formattedDate: string;
  outDate: string;
  inDate: string;
}

export type ILRTrack = 2 | 3 | 5 | 10;

// Constants for UK Home Office guidance
export const MAX_ALLOWABLE_PRE_ENTRY_DAYS = 180; // Maximum days between visa issue and UK entry that can count toward qualifying period
export const MAX_ABSENCE_IN_12_MONTHS = 180; // Maximum days allowed outside UK in any rolling 12-month period

// Interface for pre-entry period information
export interface PreEntryPeriodInfo {
  hasPreEntry: boolean;
  delayDays: number;
  canCount: boolean;
  qualifyingStartDate: string | null;
}

export type ILRSummary = {
  totalTrips: number;
  completeTrips: number;
  incompleteTrips: number;
  totalFullDays: number;
  continuousLeaveDays: number | null;
  maxAbsenceInAny12Months: number | null;
  hasExceededAllowedAbsense: boolean;
  ilrEligibilityDate: string | null;
  daysUntilEligible: number | null;
  autoDateUsed: boolean;
  currentRollingAbsenceToday: number | null; // Absence days in 12-month period ending today
  remaining180LimitToday: number | null; // 180 - currentRollingAbsenceToday
};

export type ILRCalculationInput = {
  trips: TripRecord[];
  vignetteEntryDate: string;
  visaStartDate: string;
  ilrTrack: ILRTrack; // 2, 3, or 5 year track
  applicationDateOverride: string | null; // Date of ILR application for backward counting
};

export interface OffendingWindow {
  start: string;
  end: string;
  days: number; // Absence days in this 12-month period
}

type LegitableILRValidationResult = {
  status: 'ELIGIBLE';
  applicationDate: string;
};

type IneligibleILRValidationResult = {
  status: 'INELIGIBLE';
  reason: IneligibilityReason;
};
export type IneligibilityReason =
  | { type: 'TOO_EARLY'; message: string; earliestAllowedDate: string }
  | { type: 'INCORRECT_INPUT'; message: string }
  | { type: 'INCOMPLETED_TRIPS'; message: string }
  | {
      type: 'EXCESSIVE_ABSENCE';
      message: string;
      offendingWindows: OffendingWindow[];
    };
export type ILRValidationResult =
  | LegitableILRValidationResult
  | IneligibleILRValidationResult;

export type TravelCalculationResult = {
  // Core Data
  tripsWithCalculations: TripWithCalculations[];
  preEntryPeriod: PreEntryPeriodInfo | null;
  // Validation Result
  validation: ILRValidationResult;
  // Summary & UI Data
  summary: ILRSummary;
  rollingAbsenceData: RollingDataPoint[];
  timelinePoints: TimelinePoint[];
  tripBars: TripBar[];
};
