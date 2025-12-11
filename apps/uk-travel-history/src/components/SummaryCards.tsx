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
} from 'lucide-react';
import { StatCard } from './StatCard';

export const SummaryCards = observer(() => {
  const summary = travelStore.summary;
  const hasContinuousLeave = summary.continuousLeaveDays !== null;
  const hasILRDate = summary.ilrEligibilityDate !== null;

  const gridColsClass =
    hasContinuousLeave && hasILRDate
      ? 'sm:grid-cols-6'
      : hasContinuousLeave
      ? 'sm:grid-cols-5'
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
          icon={summary.hasExceeded180Days ? AlertTriangle : CalendarDays}
          value={summary.continuousLeaveDays!}
          label="Days in UK"
          variant={summary.hasExceeded180Days ? 'warning' : 'success'}
          subtitle={
            summary.maxAbsenceInAny12Months !== null && (
              <>
                Max 12mo: {summary.maxAbsenceInAny12Months}d{' '}
                {summary.hasExceeded180Days && '⚠️'}
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
    </div>
  );
});

SummaryCards.displayName = 'SummaryCards';
