'use client';

import { observer } from 'mobx-react-lite';
import { travelStore, Card, CardContent } from '@uth/ui';
import { formatDate } from '@uth/utils';
import {
  Plane,
  CalendarDays,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Target,
} from 'lucide-react';

export const SummaryCards = observer(() => {
  const summary = travelStore.summary;
  const hasContinuousLeave = summary.continuousLeaveDays !== null;
  const hasILRDate = summary.ilrEligibilityDate !== null;

  const gridColsClass = hasContinuousLeave && hasILRDate ? 'sm:grid-cols-6' : hasContinuousLeave ? 'sm:grid-cols-5' : 'sm:grid-cols-4';

  return (
    <div className={`grid grid-cols-2 ${gridColsClass} gap-2 sm:gap-4 mb-4 sm:mb-6`}>
      <Card className="bg-white">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Plane className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-slate-900">
                {summary.totalTrips}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Total Trips
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-slate-900">
                {summary.completeTrips}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Complete
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-slate-900">
                {summary.incompleteTrips}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Incomplete
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold">
                {summary.totalFullDays}
              </p>
              <p className="text-[10px] sm:text-xs opacity-80">
                Days Outside UK
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasContinuousLeave && (
        <Card className={`col-span-2 sm:col-span-1 ${summary.hasExceeded180Days ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'} text-white`}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                {summary.hasExceeded180Days ? (
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-lg sm:text-2xl font-bold">
                  {summary.continuousLeaveDays}
                </p>
                <p className="text-[10px] sm:text-xs opacity-90">
                  Days in UK
                </p>
                {summary.maxAbsenceInAny12Months !== null && (
                  <p className="text-[9px] sm:text-[10px] opacity-75 mt-0.5">
                    Max 12mo: {summary.maxAbsenceInAny12Months}d {summary.hasExceeded180Days && '⚠️'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasILRDate && summary.ilrEligibilityDate && (
        <Card className={`col-span-2 sm:col-span-1 ${summary.daysUntilEligible !== null && summary.daysUntilEligible < 0 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-purple-500 to-indigo-600'} text-white`}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Target className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-bold">
                  {formatDate(summary.ilrEligibilityDate)}
                </p>
                <p className="text-[10px] sm:text-xs opacity-90">
                  ILR Eligible
                </p>
                {summary.daysUntilEligible !== null && (
                  <p className="text-[9px] sm:text-[10px] opacity-75 mt-0.5">
                    {summary.daysUntilEligible < 0 ? (
                      <>Eligible now! ({Math.abs(summary.daysUntilEligible)}d ago)</>
                    ) : summary.daysUntilEligible === 0 ? (
                      <>Today!</>
                    ) : (
                      <>{summary.daysUntilEligible}d remaining</>
                    )}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
});

SummaryCards.displayName = 'SummaryCards';
