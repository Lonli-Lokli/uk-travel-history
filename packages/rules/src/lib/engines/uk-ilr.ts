/**
 * UK ILR Rule Engine
 *
 * Wraps the existing @uth/calculators logic to provide a unified rule engine interface.
 */

import { calculateTravelData, type TripRecord } from '../internal';
import type {
  RuleEngine,
  UKILRConfig,
  GoalCalculation,
  GoalMetric,
  GoalWarning,
  GoalStatus,
  GoalCategory,
} from '../types';
import { formatDate, differenceInDays, parseDate } from '@uth/utils';

export class UKILRRuleEngine implements RuleEngine<UKILRConfig> {
  readonly goalType = 'uk_ilr' as const;
  readonly jurisdiction = 'uk' as const;

  calculate(
    trips: TripRecord[],
    config: UKILRConfig,
    startDate: Date,
    asOfDate: Date = new Date(),
  ): GoalCalculation {
    // Delegate to existing calculator
    const result = calculateTravelData({
      trips,
      visaStartDate: config.visaStartDate,
      vignetteEntryDate: config.vignetteEntryDate || config.visaStartDate,
      ilrTrack: config.trackYears,
      applicationDateOverride: null,
    });

    // Transform to GoalCalculation format
    const status = this.mapStatus(result.validation.status, result.summary);
    const metrics = this.buildMetrics(result.summary, config);
    const warnings = this.buildWarnings(result.summary, result.validation);

    // Calculate progress percentage
    const totalDays = config.trackYears * 365;
    const elapsedDays = differenceInDays(
      asOfDate,
      parseDate(config.visaStartDate),
    );
    const progressPercent = Math.min(
      100,
      Math.round((elapsedDays / totalDays) * 100),
    );

    return {
      goalId: '', // Set by caller
      goalType: 'uk_ilr',
      status,
      progressPercent,
      eligibilityDate: result.summary.ilrEligibilityDate,
      daysUntilEligible: result.summary.daysUntilEligible,
      metrics,
      warnings,
      requirements: this.buildRequirements(result.summary),
      visualization: {
        rollingAbsenceData: result.rollingAbsenceData,
        timelinePoints: result.timelinePoints,
        tripBars: result.tripBars,
      },
    };
  }

  validateConfig(config: unknown): config is UKILRConfig {
    if (!config || typeof config !== 'object') return false;
    const c = config as Record<string, unknown>;

    return (
      c.type === 'uk_ilr' &&
      typeof c.visaStartDate === 'string' &&
      [2, 3, 5, 10].includes(c.trackYears as number)
    );
  }

  getDisplayInfo() {
    return {
      name: 'UK Indefinite Leave to Remain',
      icon: 'home',
      description: 'Track continuous residence for ILR eligibility',
      category: 'immigration' as GoalCategory,
    };
  }

  private mapStatus(
    validationStatus: 'ELIGIBLE' | 'INELIGIBLE',
    summary: {
      hasExceededAllowedAbsense: boolean;
      maxAbsenceInAny12Months: number | null;
    },
  ): GoalStatus {
    if (validationStatus === 'ELIGIBLE') {
      return 'eligible';
    }

    if (summary.hasExceededAllowedAbsense) {
      return 'limit_exceeded';
    }

    // Check if at risk (>150 days in rolling 12 months)
    if (
      summary.maxAbsenceInAny12Months &&
      summary.maxAbsenceInAny12Months >= 150
    ) {
      return 'at_risk';
    }

    return 'in_progress';
  }

  private buildMetrics(
    summary: {
      totalFullDays: number;
      continuousLeaveDays: number | null;
      maxAbsenceInAny12Months: number | null;
      currentRollingAbsenceToday: number | null;
      remaining180LimitToday: number | null;
    },
    config: UKILRConfig,
  ): GoalMetric[] {
    const metrics: GoalMetric[] = [];

    // Total days outside UK
    metrics.push({
      key: 'total_days_outside',
      label: 'Total Days Outside UK',
      value: summary.totalFullDays,
      unit: 'days',
      status: 'ok',
      tooltip: 'Total full days spent outside the UK since visa start',
    });

    // Continuous leave days
    if (summary.continuousLeaveDays !== null) {
      metrics.push({
        key: 'continuous_leave',
        label: 'Days in UK',
        value: summary.continuousLeaveDays,
        unit: 'days',
        status: 'ok',
        tooltip: 'Days physically present in the UK',
      });
    }

    // Max rolling 12-month absence
    if (summary.maxAbsenceInAny12Months !== null) {
      const limit = config.trackYears === 10 ? 184 : 180;
      metrics.push({
        key: 'max_rolling_absence',
        label: 'Max 12-Month Absence',
        value: summary.maxAbsenceInAny12Months,
        limit,
        unit: 'days',
        status:
          summary.maxAbsenceInAny12Months > limit
            ? 'exceeded'
            : summary.maxAbsenceInAny12Months >= 150
              ? 'warning'
              : 'ok',
        tooltip: `Maximum absence in any rolling 12-month period (limit: ${limit} days)`,
      });
    }

    // Current rolling window
    if (summary.currentRollingAbsenceToday !== null) {
      metrics.push({
        key: 'current_rolling',
        label: 'Current 12-Month Total',
        value: summary.currentRollingAbsenceToday,
        limit: 180,
        unit: 'days',
        status:
          summary.currentRollingAbsenceToday > 180
            ? 'exceeded'
            : summary.currentRollingAbsenceToday >= 150
              ? 'warning'
              : 'ok',
        tooltip: 'Absence days in the 12-month period ending today',
      });
    }

    // Remaining allowance
    if (summary.remaining180LimitToday !== null) {
      metrics.push({
        key: 'remaining_allowance',
        label: 'Days Available',
        value: summary.remaining180LimitToday,
        unit: 'days',
        status: summary.remaining180LimitToday < 30 ? 'warning' : 'ok',
        tooltip:
          'Days you can still spend outside UK in current 12-month window',
      });
    }

    return metrics;
  }

