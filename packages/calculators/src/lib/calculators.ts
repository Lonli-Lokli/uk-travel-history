import {
  addDays,
  addYears,
  differenceInDays,
  format,
  isBefore,
  isAfter,
  parseISO,
  subDays,
  subYears,
  isWithinInterval,
  areIntervalsOverlapping,
  startOfDay
} from 'date-fns';
import {
  ILRCalculationInput,
  ILRTrack,
  MAX_ABSENCE_IN_12_MONTHS,
  MAX_ALLOWABLE_PRE_ENTRY_DAYS,
  PreEntryPeriodInfo,
  RollingDataPoint,
  TimelinePoint,
  TripBar,
  TripWithCalculations,
  ILRSummary,
  TravelCalculationResult,
  ILRValidationResult,
  OffendingWindow,
  IneligibilityReason,
} from './shapes';
import { calculateTripDurations, hasOverlappingTrips, isValidDate } from './helpers';

// --- CONSTANTS FROM GUIDANCE V8 ---
const TRANSITIONAL_DATE_STR = '2024-04-11';
const MAX_SINGLE_ABSENCE_PRE_APRIL = 184; // For Long Residence pre-2024
const MAX_TOTAL_ABSENCE_PRE_APRIL = 548; // For Long Residence pre-2024 total cap

/**
 * Pure calculator for all ILR-related travel metrics.
 * Strictly adheres to Home Office Guidance v8.0 (July 2025).
 */
export function calculateTravelData(
  input: ILRCalculationInput,
): TravelCalculationResult {
  // 1. Normalize and Calculate Basic Trip Data
  const tripsWithCalculations = calculateTripDurations(input.trips);
  const ilrTrack = input.ilrTrack;

  // 2. Data Integrity Check
  if (tripsWithCalculations.some((t) => t.isIncomplete)) {
    return createErrorResult(
      tripsWithCalculations,
      'INCOMPLETED_TRIPS',
      'There are incomplete trips in the travel history. All trips must have both Out and In dates filled.',
    );
  }

  if (hasOverlappingTrips(tripsWithCalculations)) {
    return createErrorResult(
      tripsWithCalculations,
      'INCORRECT_INPUT',
      'There are overlapping trips in the travel history. All trips must be non-overlapping.',
    );
  }

  // 3. Pre-Entry Period Calculation
  // Guidance: Time between entry clearance (visa start) and arrival counts as lawful residence BUT is an absence.
  const preEntryPeriod = calculatePreEntryPeriod(
    input.visaStartDate,
    input.vignetteEntryDate,
  );

  // 4. Validate Input Dates Logic
  // Visa Start cannot be after Vignette Entry (logical impossibility)
  if (
    input.visaStartDate &&
    input.vignetteEntryDate &&
    isAfter(parseISO(input.visaStartDate), parseISO(input.vignetteEntryDate))
  ) {
    return createErrorResult(
      tripsWithCalculations,
      'INCORRECT_INPUT',
      'Visa Start Date cannot be after Vignette Entry Date.',
    );
  }

  // 5. Establish Legal Earliest Date (Base Calculation)
  // ILR eligibility is strictly based on the Qualifying Period.
  // Earliest application is 28 days before the completion of the Qualifying Period.
  const legalEarliestDateStr = calculateLegalEarliestDate({
    ilrTrack,
    preEntryPeriod,
    vignetteEntryDate: input.vignetteEntryDate,
    visaStartDate: input.visaStartDate,
  });

  // 6. Determine Effective Assessment Date
  // If override provided, we validate THAT date. If not, we search for the earliest valid date.
  let effectiveApplicationDate: string | null = null;
  let validation: ILRValidationResult;

  if (input.applicationDateOverride) {
    effectiveApplicationDate = input.applicationDateOverride;
    validation = validateEligibility({
      ...input,
      trips: tripsWithCalculations,
      preEntryPeriod,
      assessmentDateStr: effectiveApplicationDate,
      legalEarliestDateStr,
    });
  } else {
    // Search logic: Find the first date starting from legalEarliestDate that satisfies all absence rules.
    effectiveApplicationDate = calculateEarliestCompliantDate({
      ...input,
      trips: tripsWithCalculations,
      preEntryPeriod,
      startSearchDateStr: legalEarliestDateStr,
    });

    validation = validateEligibility({
      ...input,
      trips: tripsWithCalculations,
      preEntryPeriod,
      assessmentDateStr: effectiveApplicationDate,
      legalEarliestDateStr,
    });
  }

  // 7. Generate Auxiliary Data (UI Visuals)
  const summary = buildSummary({
    tripsWithCalculations,
    preEntryPeriod,
    validation,
    effectiveApplicationDate,
    ilrTrack,
    vignetteEntryDate: input.vignetteEntryDate,
    visaStartDate: input.visaStartDate,
    autoDateUsed: !input.applicationDateOverride,
  });

  const rollingAbsenceData = buildRollingAbsenceData({
    tripsWithCalculations,
    preEntryPeriod,
    vignetteEntryDate: input.vignetteEntryDate,
    visaStartDate: input.visaStartDate,
  });

  const timelinePoints = buildTimelinePoints({
    tripsWithCalculations,
    vignetteEntryDate: input.vignetteEntryDate,
    visaStartDate: input.visaStartDate,
  });

  const tripBars = buildTripBars({
    tripsWithCalculations,
    vignetteEntryDate: input.vignetteEntryDate,
    visaStartDate: input.visaStartDate,
  });

  return {
    tripsWithCalculations,
    preEntryPeriod,
    validation,
    summary,
    rollingAbsenceData,
    timelinePoints,
    tripBars,
  };
}

