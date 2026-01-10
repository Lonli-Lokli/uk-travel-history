'use client';

/**
 * GoalCard Component
 *
 * Larger card view for goals displayed in the Trackers tab.
 * Shows more detail than GoalMiniCard, including progress ring, metrics, and status.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  GoalTypeIcon,
} from '@uth/ui';
import { cn } from '@uth/utils';
import type { TrackingGoalData, GoalCalculationData } from '@uth/db';
import { format } from 'date-fns';

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

interface ProgressRingProps {
  percent: number;
  size?: number;
}

function ProgressRing({ percent, size = 80 }: ProgressRingProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const getColor = () => {
    if (percent >= 100) return '#10b981'; // emerald-500
    if (percent >= 75) return '#22c55e'; // green-500
    if (percent >= 50) return '#3b82f6'; // blue-500
    if (percent >= 25) return '#f59e0b'; // amber-500
    return '#6b7280'; // gray-500
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-slate-700">
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}

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

  const eligibilityDateStr = calculation?.eligibilityDate
    ? format(new Date(calculation.eligibilityDate), 'MMM d, yyyy')
    : 'Not calculated';

  const daysUntil = calculation?.daysUntilEligible ?? null;

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
      <CardHeader className="pb-3 pt-3 px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/60 flex items-center justify-center flex-shrink-0">
            <GoalTypeIcon
              goalType={goal.type}
              className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700"
            />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm sm:text-base truncate">
              {goal.name}
            </CardTitle>
            <span
              className={cn(
                'inline-block px-1.5 py-0.5 text-xs font-medium rounded-full mt-0.5',
                colors.badge,
              )}
            >
              {colors.text}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-3 px-3 sm:px-4">
        <div className="flex items-center gap-3">
          <ProgressRing percent={progress} size={50} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-600">Eligible</p>
            <p className="text-sm font-semibold text-slate-900 truncate">
              {eligibilityDateStr}
            </p>
            {daysUntil !== null && daysUntil > 0 && (
              <p className="text-xs text-muted-foreground">
                {daysUntil} days
              </p>
            )}
          </div>
        </div>

        {/* Quick metrics - show max 2 on mobile */}
        {calculation?.metrics && calculation.metrics.length > 0 && (
          <div className="mt-2 flex gap-2">
            {calculation.metrics.slice(0, 2).map((metric) => (
              <div
                key={metric.key}
                className="flex-1 bg-white/60 rounded-md p-2"
              >
                <p className="text-xs text-slate-600 truncate">{metric.label}</p>
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {metric.value}
                  {metric.unit !== 'days' && ` ${metric.unit}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
