'use client';

import { observer } from 'mobx-react-lite';
import { travelStore } from '@uth/ui';
import { formatDate } from '@uth/utils';
import {
  Plane,
  AlertTriangle,
  Target,
  Clock,
} from 'lucide-react';
import { StatCard } from './StatCard';
import { CompoundStatCard } from './CompoundStatCard';

export const SummaryCards = observer(() => {
  const summary = travelStore.summary;
  const validation = travelStore.validation;
  const hasContinuousLeave = summary.continuousLeaveDays !== null;
  // Show ILR date card when ELIGIBLE, show warning card when not eligible
  const hasILRDate = validation?.status === 'ELIGIBLE' && summary.ilrEligibilityDate !== null;
  const isNotEligible = validation?.status === 'NOT_ELIGIBLE' && hasContinuousLeave;
  // Show today's quota card when we have the data
  const hasTodayQuota = summary.remaining180LimitToday !== null;

  const gridColsClass =
    (hasILRDate || isNotEligible) && hasTodayQuota
      ? 'sm:grid-cols-1 lg:grid-cols-3'
      : hasILRDate || isNotEligible || hasTodayQuota
      ? 'sm:grid-cols-1 lg:grid-cols-2'
      : 'sm:grid-cols-1';

  return (
    <div className={`grid grid-cols-1 ${gridColsClass} gap-2 mb-3`}>
      {/* Combined Travel History & Time Tracking Card */}
      {hasContinuousLeave ? (
        <CompoundStatCard
          icon={summary.hasExceededAllowedAbsense ? AlertTriangle : Plane}
          title="Travel History & Time Tracking"
          stats={[
            { value: summary.totalTrips, label: 'Total Trips' },
            { value: summary.completeTrips, label: 'Complete', variant: 'success' },
            { value: summary.incompleteTrips, label: 'Incomplete', variant: summary.incompleteTrips > 0 ? 'warning' : 'default' },
            { value: summary.totalFullDays, label: 'Days Outside' },
            { value: summary.continuousLeaveDays!, label: 'Days in UK', variant: summary.hasExceededAllowedAbsense ? 'warning' : 'success' },
            { value: summary.maxAbsenceInAny12Months ?? '—', label: 'Max 12mo', variant: summary.hasExceededAllowedAbsense ? 'warning' : 'default' },
          ]}
          variant={summary.hasExceededAllowedAbsense ? 'warning' : 'neutral'}
          subtitle={
            summary.hasExceededAllowedAbsense && (
              <>
                ⚠️ 180-day limit exceeded in a rolling 12-month period
              </>
            )
          }
        />
      ) : (
        <CompoundStatCard
          icon={Plane}
          title="Travel History"
          stats={[
            { value: summary.totalTrips, label: 'Total Trips' },
            { value: summary.completeTrips, label: 'Complete', variant: 'success' },
            { value: summary.incompleteTrips, label: 'Incomplete', variant: summary.incompleteTrips > 0 ? 'warning' : 'default' },
            { value: summary.totalFullDays, label: 'Days Outside UK' },
          ]}
          variant="neutral"
        />
      )}

      {isNotEligible && (
        <StatCard
          icon={AlertTriangle}
          value="NOT ELIGIBLE"
          label="ILR Status"
          variant="warning"
          subtitle="Rolling 12-month absence limit exceeded"
        />
      )}

      {hasILRDate && summary.ilrEligibilityDate && (
        <StatCard
          icon={Target}
          value={formatDate(summary.ilrEligibilityDate)}
          label="ILR Eligible"
          variant={
            summary.daysUntilEligible !== null && summary.daysUntilEligible < 0
              ? 'success'
              : 'purple'
          }
          subtitle={
            summary.daysUntilEligible !== null && (
              <>
                {summary.daysUntilEligible < 0 ? (
                  <>
                    Eligible now! ({Math.abs(summary.daysUntilEligible)}d ago)
                  </>
                ) : summary.daysUntilEligible === 0 ? (
                  <>Today!</>
                ) : (
                  <>{summary.daysUntilEligible}d remaining</>
                )}
              </>
            )
          }
        />
      )}

      {hasTodayQuota && summary.remaining180LimitToday !== null && (
        <StatCard
          icon={Clock}
          value={summary.remaining180LimitToday}
          label="Today's 180-Day Limit"
          variant={
            summary.remaining180LimitToday <= 0
              ? 'warning'
              : summary.remaining180LimitToday < 30
              ? 'warning'
              : 'success'
          }
          subtitle={
            summary.currentRollingAbsenceToday !== null && (
              <>
                {summary.currentRollingAbsenceToday}d absent in rolling 12mo
              </>
            )
          }
        />
      )}
    </div>
  );
});

SummaryCards.displayName = 'SummaryCards';