// --- CORE VALIDATION LOGIC ---

/**
 * Validates eligibility for a specific assessment date.
 * Enforces:
 * 1. 28-day rule (TOO_EARLY).
 * 2. Track-specific absence rules (Standard vs Long Residence Transitional).
 */
function validateEligibility(params: {
  trips: TripWithCalculations[];
  preEntryPeriod: PreEntryPeriodInfo | null;
  ilrTrack: ILRTrack;
  assessmentDateStr: string;
  legalEarliestDateStr: string;
  visaStartDate: string;
  vignetteEntryDate: string;
  applicationDateOverride: string | null;
}): ILRValidationResult {
  const {
    trips,
    preEntryPeriod,
    ilrTrack,
    assessmentDateStr,
    legalEarliestDateStr,
    visaStartDate,
    vignetteEntryDate,
  } = params;

  const assessmentDate = parseISO(assessmentDateStr);
  const legalDate = parseISO(legalEarliestDateStr);

  // Check 1: Is it too early?
  if (isBefore(assessmentDate, legalDate)) {
    return {
      status: 'INELIGIBLE',
      reason: {
        type: 'TOO_EARLY',
        message: `The application date is too early. You can apply 28 days before the ${ilrTrack} year anniversary, which is ${format(legalDate, 'dd MMMM yyyy')}.`,
        earliestAllowedDate: format(legalDate, 'yyyy-MM-dd'),
      },
    };
  }

  // Determine Qualifying Period [End - Track Years, End]
  // Guidance: We count backwards from the assessment date.
  // Use startOfDay on both dates to ensure consistent timezone handling
  const qualifyingEndDate = startOfDay(assessmentDate);
  const qualifyingStartDate = startOfDay(
    addYears(qualifyingEndDate, -ilrTrack),
  );

  // Check 2: Absence Rules
  const absenceCheck = checkAbsences({
    trips,
    preEntryPeriod,
    ilrTrack,
    qualifyingStartDate,
    qualifyingEndDate,
    visaStartDate,
    vignetteEntryDate,
  });

  if (!absenceCheck.passed) {
    return {
      status: 'INELIGIBLE',
      reason: {
        type: 'EXCESSIVE_ABSENCE',
        message: absenceCheck.reason || 'Absence limit exceeded.',
        offendingWindows: absenceCheck.offendingWindows,
      },
    };
  }

  return {
    status: 'ELIGIBLE',
    applicationDate: assessmentDateStr,
  };
}

