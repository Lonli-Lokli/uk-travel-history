'use client';

/**
 * GoalCard Component (Compact Design)
 *
 * Minimal card view showing only goal name and status.
 * All details (metrics, dates, etc.) are shown in GoalDetailPanel when selected.
 */

import { Card, CardContent, GoalTypeIcon, UIIcon } from '@uth/ui';
import { cn } from '@uth/utils';
import type { TrackingGoalData, GoalCalculationData } from '@uth/db';

/** Status color mapping - uses left border instead of full background */
const statusColors: Record<
  string,
  { border: string; badge: string; text: string }
> = {
  not_started: {
    border: 'border-l-slate-400',
    badge: 'bg-slate-100 text-slate-700',
    text: 'Not Started',
  },
  in_progress: {
    border: 'border-l-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    text: 'In Progress',
  },
  on_track: {
    border: 'border-l-green-500',
    badge: 'bg-green-100 text-green-700',
    text: 'On Track',
  },
  at_risk: {
    border: 'border-l-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    text: 'At Risk',
  },
  limit_exceeded: {
    border: 'border-l-red-500',
    badge: 'bg-red-100 text-red-700',
    text: 'Limit Exceeded',
  },
  eligible: {
    border: 'border-l-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
    text: 'Eligible',
  },
  achieved: {
    border: 'border-l-purple-500',
    badge: 'bg-purple-100 text-purple-700',
    text: 'Achieved',
  },
};

export interface GoalCardProps {
  goal: TrackingGoalData;
  calculation: GoalCalculationData | null;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
}

export function GoalCard({
  goal,
  calculation,
  onClick,
  isSelected = false,
  className,
}: GoalCardProps) {
  const status = calculation?.status ?? 'not_started';
  const colors = statusColors[status] ?? statusColors.not_started;
  const progress = calculation?.progressPercent ?? 0;

  // Format eligibility date
  const eligibilityDate = goal.targetDate || calculation?.eligibilityDate;
  const isOverride = !!goal.targetDate;
  const daysUntil = calculation?.daysUntilEligible ?? null;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200',
        'bg-white hover:bg-slate-50',
        'border-l-4',
        colors.border,
        isSelected
          ? 'shadow-lg ring-2 ring-primary ring-opacity-50'
          : 'hover:shadow-md',
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-2.5 sm:p-3">
        {/* Header: Icon + Name + Override Badge */}
        <div className="flex items-start gap-2 mb-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <GoalTypeIcon
              goalType={goal.type}
              className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate leading-tight">
              {goal.name}
            </h3>
            {isOverride && (
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] sm:text-xs font-medium rounded bg-amber-100 text-amber-700 border border-amber-300"
                  title="Custom eligible date override"
                >
                  <UIIcon iconName="pencil" className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span className="hidden sm:inline">Override</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Progress + Status + Eligibility Date */}
        <div className="space-y-1.5">
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-500 rounded-full',
                  status === 'eligible' || status === 'achieved'
                    ? 'bg-emerald-500'
                    : status === 'on_track'
                      ? 'bg-green-500'
                      : status === 'at_risk'
                        ? 'bg-amber-500'
                        : status === 'limit_exceeded'
                          ? 'bg-red-500'
                          : 'bg-blue-500',
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-700 tabular-nums min-w-[32px] text-right">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Status + Eligibility Date */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span
              className={cn(
                'inline-block px-1.5 py-0.5 font-medium rounded',
                colors.badge,
              )}
            >
              {colors.text}
            </span>
            {eligibilityDate && (
              <div className="text-right">
                <p className={cn('font-medium', isOverride ? 'text-amber-700' : 'text-slate-700')}>
                  {new Date(eligibilityDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
                {daysUntil !== null && daysUntil > 0 && (
                  <p className="text-[10px] text-slate-500">
                    {daysUntil}d left
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
