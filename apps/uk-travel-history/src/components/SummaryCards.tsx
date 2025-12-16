'use client';

import { observer } from 'mobx-react-lite';
import { travelStore } from '@uth/ui';
import { formatDate } from '@uth/utils';
import {
  Plane,
  CalendarDays,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Target,
  Clock,
} from 'lucide-react';
import { StatCard } from './StatCard';

export const SummaryCards = observer(() => {
  const summary = travelStore.summary;
  const validation = travelStore.validation;
  const hasContinuousLeave = summary.continuousLeaveDays !== null;
  // Only show ILR date card when ELIGIBLE (not just when date exists)
  const hasILRDate = validation?.status === 'ELIGIBLE' && summary.ilrEligibilityDate !== null;
  // Show today's quota card when we have the data
  const hasTodayQuota = summary.remaining180LimitToday !== null;

  const gridColsClass =
    hasContinuousLeave && hasILRDate && hasTodayQuota
      ? 'sm:grid-cols-4 lg:grid-cols-7'
      : hasContinuousLeave && hasILRDate
      ? 'sm:grid-cols-3 lg:grid-cols-6'
      : hasContinuousLeave
      ? 'sm:grid-cols-4 lg:grid-cols-5'
      : 'sm:grid-cols-4';

  return (
    <div className={`grid grid-cols-2 ${gridColsClass} gap-2 mb-3`}>
      <StatCard
        icon={Plane}
        value={summary.totalTrips}
        label="Total Trips"
        variant="default"
      />

      <StatCard
        icon={CheckCircle}
        value={summary.completeTrips}
        label="Complete"
        variant="default"
      />

      <StatCard
        icon={AlertCircle}
        value={summary.incompleteTrips}
        label="Incomplete"
        variant="default"
      />

      <StatCard
        icon={CalendarDays}
        value={summary.totalFullDays}
        label="Days Outside UK"
        variant="primary"
      />

      {hasContinuousLeave && (
        <StatCard
          icon={summary.hasExceededAllowedAbsense ? AlertTriangle : CalendarDays}
          value={summary.continuousLeaveDays!}
          label="Days in UK"
          variant={summary.hasExceededAllowedAbsense ? 'warning' : 'success'}
          subtitle={
            summary.maxAbsenceInAny12Months !== null && (
              <>
                Max 12mo: {summary.maxAbsenceInAny12Months}d{' '}
                {summary.hasExceededAllowedAbsense && '⚠️'}
              </>
            )
          }
          className="col-span-2 sm:col-span-1"
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
          className="col-span-2 sm:col-span-1"
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
          className="col-span-2 sm:col-span-1"
        />
      )}
    </div>
  );
});

SummaryCards.displayName = 'SummaryCards';
