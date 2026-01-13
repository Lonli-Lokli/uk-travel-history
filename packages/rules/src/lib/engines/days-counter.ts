/**
 * Days Counter Rule Engine
 *
 * Simple engine for counting days away or present without any limits.
 */

import type { TripRecord } from '../internal';
import type {
  RuleEngine,
  DaysCounterConfig,
  GoalCalculation,
  GoalMetric,
  GoalStatus,
  GoalCategory,
} from '../types';
import {
  formatDate,
  differenceInDays,
  parseDate,
  isBefore,
  isAfter,
} from '@uth/utils';

export class DaysCounterRuleEngine implements RuleEngine<DaysCounterConfig> {
  readonly goalType = 'days_counter' as const;
  readonly jurisdiction = 'global' as const;

  calculate(
    trips: TripRecord[],
    config: DaysCounterConfig,
    startDate: Date,
    asOfDate: Date = new Date(),
  ): GoalCalculation {
    const daysAway = this.calculateDaysAway(trips, startDate, asOfDate);
    const totalDays = differenceInDays(asOfDate, startDate) + 1;
    const daysPresent = totalDays - daysAway;

    const primaryValue =
      config.countDirection === 'days_away' ? daysAway : daysPresent;
    const label =
      config.countDirection === 'days_away'
        ? `Days Away from ${config.referenceLocation}`
        : `Days in ${config.referenceLocation}`;

    const metrics: GoalMetric[] = [
      {
        key: 'primary_count',
        label,
        value: primaryValue,
        unit: 'days',
        status: 'ok',
        tooltip: `Since ${formatDate(startDate)}`,
      },
      {
        key: 'tracking_period',
        label: 'Total Days Tracked',
        value: totalDays,
        unit: 'days',
        status: 'ok',
      },
    ];

    // Add secondary metric (opposite of primary)
    if (config.countDirection === 'days_away') {
      metrics.push({
        key: 'days_present',
        label: `Days in ${config.referenceLocation}`,
        value: daysPresent,
        unit: 'days',
        status: 'ok',
      });
    } else {
      metrics.push({
        key: 'days_away',
        label: `Days Away`,
        value: daysAway,
        unit: 'days',
        status: 'ok',
      });
    }

    // Calculate percentage of time away/present
    const percentage =
      totalDays > 0 ? Math.round((primaryValue / totalDays) * 100) : 0;
    metrics.push({
      key: 'percentage',
      label:
        config.countDirection === 'days_away'
          ? '% Time Away'
          : '% Time Present',
      value: percentage,
      unit: 'percent',
      status: 'ok',
    });

    return {
      goalId: '', // Set by caller
      goalType: 'days_counter',
      status: 'in_progress' as GoalStatus, // No target, always in progress
      progressPercent: 0, // No target for simple counter
      eligibilityDate: null,
      daysUntilEligible: null,
      metrics,
      warnings: [],
    };
  }

  validateConfig(config: unknown): config is DaysCounterConfig {
    if (!config || typeof config !== 'object') return false;
    const c = config as Record<string, unknown>;

    return (
      c.type === 'days_counter' &&
      ['days_away', 'days_present'].includes(c.countDirection as string) &&
      typeof c.referenceLocation === 'string'
    );
  }

  getDisplayInfo() {
    return {
      name: 'Days Counter',
      icon: 'calculator',
      description: 'Count days spent in or away from a location',
      category: 'personal' as GoalCategory,
    };
  }

  /**
   * Calculate total days away (full days only, excluding departure and return days)
   */
  private calculateDaysAway(
    trips: TripRecord[],
    startDate: Date,
    endDate: Date,
  ): number {
    let totalDaysAway = 0;

    for (const trip of trips) {
      if (!trip.outDate || !trip.inDate) continue;

      const tripOut = parseDate(trip.outDate);
      const tripIn = parseDate(trip.inDate);

      // Skip trips entirely outside our date range
      if (
        !tripOut ||
        !tripIn ||
        isAfter(tripOut, endDate) ||
        isBefore(tripIn, startDate)
      ) {
        continue;
      }

      // Clip trip to our date range
      const effectiveOut = isBefore(tripOut, startDate) ? startDate : tripOut;
      const effectiveIn = isAfter(tripIn, endDate) ? endDate : tripIn;

      // Full days = days between departure and return (excluding both)
      // If clipped, we adjust the calculation
      const fullDays = differenceInDays(effectiveIn, effectiveOut) - 1;

      if (fullDays > 0) {
        totalDaysAway += fullDays;
      }
    }

    return totalDaysAway;
  }
}