/**
 * Searches for the first compliant date starting from the legal minimum.
 * Optimizes by checking daily steps (robustness over complex jump logic).
 */
function calculateEarliestCompliantDate(params: {
  trips: TripWithCalculations[];
  preEntryPeriod: PreEntryPeriodInfo | null;
  ilrTrack: ILRTrack;
  startSearchDateStr: string;
  visaStartDate: string;
  vignetteEntryDate: string;
  applicationDateOverride: string | null;
}): string {
  const { startSearchDateStr, ilrTrack } = params;
  let candidateDate = parseISO(startSearchDateStr);

  // Define a reasonable search horizon (e.g., 2 years into the future) to prevent infinite loops
  // If a user has massive absences, they might strictly qualify in 10 years, not 5.
  const maxSearchDays = 365 * 2;

  for (let i = 0; i < maxSearchDays; i++) {
    const qualifyingEndDate = candidateDate;
    const qualifyingStartDate = startOfDay(
      addYears(qualifyingEndDate, -ilrTrack),
    );

    const check = checkAbsences({
      ...params,
      qualifyingStartDate,
      qualifyingEndDate,
    });

    if (check.passed) {
      return format(candidateDate, 'yyyy-MM-dd');
    }

    candidateDate = addDays(candidateDate, 1);
  }

  // Fallback if no date found within horizon (highly unlikely unless huge continuous absences)
  return format(candidateDate, 'yyyy-MM-dd');
}

// --- ABSENCE CALCULATION ENGINE ---

interface AbsenceCheckResult {
  passed: boolean;
  reason?: string;
  offendingWindows: OffendingWindow[];
}

/**
 * The core engine that routes logic between Standard Rules (3/5y) and Transitional Rules (10y).
 * Strictly follows v8.0 Guidance.
 */
function checkAbsences(params: {
  trips: TripWithCalculations[];
  preEntryPeriod: PreEntryPeriodInfo | null;
  ilrTrack: ILRTrack;
  qualifyingStartDate: Date;
  qualifyingEndDate: Date;
  visaStartDate: string;
  vignetteEntryDate: string;
}): AbsenceCheckResult {
  const {
    trips,
    preEntryPeriod,
    ilrTrack,
    qualifyingStartDate,
    qualifyingEndDate,
    visaStartDate,
    vignetteEntryDate,
  } = params;

  // 1. Build a unified list of "Absence Intervals"
  // Each interval has { start, end, days }.
  // This abstracts away "Trips" vs "Pre-Entry Gap".
  const absenceIntervals = buildAbsenceIntervals(
    trips,
    preEntryPeriod,
    visaStartDate,
    vignetteEntryDate,
  );

  // 2. Filter intervals to those overlapping the Qualifying Period
  const relevantAbsences = absenceIntervals.filter((abs) =>
    areIntervalsOverlapping(
      { start: abs.start, end: abs.end },
      { start: qualifyingStartDate, end: qualifyingEndDate },
    ),
  );

  // --- LOGIC BRANCH: LONG RESIDENCE (10 YEAR) ---
  if (ilrTrack === 10) {
    return checkLongResidenceAbsences(
      relevantAbsences,
      qualifyingStartDate,
      qualifyingEndDate,
    );
  }

  // --- LOGIC BRANCH: STANDARD (3/5 YEAR) ---
  return checkStandardRollingAbsences(
    relevantAbsences,
    qualifyingStartDate,
    qualifyingEndDate,
  );
}

/**
 * Handles Long Residence Transitional Rules (Guidance v8).
 * - Pre-11 April 2024: Max 184 days single trip, Max 548 days total.
 * - Post-11 April 2024: Max 180 days rolling 12-month.
 */
