/**
 * UK ILR Rule Engine
 *
 * Wraps the existing @uth/calculators logic to provide a unified rule engine interface.
 */

import { calculateTravelData, type TripRecord } from '@uth/calculators';
import { differenceInDays, parseISO, format } from 'date-fns';
import type {
  RuleEngine,
  UKILRConfig,
  GoalCalculation,
  GoalMetric,
  GoalWarning,
  GoalStatus,
  GoalCategory,
} from '../types';

export class UKILRRuleEngine implements RuleEngine<UKILRConfig> {
  readonly goalType = 'uk_ilr' as const;
  readonly jurisdiction = 'uk' as const;

  calculate(
    trips: TripRecord[],
    config: UKILRConfig,
    startDate: Date,
    asOfDate: Date = new Date()
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
    const elapsedDays = differenceInDays(asOfDate, parseISO(config.visaStartDate));
    const progressPercent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

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
    summary: { hasExceededAllowedAbsense: boolean; maxAbsenceInAny12Months: number | null }
  ): GoalStatus {
    if (validationStatus === 'ELIGIBLE') {
      return 'eligible';
    }

    if (summary.hasExceededAllowedAbsense) {
      return 'limit_exceeded';
    }

    // Check if at risk (>150 days in rolling 12 months)
    if (summary.maxAbsenceInAny12Months && summary.maxAbsenceInAny12Months >= 150) {
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
    config: UKILRConfig
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
        status: summary.maxAbsenceInAny12Months > limit ? 'exceeded' :
                summary.maxAbsenceInAny12Months >= 150 ? 'warning' : 'ok',
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
        status: summary.currentRollingAbsenceToday > 180 ? 'exceeded' :
                summary.currentRollingAbsenceToday >= 150 ? 'warning' : 'ok',
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
        tooltip: 'Days you can still spend outside UK in current 12-month window',
      });
    }

    return metrics;
  }

  private buildWarnings(
    summary: {
      hasExceededAllowedAbsense: boolean;
      remaining180LimitToday: number | null;
    },
    validation: { status: string; reason?: { message?: string } }
  ): GoalWarning[] {
    const warnings: GoalWarning[] = [];

    if (summary.hasExceededAllowedAbsense) {
      warnings.push({
        severity: 'error',
        title: 'Absence Limit Exceeded',
        message: 'You have exceeded the maximum allowed absence in a 12-month period.',
        action: 'Review your travel history and eligibility date',
      });
    } else if (summary.remaining180LimitToday !== null && summary.remaining180LimitToday < 30) {
      warnings.push({
        severity: 'warning',
        title: 'Low Remaining Allowance',
        message: `You only have ${summary.remaining180LimitToday} days left in your current 12-month window.`,
        action: 'Plan any upcoming travel carefully',
      });
    }

    if (validation.status === 'INELIGIBLE' && validation.reason?.message) {
      warnings.push({
        severity: 'info',
        title: 'Not Yet Eligible',
        message: validation.reason.message,
      });
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
        status: summary.ilrEligibilityDate ? 'met' as const : 'pending' as const,
        detail: summary.ilrEligibilityDate
          ? `Eligible from ${format(parseISO(summary.ilrEligibilityDate), 'dd MMM yyyy')}`
          : 'In progress',
      },
      {
        key: 'absence_limit',
        label: 'Stay within absence limits',
        status: summary.hasExceededAllowedAbsense ? 'not_met' as const : 'met' as const,
        detail: summary.hasExceededAllowedAbsense
          ? 'Exceeded 180-day limit'
          : 'Within limits',
      },
    ];
  }
}
