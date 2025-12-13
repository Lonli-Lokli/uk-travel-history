import {
  addDays,
  addYears,
  differenceInDays,
  format,
  parseISO,
  subDays,
} from 'date-fns';
import {
  ILRCalculationInput,
  ILRTrack,
  MAX_ABSENCE_IN_12_MONTHS,
  MAX_ALLOWABLE_PRE_ENTRY_DAYS,
  MAX_ILR_DATE_SEARCH_DAYS,
  PreEntryPeriodInfo,
  RollingDataPoint,
  TimelinePoint,
  TripBar,
  TripRecord,
  TripWithCalculations,
  ILRSummary,
} from './shapes';

export type TravelCalculationResult = {
  tripsWithCalculations: TripWithCalculations[];
  preEntryPeriod: PreEntryPeriodInfo | null;
  calculatedApplicationDate: string | null;
  effectiveApplicationDate: string | null;
  summary: ILRSummary;
  rollingAbsenceData: RollingDataPoint[];
  timelinePoints: TimelinePoint[];
  tripBars: TripBar[];
};

/**
 * Pure calculator for all ILR-related travel metrics.
 * Accepts raw input and returns every derived value used by the UI layer.
 */
export function calculateTravelData(
  input: ILRCalculationInput,
): TravelCalculationResult {
  const tripsWithCalculations = calculateTripDurations(input.trips);

  const preEntryPeriod = calculatePreEntryPeriod(
    input.visaStartDate,
    input.vignetteEntryDate,
  );

  const calculatedApplicationDate = calculateApplicationDate({
    ilrTrack: input.ilrTrack,
    preEntryPeriod,
    vignetteEntryDate: input.vignetteEntryDate,
    visaStartDate: input.visaStartDate,
    trips: tripsWithCalculations,
  });

  const effectiveApplicationDate = input.applicationDate
    ? input.applicationDate
    : calculatedApplicationDate;

  const summary = buildSummary({
    tripsWithCalculations,
    preEntryPeriod,
    vignetteEntryDate: input.vignetteEntryDate,
    visaStartDate: input.visaStartDate,
    ilrTrack: input.ilrTrack,
    effectiveApplicationDate,
    applicationDate: input.applicationDate,
  });

  const rollingAbsenceData = buildRollingAbsenceData({
    tripsWithCalculations,
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
    calculatedApplicationDate,
    effectiveApplicationDate,
    summary,
    rollingAbsenceData,
    timelinePoints,
    tripBars,
  };
}

function calculateTripDurations(trips: TripRecord[]): TripWithCalculations[] {
  return trips.map((trip) => {
    const outDate = trip.outDate ? new Date(trip.outDate) : null;
    const inDate = trip.inDate ? new Date(trip.inDate) : null;
    const isIncomplete =
      !outDate ||
      !inDate ||
      isNaN(outDate.getTime()) ||
      isNaN(inDate.getTime());

    let calendarDays: number | null = null;
    let fullDays: number | null = null;

    if (outDate && inDate && !isIncomplete) {
      calendarDays = differenceInDays(inDate, outDate);
      fullDays = Math.max(0, calendarDays - 1);
    }

    return {
      ...trip,
      calendarDays,
      fullDays,
      isIncomplete,
    };
  });
}

function calculatePreEntryPeriod(
  visaStartDate: string,
  vignetteEntryDate: string,
): PreEntryPeriodInfo | null {
  if (!visaStartDate || !vignetteEntryDate) {
    return null;
  }

  const visaStart = new Date(visaStartDate);
  const vignetteEntry = new Date(vignetteEntryDate);

  if (isNaN(visaStart.getTime()) || isNaN(vignetteEntry.getTime())) {
    return null;
  }

  const delayDays = differenceInDays(vignetteEntry, visaStart);
  if (delayDays < 0) {
    return null;
  }

  const canCount = delayDays <= MAX_ALLOWABLE_PRE_ENTRY_DAYS;
  const qualifyingStartDate = canCount ? visaStartDate : vignetteEntryDate;

  return {
    hasPreEntry: true,
    delayDays,
    canCount,
    qualifyingStartDate,
  };
}

function calculateApplicationDate(params: {
  ilrTrack: ILRTrack | null;
  preEntryPeriod: PreEntryPeriodInfo | null;
  vignetteEntryDate: string;
  visaStartDate: string;
  trips: TripWithCalculations[];
}): string | null {
  const { ilrTrack, preEntryPeriod, vignetteEntryDate, visaStartDate, trips } =
    params;
  if (!ilrTrack) return null;

  let qualifyingStart: string | null = null;
  if (preEntryPeriod && preEntryPeriod.qualifyingStartDate) {
    qualifyingStart = preEntryPeriod.qualifyingStartDate;
  } else {
    qualifyingStart = vignetteEntryDate || visaStartDate;
  }

  if (!qualifyingStart) return null;

  const start = new Date(qualifyingStart);
  if (isNaN(start.getTime())) return null;

  const requiredEndDate = addYears(start, ilrTrack);
  const baselineDate = subDays(requiredEndDate, 28);

  const isValidILRDate = (candidateDate: Date): boolean => {
    let qualifyingPeriodStart = addYears(candidateDate, -ilrTrack);
    if (qualifyingPeriodStart < start) {
      qualifyingPeriodStart = start;
    }

    const maxAbsence = calculateMaxAbsenceInRolling12Months({
      trips: trips,
      startDate: qualifyingPeriodStart,
      endDate: candidateDate,
      preEntryPeriod,
      visaStartDate,
      vignetteEntryDate,
    });

    return maxAbsence <= MAX_ABSENCE_IN_12_MONTHS;
  };

  if (isValidILRDate(baselineDate)) {
    return baselineDate.toISOString().split('T')[0];
  }

  let left = 0;
  let right = MAX_ILR_DATE_SEARCH_DAYS;
  let result: Date | null = null;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const candidateDate = addDays(baselineDate, mid);

    if (isValidILRDate(candidateDate)) {
      result = candidateDate;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return result ? result.toISOString().split('T')[0] : null;
}

function buildSummary(params: {
  tripsWithCalculations: TripWithCalculations[];
  preEntryPeriod: PreEntryPeriodInfo | null;
  vignetteEntryDate: string;
  visaStartDate: string;
  ilrTrack: ILRTrack | null;
  effectiveApplicationDate: string | null;
  applicationDate: string;
}): TravelCalculationResult['summary'] {
  const {
    tripsWithCalculations,
    preEntryPeriod,
    vignetteEntryDate,
    visaStartDate,
    ilrTrack,
    effectiveApplicationDate,
  } = params;

  const complete = tripsWithCalculations.filter((t) => !t.isIncomplete);
  const totalFullDays = complete.reduce((sum, t) => sum + (t.fullDays || 0), 0);

  let continuousLeaveDays: number | null = null;
  let maxAbsenceInAny12Months: number | null = null;
  let hasExceeded180Days = false;
  let ilrEligibilityDate: string | null = null;
  let daysUntilEligible: number | null = null;

  let qualifyingStartDate: Date | null = null;
  if (preEntryPeriod && preEntryPeriod.qualifyingStartDate) {
    qualifyingStartDate = new Date(preEntryPeriod.qualifyingStartDate);
  } else {
    const visaStart = vignetteEntryDate || visaStartDate;
    if (visaStart) {
      qualifyingStartDate = new Date(visaStart);
    }
  }

  if (qualifyingStartDate && !isNaN(qualifyingStartDate.getTime())) {
    const appDateStr = effectiveApplicationDate;

    if (appDateStr && ilrTrack) {
      const appDate = new Date(appDateStr);

      if (!isNaN(appDate.getTime())) {
        const assessmentDates = [appDate];
        for (let i = 1; i <= 28; i++) {
          assessmentDates.push(addDays(appDate, i));
        }

        let bestResult:
          | {
              assessmentDate: Date;
              qualifyingPeriodStart: Date;
              maxAbsence: number;
              continuousDays: number;
            }
          | null = null;

        for (const assessDate of assessmentDates) {
          const qualifyingStart = subDays(addYears(assessDate, -ilrTrack), 0);
          if (qualifyingStart < qualifyingStartDate) continue;

          const maxAbsence = calculateMaxAbsenceInRolling12Months({
            trips: tripsWithCalculations,
            startDate: qualifyingStart,
            endDate: assessDate,
            preEntryPeriod,
            visaStartDate,
            vignetteEntryDate,
          });

          const totalDaysInPeriod = differenceInDays(
            assessDate,
            qualifyingStart,
          );

          const absenceInPeriod = complete
            .filter((trip) => {
              const tripOut = new Date(trip.outDate);
              const tripIn = new Date(trip.inDate);
              return tripIn >= qualifyingStart && tripOut <= assessDate;
            })
            .reduce((sum, trip) => {
              const tripOut = new Date(trip.outDate);
              const tripIn = new Date(trip.inDate);

              const effectiveStart =
                tripOut > qualifyingStart ? tripOut : qualifyingStart;
              const effectiveEnd = tripIn < assessDate ? tripIn : assessDate;

              if (effectiveStart <= effectiveEnd) {
                const absenceStart = addDays(
                  effectiveStart,
                  effectiveStart === tripOut ? 1 : 0,
                );
                const absenceEnd = subDays(
                  effectiveEnd,
                  effectiveEnd === tripIn ? 1 : 0,
                );

                if (absenceStart <= absenceEnd) {
                  return sum + differenceInDays(absenceEnd, absenceStart) + 1;
                }
              }
              return sum;
            }, 0);

          const continuousDays = totalDaysInPeriod - absenceInPeriod;

          if (!bestResult || maxAbsence < bestResult.maxAbsence) {
            bestResult = {
              assessmentDate: assessDate,
              qualifyingPeriodStart: qualifyingStart,
              maxAbsence,
              continuousDays,
            };
          }
        }

        if (bestResult) {
          maxAbsenceInAny12Months = bestResult.maxAbsence;
          hasExceeded180Days =
            bestResult.maxAbsence > MAX_ABSENCE_IN_12_MONTHS;
          continuousLeaveDays = bestResult.continuousDays;
          ilrEligibilityDate = appDateStr;
          daysUntilEligible = differenceInDays(appDate, new Date());
        }
      }
    }
  }

  return {
    totalTrips: tripsWithCalculations.length,
    completeTrips: complete.length,
    incompleteTrips: tripsWithCalculations.length - complete.length,
    totalFullDays,
    continuousLeaveDays,
    maxAbsenceInAny12Months,
    hasExceeded180Days,
    ilrEligibilityDate,
    daysUntilEligible,
  };
}

function calculateMaxAbsenceInRolling12Months(params: {
  trips: TripWithCalculations[];
  startDate: Date;
  endDate: Date;
  preEntryPeriod: PreEntryPeriodInfo | null;
  visaStartDate: string;
  vignetteEntryDate: string;
}): number {
  const { trips, startDate, endDate, preEntryPeriod, visaStartDate } = params;
  const completeTrips = trips.filter((t) => !t.isIncomplete);

  let maxAbsence = 0;
  const checkDates: Date[] = [new Date(startDate)];

  if (preEntryPeriod && preEntryPeriod.canCount && visaStartDate) {
    const visaStart = new Date(visaStartDate);
    if (visaStart >= startDate) {
      checkDates.push(visaStart);
    }
  }

  completeTrips.forEach((trip) => {
    const tripOutDate = new Date(trip.outDate);
    if (tripOutDate >= startDate) {
      checkDates.push(tripOutDate);
    }
  });

  checkDates.forEach((checkDate) => {
    if (checkDate > endDate) return;

    const periodEnd = new Date(checkDate);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    let absenceDays = 0;

    if (
      preEntryPeriod &&
      preEntryPeriod.canCount &&
      params.visaStartDate &&
      params.vignetteEntryDate
    ) {
      const visaStart = new Date(params.visaStartDate);
      const vignetteEntry = new Date(params.vignetteEntryDate);

      if (visaStart <= periodEnd && vignetteEntry >= checkDate) {
        const intersectionStart =
          visaStart > checkDate ? visaStart : checkDate;
        const intersectionEnd =
          vignetteEntry < periodEnd ? vignetteEntry : periodEnd;

        if (intersectionStart <= intersectionEnd) {
          const daysInIntersection = differenceInDays(
            intersectionEnd,
            intersectionStart,
          );
          absenceDays += daysInIntersection;
        }
      }
    }

    completeTrips.forEach((trip) => {
      const tripOut = new Date(trip.outDate);
      const tripIn = new Date(trip.inDate);

      const absenceStart = addDays(tripOut, 1);
      const absenceEnd = subDays(tripIn, 1);

      if (absenceStart <= periodEnd && absenceEnd >= checkDate) {
        const intersectionStart =
          absenceStart > checkDate ? absenceStart : checkDate;
        const intersectionEnd =
          absenceEnd < periodEnd ? absenceEnd : periodEnd;

        if (intersectionStart <= intersectionEnd) {
          const daysInIntersection =
            differenceInDays(intersectionEnd, intersectionStart) + 1;
          absenceDays += daysInIntersection;
        }
      }
    });

    maxAbsence = Math.max(maxAbsence, absenceDays);
  });

  return maxAbsence;
}

function getRiskLevel(days: number): 'low' | 'caution' | 'critical' {
  if (days >= MAX_ABSENCE_IN_12_MONTHS) return 'critical';
  if (days >= 150) return 'caution';
  return 'low';
}

function buildRollingAbsenceData(params: {
  tripsWithCalculations: TripWithCalculations[];
  vignetteEntryDate: string;
  visaStartDate: string;
}): RollingDataPoint[] {
  const { tripsWithCalculations, vignetteEntryDate, visaStartDate } = params;
  const startDate = vignetteEntryDate || visaStartDate;

  if (!startDate) return [];

  const start = parseISO(startDate);
  const today = new Date();
  const totalDays = differenceInDays(today, start);

  if (totalDays < 0 || totalDays > 3650) {
    return [];
  }

  const completeTrips = tripsWithCalculations.filter((t) => !t.isIncomplete);
  const rollingPoints: RollingDataPoint[] = [];
  const sampleInterval = Math.max(1, Math.floor(totalDays / 200));

  for (let i = 0; i <= totalDays; i += sampleInterval) {
    const currentDate = addDays(start, i);
    const windowStart = addDays(currentDate, -365);

    let absenceDays = 0;

    completeTrips.forEach((trip) => {
      const tripOut = parseISO(trip.outDate);
      const tripIn = parseISO(trip.inDate);

      const absenceStart = addDays(tripOut, 1);
      const absenceEnd = subDays(tripIn, 1);

      if (absenceStart <= currentDate && absenceEnd >= windowStart) {
        const intersectionStart =
          absenceStart > windowStart ? absenceStart : windowStart;
        const intersectionEnd =
          absenceEnd < currentDate ? absenceEnd : currentDate;

        if (intersectionStart <= intersectionEnd) {
          const daysInIntersection =
            differenceInDays(intersectionEnd, intersectionStart) + 1;
          absenceDays += daysInIntersection;
        }
      }
    });

    rollingPoints.push({
      date: currentDate.toISOString(),
      rollingDays: absenceDays,
      riskLevel: getRiskLevel(absenceDays),
      formattedDate: format(currentDate, 'dd/MM/yyyy'),
    });
  }

  if (totalDays % sampleInterval !== 0) {
    const windowStart = addDays(today, -365);
    let absenceDays = 0;

    completeTrips.forEach((trip) => {
      const tripOut = parseISO(trip.outDate);
      const tripIn = parseISO(trip.inDate);

      const absenceStart = addDays(tripOut, 1);
      const absenceEnd = subDays(tripIn, 1);

      if (absenceStart <= today && absenceEnd >= windowStart) {
        const intersectionStart =
          absenceStart > windowStart ? absenceStart : windowStart;
        const intersectionEnd = absenceEnd < today ? absenceEnd : today;

        if (intersectionStart <= intersectionEnd) {
          const daysInIntersection =
            differenceInDays(intersectionEnd, intersectionStart) + 1;
          absenceDays += daysInIntersection;
        }
      }
    });

    rollingPoints.push({
      date: today.toISOString(),
      rollingDays: absenceDays,
      riskLevel: getRiskLevel(absenceDays),
      formattedDate: format(today, 'dd/MM/yyyy'),
    });
  }

  return rollingPoints;
}

function buildTimelinePoints(params: {
  tripsWithCalculations: TripWithCalculations[];
  vignetteEntryDate: string;
  visaStartDate: string;
}): TimelinePoint[] {
  const { tripsWithCalculations, vignetteEntryDate, visaStartDate } = params;
  const startDate = vignetteEntryDate || visaStartDate;

  if (!startDate) {
    return [];
  }

  const start = parseISO(startDate);
  const today = new Date();
  const totalDays = differenceInDays(today, start);

  if (totalDays < 0 || totalDays > 3650) {
    return [];
  }

  const completeTrips = tripsWithCalculations.filter((t) => !t.isIncomplete);
  const timelinePoints: TimelinePoint[] = [];

  for (let i = 0; i <= totalDays; i++) {
    const currentDate = addDays(start, i);
    const dateStr = currentDate.toISOString().split('T')[0];

    const activeTrips = completeTrips.filter((trip) => {
      const tripOut = parseISO(trip.outDate);
      const tripIn = parseISO(trip.inDate);
      return currentDate >= tripOut && currentDate <= tripIn;
    });

    timelinePoints.push({
      date: dateStr,
      daysSinceStart: i,
      tripCount: activeTrips.length,
      formattedDate: format(currentDate, 'dd/MM/yyyy'),
    });
  }

  return timelinePoints;
}

function buildTripBars(params: {
  tripsWithCalculations: TripWithCalculations[];
  vignetteEntryDate: string;
  visaStartDate: string;
}): TripBar[] {
  const { tripsWithCalculations, vignetteEntryDate, visaStartDate } = params;
  const startDate = vignetteEntryDate || visaStartDate;

  if (!startDate) {
    return [];
  }

  const start = parseISO(startDate);
  const completeTrips = tripsWithCalculations.filter((t) => !t.isIncomplete);

  return completeTrips.map((trip) => {
    const tripOutDate = parseISO(trip.outDate);
    const tripInDate = parseISO(trip.inDate);
    const tripStart = differenceInDays(tripOutDate, start);
    const tripEnd = differenceInDays(tripInDate, start);

    return {
      date: trip.outDate,
      tripStart,
      tripEnd,
      tripDuration: trip.fullDays || 0,
      tripLabel: `${trip.outRoute || 'Unknown'} -> ${trip.inRoute || 'Unknown'}`,
      formattedDate: format(tripOutDate, 'dd/MM/yyyy'),
      outDate: trip.outDate,
      inDate: trip.inDate,
    };
  });
}