function checkLongResidenceAbsences(
  absences: { start: Date; end: Date; days: number }[],
  qualifyingStartDate: Date,
  qualifyingEndDate: Date,
): AbsenceCheckResult {
  const transitionalDate = parseISO(TRANSITIONAL_DATE_STR);
  let preAprilTotalDays = 0;
  const offendingWindows: OffendingWindow[] = [];

  for (const abs of absences) {
    // Determine if absence started before 11 April 2024
    // Guidance: "where the absence started before 11 April 2024"
    if (isBefore(abs.start, transitionalDate)) {
      // RULE 1: Single limit 184 days
      if (abs.days > MAX_SINGLE_ABSENCE_PRE_APRIL) {
        offendingWindows.push({
          start: format(abs.start, 'yyyy-MM-dd'),
          end: format(abs.end, 'yyyy-MM-dd'),
          days: abs.days,
        });
        return {
          passed: false,
          reason: `A single absence starting before 11 April 2024 exceeds ${MAX_SINGLE_ABSENCE_PRE_APRIL} days.`,
          offendingWindows,
        };
      }

      // RULE 2: Accumulate Pre-April Total
      // Guidance: "total of 548 days... in any part of their qualifying period before 11 April 2024"
      // We count the days of this absence that strictly fall BEFORE transitional date AND inside qualifying period.
      const overlapStart =
        abs.start < qualifyingStartDate ? qualifyingStartDate : abs.start;
      const overlapEnd =
        abs.end > transitionalDate ? subDays(transitionalDate, 1) : abs.end; // Up to April 10

      if (overlapStart <= overlapEnd) {
        preAprilTotalDays += differenceInDays(overlapEnd, overlapStart) + 1;
      }
    } else {
      // Started ON or AFTER 11 April 2024 -> falls into Rolling check later.
      // We don't check single limit here, we check rolling below.
    }
  }

  // Check Total Limit (Pre-April)
  if (preAprilTotalDays > MAX_TOTAL_ABSENCE_PRE_APRIL) {
    return {
      passed: false,
      reason: `Total absences in the qualifying period before 11 April 2024 exceed ${MAX_TOTAL_ABSENCE_PRE_APRIL} days.`,
      offendingWindows: [
        {
          start: format(qualifyingStartDate, 'yyyy-MM-dd'),
          end: TRANSITIONAL_DATE_STR,
          days: preAprilTotalDays,
        },
      ],
    };
  }

  // RULE 3: Rolling 180 days (Only for absences starting ON/AFTER 11 April 2024)
  // Guidance: "from 11 April 2024... not outside UK for more than 180 days in any 12-month period"
  // Implementation: We run the rolling checker, but we only flag windows where the absence contributing to the excess
  // actually falls into the post-April period.
  // Actually, simpler interpretation: The rule applies to the PERIOD starting 11 April.
  // We run the rolling check bounded by [Transitional Date, Qualifying End].

  // Check rolling absences only for the window [11 April 2024 -> End]
  // Note: An absence starting after April 11 counts. An absence straddling April 11 (started before)
  // counts towards Pre-April rules (single limit), NOT rolling limit?
  // Guidance p.29 Ex 2: "The absence from 1 August 2024... did not exceed... 180 days in any 12-month rolling... earliest rolling period is from 1 August 2024".
  // This implies rolling windows only start checking from the first absence starting after the date.

  // We filter absences to those starting >= 11 April 2024
  const postAprilAbsences = absences.filter(
    (a) => !isBefore(a.start, transitionalDate),
  );

  if (postAprilAbsences.length > 0) {
    const rollingCheck = checkRollingAbsences(
      postAprilAbsences,
      transitionalDate, // Start checking rolling windows from here
      qualifyingEndDate,
    );
    if (!rollingCheck.passed) return rollingCheck;
  }

  return { passed: true, offendingWindows: [] };
}

/**
 * Handles Standard 3/5 Year Routes.
 * - Simple Rolling 180-day limit across the ENTIRE qualifying period.
 */
function checkStandardRollingAbsences(
  absences: { start: Date; end: Date; days: number }[],
  qualifyingStartDate: Date,
  qualifyingEndDate: Date,
): AbsenceCheckResult {
  return checkRollingAbsences(absences, qualifyingStartDate, qualifyingEndDate);
}

/**
 * Generic Rolling 12-month Checker.
 * Checks if any 12-month window within [periodStart, periodEnd] exceeds 180 days.
 * Efficient algorithm: Identify critical points (trip ends) and check windows ending there.
 */