  private buildWarnings(
    summary: {
      hasExceededAllowedAbsense: boolean;
      remaining180LimitToday: number | null;
    },
    validation: {
      status: string;
      reason?: {
        type?: string;
        message?: string;
        earliestAllowedDate?: string;
        requiredDays?: number;
        currentDays?: number;
        daysShortfall?: number;
        incompleteTripIds?: string[];
        incompleteCount?: number;
        offendingWindows?: Array<{ start: string; end: string; days: number }>;
        worstWindow?: { start: string; end: string; days: number };
        limit?: number;
        missingFields?: string[];
      };
    },
  ): GoalWarning[] {
    const warnings: GoalWarning[] = [];

    // Handle ineligibility reasons with detailed explanations
    if (validation.status === 'INELIGIBLE' && validation.reason) {
      const reason = validation.reason;

      switch (reason.type) {
        case 'EXCESSIVE_ABSENCE':
          if (reason.worstWindow && reason.offendingWindows) {
            const details = [
              `Worst period: ${formatDate(reason.worstWindow.start)} to ${formatDate(reason.worstWindow.end)}`,
              `Absence days in that period: ${reason.worstWindow.days} (limit: ${reason.limit || 180})`,
              `Total violating periods: ${reason.offendingWindows.length}`,
            ];

            warnings.push({
              severity: 'error',
              title: 'Absence Limit Exceeded',
              message: `You exceeded the ${reason.limit || 180}-day limit in at least one 12-month period.`,
              details,
              offendingWindows: reason.offendingWindows,
            });
          }
          break;

        case 'TOO_EARLY':
          if (
            reason.earliestAllowedDate &&
            reason.requiredDays &&
            reason.currentDays !== undefined &&
            reason.daysShortfall
          ) {
            const details = [
              `Required qualifying days: ${reason.requiredDays}`,
              `Current qualifying days: ${reason.currentDays}`,
              `Days shortfall: ${reason.daysShortfall}`,
              `Earliest eligible date: ${formatDate(reason.earliestAllowedDate)}`,
            ];

            warnings.push({
              severity: 'error',
              title: 'Qualifying Period Not Completed',
              message: 'You have not yet completed the required qualifying period.',
              details,
            });
          }
          break;

        case 'INCOMPLETED_TRIPS':
          if (reason.incompleteTripIds && reason.incompleteCount) {
            const details = [
              `${reason.incompleteCount} trip(s) missing departure or return dates`,
              'All trips must have both Out and In dates to calculate eligibility',
            ];

            warnings.push({
              severity: 'error',
              title: 'Incomplete Trip Data',
              message: `${reason.incompleteCount} trip(s) are missing dates.`,
              details,
              relatedTripIds: reason.incompleteTripIds,
            });
          }
          break;

        case 'INCORRECT_INPUT':
          if (reason.missingFields && reason.missingFields.length > 0) {
            const details = reason.missingFields.map(
              (field) => `Missing: ${field}`,
            );

            warnings.push({
              severity: 'error',
              title: 'Missing Configuration',
              message: 'Required dates are missing from your goal configuration.',
              details,
            });
          } else {
            warnings.push({
              severity: 'error',
              title: 'Invalid Configuration',
              message: reason.message || 'There is an error in your configuration.',
            });
          }
          break;

        default:
          // Fallback for unknown types
          warnings.push({
            severity: 'error',
            title: 'Not Eligible',
            message: reason.message || 'Eligibility requirements not met.',
          });
      }
    } else {
      // User is eligible or no validation issues, check for warnings
      if (
        summary.remaining180LimitToday !== null &&
        summary.remaining180LimitToday < 30
      ) {
        warnings.push({
          severity: 'warning',
          title: 'Low Remaining Allowance',
          message: `You only have ${summary.remaining180LimitToday} days left in your current 12-month window.`,
          details: [
            'Plan any upcoming travel carefully to avoid exceeding the 180-day limit',
          ],
        });
      }
    }

    return warnings;
  }

  private buildRequirements(summary: {
    ilrEligibilityDate: string | null;
    hasExceededAllowedAbsense: boolean;
  }) {
    return [
      {
        key: 'qualifying_period',
        label: 'Complete qualifying period',
        status: summary.ilrEligibilityDate
          ? ('met' as const)
          : ('pending' as const),
        detail: summary.ilrEligibilityDate
          ? `Eligible from ${formatDate(summary.ilrEligibilityDate)}`
          : 'In progress',
      },
      {
        key: 'absence_limit',
        label: 'Stay within absence limits',
        status: summary.hasExceededAllowedAbsense
          ? ('not_met' as const)
          : ('met' as const),
        detail: summary.hasExceededAllowedAbsense
          ? 'Exceeded 180-day limit'
          : 'Within limits',
      },
    ];
  }
}
