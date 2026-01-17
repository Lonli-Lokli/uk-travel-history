'use client';

/**
 * GoalCard Component (Compact Design)
 *
 * Minimal card view showing only goal name and status.
 * All details (metrics, dates, etc.) are shown in GoalDetailPanel when selected.
 */

import { Card, CardContent, GoalTypeIcon } from '@uth/ui';
import { cn } from '@uth/utils';
import type { TrackingGoalData, GoalCalculationData } from '@uth/db';

/** Status color mapping */
const statusColors: Record<
  string,
  { bg: string; badge: string; text: string }
> = {
  not_started: {
    bg: 'bg-slate-50',
    badge: 'bg-slate-100 text-slate-700',
    text: 'Not Started',
  },
  in_progress: {
    bg: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    text: 'In Progress',
  },
  on_track: {
    bg: 'bg-green-50',
    badge: 'bg-green-100 text-green-700',
    text: 'On Track',
  },
  at_risk: {
    bg: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
    text: 'At Risk',
  },
  limit_exceeded: {
    bg: 'bg-red-50',
    badge: 'bg-red-100 text-red-700',
    text: 'Limit Exceeded',
  },
  eligible: {
    bg: 'bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
    text: 'Eligible',
  },
  achieved: {
    bg: 'bg-purple-50',
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

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200',
        colors.bg,
        'border-2',
        isSelected
          ? 'border-primary shadow-lg ring-2 ring-primary ring-opacity-50'
          : 'border-transparent hover:border-primary/50 hover:shadow-md',
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/60 flex items-center justify-center flex-shrink-0">
            <GoalTypeIcon
              goalType={goal.type}
              className="w-5 h-5 sm:w-6 sm:h-6 text-slate-700"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
              {goal.name}
            </h3>
            <span
              className={cn(
                'inline-block px-2 py-0.5 text-xs font-medium rounded-full mt-1',
                colors.badge,
              )}
            >
              {colors.text}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
