'use client';

import { observer } from 'mobx-react-lite';
import { travelStore } from '@uth/stores';
import { formatDate } from '@uth/utils';
import { CompoundStatCard } from './CompoundStatCard';

export const SummaryCards = observer(() => {
  const summary = travelStore.summary;
  const validation = travelStore.validation;
  const hasContinuousLeave = summary.continuousLeaveDays !== null;

  // Show ILR Status card when we have validation results and today's quota data
  const hasILRStatus =
    validation && hasContinuousLeave && summary.remaining180LimitToday !== null;
  const isEligible = validation?.status === 'ELIGIBLE';

  const gridColsClass = hasILRStatus
    ? 'sm:grid-cols-1 lg:grid-cols-2'
    : 'sm:grid-cols-1';

  return (
    <div className={`grid grid-cols-1 ${gridColsClass} gap-2 mb-3`}>
      {/* Combined Travel History & Time Tracking Card */}
      {hasContinuousLeave ? (
        <CompoundStatCard
          icon={summary.hasExceededAllowedAbsense ? 'alert' : 'airplane'}
          title="Travel History & Time Tracking"
          stats={[
            {
              value: summary.totalTrips,
              label: 'Total Trips',
              tooltip:
                'Total number of trips outside the UK that you have recorded.',
            },
            {
              value: summary.completeTrips,
              label: 'Complete',
              variant: 'success',
              tooltip:
                'Number of trips with both departure and return dates filled in.',
            },
            {
              value: summary.incompleteTrips,
              label: 'Incomplete',
              variant: summary.incompleteTrips > 0 ? 'warning' : 'default',
              tooltip:
                'Number of trips missing either departure or return date. Complete these to calculate accurate ILR eligibility.',
            },
            {
              value: summary.totalFullDays,
              label: 'Days Outside',
              tooltip:
                'Total full days spent outside the UK. Full days exclude your departure and return days (as per UK Home Office guidance).',
            },
            {
              value: summary.continuousLeaveDays!,
              label: 'Days in UK',
              variant: summary.hasExceededAllowedAbsense
                ? 'warning'
                : 'success',
              tooltip:
                'Total days you have been physically present in the UK during your continuous residence period, calculated from your vignette entry or visa start date.',
            },
            {
              value: summary.maxAbsenceInAny12Months ?? '—',
              label: 'Max 12mo',
              variant: summary.hasExceededAllowedAbsense
                ? 'warning'
                : 'default',
              tooltip:
                'The maximum number of days you were absent in any single rolling 12-month period. This must not exceed 180 days to maintain continuous residence.',
            },
          ]}
          variant={summary.hasExceededAllowedAbsense ? 'warning' : 'neutral'}
          subtitle={
            summary.hasExceededAllowedAbsense && (
              <>⚠️ 180-day limit exceeded in a rolling 12-month period</>
            )
          }
        />
      ) : (
        <CompoundStatCard
          icon="airplane"
          title="Travel History"
          stats={[
            {
              value: summary.totalTrips,
              label: 'Total Trips',
              tooltip:
                'Total number of trips outside the UK that you have recorded.',
            },
            {
              value: summary.completeTrips,
              label: 'Complete',
              variant: 'success',
              tooltip:
                'Number of trips with both departure and return dates filled in.',
            },
            {
              value: summary.incompleteTrips,
              label: 'Incomplete',
              variant: summary.incompleteTrips > 0 ? 'warning' : 'default',
              tooltip:
                'Number of trips missing either departure or return date. Complete these to calculate accurate ILR eligibility.',
            },
            {
              value: summary.totalFullDays,
              label: 'Days Outside',
              tooltip:
                'Total full days spent outside the UK. Full days exclude your departure and return days (as per UK Home Office guidance).',
            },
          ]}
          variant="neutral"
        />
      )}

      {/* Combined ILR Status Card */}
      {hasILRStatus && validation && (
        <CompoundStatCard
          icon={isEligible ? 'target' : 'alert'}
          title="ILR Status & 180-Day Tracking"
          stats={
            isEligible && summary.ilrEligibilityDate
              ? [
                  {
                    value: formatDate(summary.ilrEligibilityDate),
                    label: 'Eligible Date',
                    tooltip:
                      'The date when you become eligible to apply for Indefinite Leave to Remain (ILR) based on your continuous residence period.',
                  },
                  {
                    value:
                      summary.daysUntilEligible !== null
                        ? summary.daysUntilEligible <= 0
                          ? '✓ Eligible'
                          : `${summary.daysUntilEligible}d`
                        : '—',
                    label: 'Days Until ILR',
                    variant:
                      summary.daysUntilEligible !== null &&
                      summary.daysUntilEligible <= 0
                        ? 'success'
                        : 'default',
                    tooltip:
                      summary.daysUntilEligible !== null &&
                      summary.daysUntilEligible > 0
                        ? 'Number of days remaining until you meet the continuous residence requirement for ILR.'
                        : 'You have met the continuous residence requirement and can apply for ILR now.',
                  },
                  {
                    value: summary.remaining180LimitToday ?? '—',
                    label: 'Available Days',
                    variant:
                      summary.remaining180LimitToday !== null &&
                      summary.remaining180LimitToday < 30
                        ? 'warning'
                        : 'success',
                    tooltip:
                      'Days remaining before reaching the 180-day absence limit in the current rolling 12-month period. You can be absent for up to 180 days in any consecutive 12 months.',
                  },
                  {
                    value: summary.currentRollingAbsenceToday ?? '—',
                    label: 'Days Absent',
                    tooltip:
                      'Total number of full days you have been absent from the UK in the current rolling 12-month period (looking back from today).',
                  },
                ]
              : validation.status === 'INELIGIBLE'
                ? [
                    {
                      value: 'NOT ELIGIBLE',
                      label: 'ILR Status',
                      variant: 'warning',
                      tooltip:
                        'You are currently not eligible to apply for Indefinite Leave to Remain. See the reason below and the detailed validation card for more information.',
                    },
                    {
                      value:
                        validation.reason.type === 'TOO_EARLY'
                          ? 'Too Early'
                          : validation.reason.type === 'EXCESSIVE_ABSENCE'
                            ? 'Limit Exceeded'
                            : 'Invalid',
                      label: 'Reason',
                      variant: 'warning',
                      tooltip:
                        validation.reason.type === 'TOO_EARLY'
                          ? 'Your application date is before you have completed the required continuous residence period.'
                          : validation.reason.type === 'EXCESSIVE_ABSENCE'
                            ? 'You have exceeded the 180-day absence limit in at least one rolling 12-month period, which breaks continuous residence.'
                            : 'There is an issue with your input data. Please check the validation card below for details.',
                    },
                    {
                      value: summary.remaining180LimitToday ?? '—',
                      label: 'Available Days',
                      variant:
                        summary.remaining180LimitToday !== null &&
                        summary.remaining180LimitToday < 30
                          ? 'warning'
                          : 'default',
                      tooltip:
                        'Days remaining before reaching the 180-day absence limit in the current rolling 12-month period. You can be absent for up to 180 days in any consecutive 12 months.',
                    },
                    {
                      value: summary.currentRollingAbsenceToday ?? '—',
                      label: 'Days Absent',
                      tooltip:
                        'Total number of full days you have been absent from the UK in the current rolling 12-month period (looking back from today).',
                    },
                  ]
                : []
          }
          variant={isEligible ? 'success' : 'warning'}
          subtitle={
            !isEligible &&
            validation.status === 'INELIGIBLE' &&
            validation.reason.type === 'TOO_EARLY'
              ? 'Application date is before the required continuous residence period'
              : !isEligible &&
                  validation.status === 'INELIGIBLE' &&
                  validation.reason.type === 'EXCESSIVE_ABSENCE'
                ? '180-day rolling absence limit has been exceeded'
                : undefined
          }
        />
      )}
    </div>
  );
});

SummaryCards.displayName = 'SummaryCards';