function checkRollingAbsences(
  absences: { start: Date; end: Date; days: number }[],
  periodStart: Date,
  periodEnd: Date,
): AbsenceCheckResult {
  const offendingWindows: OffendingWindow[] = [];

  // Optimization: Only check windows ending on:
  // 1. An absence end date (most likely point to breach limit)
  // 2. The period end date
  // 3. Every day? (Safe but slow).
  // Given the complexity of "rolling", checking every day is safest and acceptable for client-side (365*5 = ~1800 checks).
  // Optimization: Check only days where an absence exists in the preceding 12 months.

  // We scan daily from periodStart to periodEnd.
  // To verify strict compliance, we should check *every* day in the qualifying period.
  const totalDays = differenceInDays(periodEnd, periodStart);

  // Heuristic: If total absences are small, skip.
  const totalAbs = absences.reduce((sum, a) => sum + a.days, 0);
  if (totalAbs <= 180) return { passed: true, offendingWindows: [] };

  // Helper to count days in [winStart, winEnd]
  const countDaysInWindow = (winStart: Date, winEnd: Date) => {
    let sum = 0;
    for (const abs of absences) {
      // Intersect (abs.start, abs.end) with (winStart, winEnd)
      const interStart = abs.start < winStart ? winStart : abs.start;
      const interEnd = abs.end > winEnd ? winEnd : abs.end;
      if (interStart <= interEnd) {
        sum += differenceInDays(interEnd, interStart) + 1;
      }
    }
    return sum;
  };

  // Iterate daily - check every rolling 12-month window
  // A rolling 12-month window means 12 calendar months (NOT 365 days, due to leap years).
  // We check all windows that START within the period and span 12 months.
  // The last valid window starts at max(periodStart, periodEnd - 12 months) and ends at periodEnd.

  // If the period is shorter than 12 months, we can't check full rolling windows,
  // but we should still check if any single absence exceeds 180 days
  if (totalDays < 365) {
    for (const abs of absences) {
      if (abs.days > MAX_ABSENCE_IN_12_MONTHS) {
        offendingWindows.push({
          start: format(abs.start, 'yyyy-MM-dd'),
          end: format(abs.end, 'yyyy-MM-dd'),
          days: abs.days,
        });
        return {
          passed: false,
          reason: 'Single absence exceeds 180 days.',
          offendingWindows,
        };
      }
    }
    return { passed: true, offendingWindows: [] };
  }

  // Calculate the last day we can start a 12-month window that fits within the period
  const latestWindowStart = subYears(periodEnd, 1);
  const effectiveLatestStart = latestWindowStart < periodStart ? periodStart : latestWindowStart;
  const maxStartOffset = differenceInDays(effectiveLatestStart, periodStart);

  for (let i = 0; i <= maxStartOffset; i++) {
    const windowStart = addDays(periodStart, i);
    const windowEnd = addYears(windowStart, 1);

    const daysCount = countDaysInWindow(windowStart, windowEnd);
    if (daysCount > MAX_ABSENCE_IN_12_MONTHS) {
      offendingWindows.push({
        start: format(windowStart, 'yyyy-MM-dd'),
        end: format(windowEnd, 'yyyy-MM-dd'),
        days: daysCount,
      });
      return {
        passed: false,
        reason: 'Rolling 12-month absence limit exceeded.',
        offendingWindows,
      };
    }
  }

  return { passed: true, offendingWindows: [] };
}

/**
 * Converts Trips and Pre-Entry info into a normalized list of {start, end, days} objects.
 */
