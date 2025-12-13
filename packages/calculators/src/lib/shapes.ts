export interface TripRecord {
  id: string;
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
export const MAX_ILR_DATE_SEARCH_DAYS = 365; // Maximum days to search forward for valid ILR application date

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
  hasExceeded180Days: boolean;
  ilrEligibilityDate: string | null;
  daysUntilEligible: number | null;
};

export type ILRCalculationInput = {
  trips: TripRecord[];
  vignetteEntryDate: string;
  visaStartDate: string;
  ilrTrack: ILRTrack | null; // 2, 3, or 5 year track
  applicationDate: string; // Date of ILR application for backward counting
};
