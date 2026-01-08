'use client';

import { Card, CardContent, UIIcon, type IconName } from '@uth/ui';
import { cn } from '@uth/utils';
import type { TrackingGoalData, GoalCalculationData } from '@uth/db';

/** Status color mapping */
const statusColors: Record<string, { bg: string; dot: string; text: string }> =
  {
    not_started: {
      bg: 'bg-slate-100',
      dot: 'bg-slate-400',
      text: 'text-slate-600',
    },
    in_progress: {
      bg: 'bg-blue-50',
      dot: 'bg-blue-500',
      text: 'text-blue-700',
    },
    on_track: {
      bg: 'bg-green-50',
      dot: 'bg-green-500',
      text: 'text-green-700',
    },
    at_risk: { bg: 'bg-amber-50', dot: 'bg-amber-500', text: 'text-amber-700' },
    limit_exceeded: {
      bg: 'bg-red-50',
      dot: 'bg-red-500',
      text: 'text-red-700',
    },
    eligible: {
      bg: 'bg-emerald-50',
      dot: 'bg-emerald-500',
      text: 'text-emerald-700',
    },
    achieved: {
      bg: 'bg-purple-50',
      dot: 'bg-purple-500',
      text: 'text-purple-700',
    },
  };

/** Status display labels */
const statusLabels: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  on_track: 'On Track',
  at_risk: 'At Risk',
  limit_exceeded: 'Limit Exceeded',
  eligible: 'Eligible',
  achieved: 'Achieved',
};

/** Goal type to icon mapping */
const goalTypeIcons: Record<string, IconName> = {
  uk_ilr: 'home',
  uk_citizenship: 'uk-flag',
  uk_tax_residency: 'calculator',
  schengen_90_180: 'eu-flag',
  days_counter: 'calendar',
  custom_threshold: 'settings',
};

export interface GoalMiniCardProps {
  goal: TrackingGoalData;
  calculation: GoalCalculationData | null;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}

export function GoalMiniCard({
  goal,
  calculation,
  isSelected,
  onClick,
  className,
}: GoalMiniCardProps) {
  const status = calculation?.status ?? 'not_started';
  const colors = statusColors[status] ?? statusColors.not_started;
  const statusLabel = statusLabels[status] ?? 'Unknown';
  const icon = goalTypeIcons[goal.type] ?? 'target';
  const progress = calculation?.progressPercent ?? 0;

  // Format progress percentage
  const progressDisplay = progress > 0 ? `${Math.round(progress)}%` : '--';

  // Truncate goal name to fit
  const displayName =
    goal.name.length > 12 ? `${goal.name.slice(0, 11)}...` : goal.name;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md',
        'min-w-[100px] w-[100px] flex-shrink-0',
        isSelected && 'ring-2 ring-primary ring-offset-1',
        colors.bg,
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-2">
        <div className="flex flex-col items-center gap-1 text-center">
          {/* Icon + Progress */}
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center">
              <UIIcon iconName={icon} className="w-4 h-4 text-slate-700" />
            </div>
            {/* Progress badge */}
            <div className="absolute -top-1 -right-1 text-[10px] font-bold bg-white rounded-full px-1 shadow-sm">
              {progressDisplay}
            </div>
          </div>

          {/* Goal name */}
          <p className="text-xs font-medium text-slate-700 leading-tight truncate w-full">
            {displayName}
          </p>

          {/* Status indicator */}
          <div className={cn('flex items-center gap-1', colors.text)}>
            <div className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
            <span className="text-[10px] font-medium leading-tight">
              {statusLabel}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