function buildAbsenceIntervals(
  trips: TripWithCalculations[],
  preEntry: PreEntryPeriodInfo | null,
  visaStartDate: string,
  vignetteEntryDate: string,
): { start: Date; end: Date; days: number }[] {
  const intervals: { start: Date; end: Date; days: number }[] = [];

  // 1. Pre-Entry Gap (if strictly valid and exists)
  // Logic: Time between Visa Start and Entry is an absence.
  // Per Home Office guidance on "full days": exclude both boundary dates (visa start and vignette entry)
  // This is consistent with how trip absences are calculated (excluding departure and return days).
  if (
    preEntry &&
    preEntry.delayDays > 0 &&
    visaStartDate &&
    vignetteEntryDate
  ) {
    // Per Home Office guidance: The visa start date is an absence day (person not yet present),
    // but the vignette entry date is a presence day (person has arrived).
    // Example: If visa starts Jan 1 and you enter Jan 5:
    // - Jan 1 (visa start): IS an absence day (not physically present yet)
    // - Jan 2, 3, 4: Full absence days
    // - Jan 5 (entry): IS a presence day (has arrived in UK)
    // So absence period is Jan 1 to Jan 4.
    const start = parseISO(visaStartDate);  // INCLUDES visa start (absence day)
    const end = subDays(parseISO(vignetteEntryDate), 1);  // Day BEFORE entry (presence day)
    if (start <= end) {
      intervals.push({
        start,
        end,
        days: differenceInDays(end, start) + 1,
      });
    }
  }

  // 2. Trips
  // Logic: Departure and Return are PRESENT. Absence is days BETWEEN.
  trips
    .filter((t) => !t.isIncomplete)
    .forEach((t) => {
      const outDate = parseISO(t.outDate);
      const inDate = parseISO(t.inDate);
      const absStart = addDays(outDate, 1);
      const absEnd = subDays(inDate, 1);

      if (absStart <= absEnd) {
        intervals.push({
          start: absStart,
          end: absEnd,
          days: differenceInDays(absEnd, absStart) + 1,
        });
      }
    });

  return intervals.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// --- HELPER FUNCTIONS ---

function calculatePreEntryPeriod(
  visaStartDate: string,
  vignetteEntryDate: string,
): PreEntryPeriodInfo | null {
  if (!visaStartDate || !vignetteEntryDate) return null;
  if (!isValidDate(visaStartDate) || !isValidDate(vignetteEntryDate))
    return null;

  const start = parseISO(visaStartDate);
  const entry = parseISO(vignetteEntryDate);

  const delayDays = differenceInDays(entry, start);
  if (delayDays < 0) return null; // Error case handled elsewhere or ignored

  // Guidance: Pre-entry period counts towards qualifying period (lawful residence)
  // BUT counts as an absence.
  // Generally, if delay > 180 (or 90 for old rules), it might break continuity,
  // but here we just flag if it CAN count.
  const canCount = delayDays <= MAX_ALLOWABLE_PRE_ENTRY_DAYS; // 180 days usually
  const qualifyingStartDate = visaStartDate; // Always starts on Visa Start if lawful

  return {
    hasPreEntry: delayDays > 0,
    delayDays,
    canCount,
    qualifyingStartDate: format(start, 'yyyy-MM-dd'),
  };
}

function calculateLegalEarliestDate(params: {
  ilrTrack: ILRTrack;
  preEntryPeriod: PreEntryPeriodInfo | null;
  vignetteEntryDate: string;
  visaStartDate: string;
}): string {
  const { ilrTrack, vignetteEntryDate, visaStartDate } = params;

  // Determining the "Start of Qualifying Period"
  // Usually Visa Start Date (if pre-entry gap is allowed/lawful).
  let startStr = visaStartDate;

  // If pre-entry gap is too huge (e.g. > 180 days), continuity might be broken at start,
  // forcing the clock to start at Entry. But typically, the app assumes valid visa.
  // We stick to Visa Start as the legal start of the period.
  if (!startStr && vignetteEntryDate) startStr = vignetteEntryDate;
  if (!startStr) return format(new Date(), 'yyyy-MM-dd');

  const start = parseISO(startStr);
  const completionDate = addYears(start, ilrTrack);
  const earliestDate = subDays(completionDate, 28);

  return format(earliestDate, 'yyyy-MM-dd');
}

function createErrorResult(
  trips: TripWithCalculations[],
  type: IneligibilityReason['type'],
  message: string,
): TravelCalculationResult {
  return {
    tripsWithCalculations: trips,
    preEntryPeriod: null,
    validation: { status: 'INELIGIBLE', reason: { type, message } },
    summary: {} as ILRSummary,
    rollingAbsenceData: [],
    timelinePoints: [],
    tripBars: [],
  } as TravelCalculationResult;
}

// --- UI DATA BUILDERS (Summary, Rolling Data, Bars) ---

function buildSummary(params: {
  tripsWithCalculations: TripWithCalculations[];
  preEntryPeriod: PreEntryPeriodInfo | null;
  vignetteEntryDate: string;
  visaStartDate: string;
  ilrTrack: ILRTrack;
  effectiveApplicationDate: string | null;
  validation: ILRValidationResult;
  autoDateUsed: boolean;
}): ILRSummary {
  const {
    tripsWithCalculations,
    effectiveApplicationDate,
    validation,
    preEntryPeriod,
    visaStartDate,
    vignetteEntryDate,
    ilrTrack,
  } = params;
  const complete = tripsWithCalculations.filter((t) => !t.isIncomplete);

  // Total Days logic
  const tripDays = complete.reduce((sum, t) => sum + (t.fullDays || 0), 0);
  const preEntryDays = preEntryPeriod?.delayDays || 0;
  const totalFullDays = tripDays + preEntryDays; // Rough total, not strict windowed

  // Calculate Max Rolling Absence (just for display/risk context)
  // We use the same rolling checker but over the entire possible history for visualization
  // This helps user see "danger zones" even if they passed validation
  let maxAbsenceInAny12Months = 0;

  if (effectiveApplicationDate && visaStartDate) {
    const end = parseISO(effectiveApplicationDate);
    const start = parseISO(visaStartDate);
    const intervals = buildAbsenceIntervals(
      tripsWithCalculations,
      preEntryPeriod,
      visaStartDate,
      vignetteEntryDate,
    );

    // Quick scan of max rolling
    const days = differenceInDays(end, start);
    if (days > 0 && days < 5000) {
      for (let i = 365; i <= days; i += 30) {
        // Sampling for speed in summary
        const d = addDays(start, i);
        const winStart = subDays(d, 365);
        // simple count
        let sum = 0;
        intervals.forEach((abc) => {
          const is = abc.start < winStart ? winStart : abc.start;
          const ie = abc.end > d ? d : abc.end;
          if (is <= ie) sum += differenceInDays(ie, is) + 1;
        });
        if (sum > maxAbsenceInAny12Months) maxAbsenceInAny12Months = sum;
      }
    }
  }

  const maxAllowedAbsense = ilrTrack === 10 ? MAX_SINGLE_ABSENCE_PRE_APRIL : MAX_ABSENCE_IN_12_MONTHS;
  const hasExceededAllowedAbsense = maxAbsenceInAny12Months > maxAllowedAbsense;

  // Continuous Leave Days
  // (Total Period Days) - (Total Absences in Period)
  let continuousLeaveDays: number | null = null;
  let daysUntilEligible: number | null = null;

  if (validation.status === 'ELIGIBLE' && effectiveApplicationDate) {
    const appDate = parseISO(effectiveApplicationDate);
    const start = startOfDay(addYears(appDate, -ilrTrack));
    const totalPeriod = differenceInDays(appDate, start) + 1;

    // Count exact absences in this window
    const intervals = buildAbsenceIntervals(
      tripsWithCalculations,
      preEntryPeriod,
      visaStartDate,
      vignetteEntryDate,
    );
    let absInPeriod = 0;
    intervals.forEach((abc) => {
      const is = abc.start < start ? start : abc.start;
      const ie = abc.end > appDate ? appDate : abc.end;
      if (is <= ie) absInPeriod += differenceInDays(ie, is) + 1;
    });

    continuousLeaveDays = totalPeriod - absInPeriod;
    daysUntilEligible = differenceInDays(appDate, new Date());
  }

  return {
    totalTrips: tripsWithCalculations.length,
    completeTrips: complete.length,
    incompleteTrips: tripsWithCalculations.length - complete.length,
    totalFullDays,
    continuousLeaveDays,
    maxAbsenceInAny12Months,
    hasExceededAllowedAbsense,
    ilrEligibilityDate: effectiveApplicationDate,
    daysUntilEligible,
    autoDateUsed: params.autoDateUsed,
  };
}

function buildRollingAbsenceData(params: {
  tripsWithCalculations: TripWithCalculations[];
  preEntryPeriod: PreEntryPeriodInfo | null;
  vignetteEntryDate: string;
  visaStartDate: string;
}): RollingDataPoint[] {
  const {
    tripsWithCalculations,
    preEntryPeriod,
    visaStartDate,
    vignetteEntryDate,
  } = params;
  const startStr = visaStartDate || vignetteEntryDate;
  if (!startStr) return [];

  const start = parseISO(startStr);
  const end = new Date(); // Show up to today
  const totalDays = differenceInDays(end, start);

  if (totalDays < 0 || totalDays > 4000) return []; // Safety

  const intervals = buildAbsenceIntervals(
    tripsWithCalculations,
    preEntryPeriod,
    visaStartDate,
    vignetteEntryDate,
  );
  const points: RollingDataPoint[] = [];
  const step = Math.max(1, Math.floor(totalDays / 100)); // ~100 points

  for (let i = 0; i <= totalDays; i += step) {
    const current = addDays(start, i);
    const windowStart = subDays(current, 365);

    // Calculate rolling absence ending on `current`
    let sum = 0;
    intervals.forEach((abc) => {
      const is = abc.start < windowStart ? windowStart : abc.start;
      const ie = abc.end > current ? current : abc.end;
      if (is <= ie) sum += differenceInDays(ie, is) + 1;
    });

    points.push({
      date: current.toISOString(),
      rollingDays: sum,
      riskLevel: sum > 180 ? 'critical' : sum >= 150 ? 'caution' : 'low',
      formattedDate: format(current, 'dd/MM/yyyy'),
    });
  }
  return points;
}

function buildTimelinePoints(params: {
  tripsWithCalculations: TripWithCalculations[];
  vignetteEntryDate: string;
  visaStartDate: string;
}): TimelinePoint[] {
  const { tripsWithCalculations, visaStartDate } = params;
  if (!visaStartDate) return [];
  const start = parseISO(visaStartDate);
  const end = new Date();
  const totalDays = differenceInDays(end, start);
  if (totalDays < 0 || totalDays > 4000) return [];

  // Map trips to simple check
  const activeTrips = tripsWithCalculations
    .filter((t) => !t.isIncomplete)
    .map((t) => ({ start: parseISO(t.outDate), end: parseISO(t.inDate) }));

  const points: TimelinePoint[] = [];
  // For timeline, we might not need every single day if it's too heavy,
  // but originally it loops every day. Let's keep it but optimize loop.
  // Actually, UI usually needs sparse data or simplified.
  // We'll return empty if too large or just limits.
  // Let's stick to original logic but ensure efficiency.

  for (let i = 0; i <= totalDays; i++) {
    const d = addDays(start, i);
    const count = activeTrips.filter((t) =>
      isWithinInterval(d, { start: t.start, end: t.end }),
    ).length;
    points.push({
      date: format(d, 'yyyy-MM-dd'),
      daysSinceStart: i,
      tripCount: count,
      formattedDate: format(d, 'dd/MM/yyyy'),
    });
  }
  return points;
}

function buildTripBars(params: {
  tripsWithCalculations: TripWithCalculations[];
  vignetteEntryDate: string;
  visaStartDate: string;
}): TripBar[] {
  const { tripsWithCalculations, visaStartDate } = params;
  if (!visaStartDate) return [];
  const start = parseISO(visaStartDate);

  return tripsWithCalculations
    .filter((t) => !t.isIncomplete)
    .map((t) => {
      const out = parseISO(t.outDate);
      const ind = parseISO(t.inDate);
      return {
        date: t.outDate,
        tripStart: differenceInDays(out, start),
        tripEnd: differenceInDays(ind, start),
        tripDuration: t.fullDays || 0,
        tripLabel: t.outRoute || 'Trip',
        formattedDate: format(out, 'dd/MM/yyyy'),
        outDate: t.outDate,
        inDate: t.inDate,
      };
    });
}
