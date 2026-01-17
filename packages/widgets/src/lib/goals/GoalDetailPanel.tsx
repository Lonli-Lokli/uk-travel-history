'use client';

import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  UIIcon,
} from '@uth/ui';
import { cn, formatDate } from '@uth/utils';
import { goalsStore } from '@uth/stores';
import type { TrackingGoalData, GoalCalculationData } from '@uth/db';
import type { GoalWarning } from '@uth/rules';
import { RiskAreaChart } from './RiskAreaChart';

/**
 * Delete Goal Button with gating logic
 * - Can delete if user has 2+ goals
 * - Cannot delete the last remaining goal (shows disabled state with tooltip)
 */
const DeleteGoalButton = observer(function DeleteGoalButton({
  onClick,
}: {
  onClick: () => void;
}) {
  const activeGoalCount = goalsStore.activeGoalCount;
  const canDelete = activeGoalCount > 1;

  if (!canDelete) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        title="Cannot delete the last goal. You must have at least one active goal."
        className="relative"
      >
        <UIIcon iconName="archive" className="w-4 h-4 opacity-40" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 border border-amber-300">
          <span className="text-[10px] text-amber-700 font-bold">!</span>
        </span>
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={onClick} title="Delete goal">
      <UIIcon iconName="archive" className="w-4 h-4" />
    </Button>
  );
});

/** Status color mapping */
const statusStyles: Record<string, { badge: string; text: string }> = {
  not_started: { badge: 'bg-slate-100 text-slate-700', text: 'Not Started' },
  in_progress: { badge: 'bg-blue-100 text-blue-700', text: 'In Progress' },
  on_track: { badge: 'bg-green-100 text-green-700', text: 'On Track' },
  at_risk: { badge: 'bg-amber-100 text-amber-700', text: 'At Risk' },
  limit_exceeded: { badge: 'bg-red-100 text-red-700', text: 'Limit Exceeded' },
  eligible: { badge: 'bg-emerald-100 text-emerald-700', text: 'Eligible Now' },
  achieved: { badge: 'bg-purple-100 text-purple-700', text: 'Achieved' },
};

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  status?: 'ok' | 'warning' | 'danger';
}

function MetricCard({
  label,
  value,
  subtitle,
  status = 'ok',
}: MetricCardProps) {
  const statusColors = {
    ok: 'bg-slate-50',
    warning: 'bg-amber-50 border-amber-200',
    danger: 'bg-red-50 border-red-200',
  };

  return (
    <div className={cn('p-3 rounded-lg border', statusColors[status])}>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-600">{label}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function ProgressRing({
  percent,
  size = 80,
}: {
  percent: number;
  size?: number;
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  // Color based on progress
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
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
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

/**
 * WarningCard - Icon-based explanation component
 * Shows warning/error with expandable details
 */
function WarningCard({ warning }: { warning: GoalWarning }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = warning.details && warning.details.length > 0;

  const severityStyles = {
    error: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      icon: 'alert-circle' as const,
    },
    warning: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: 'alert-triangle' as const,
    },
    info: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      icon: 'info' as const,
    },
  };

  const style = severityStyles[warning.severity];

  return (
    <div
      className={cn(
        'rounded-lg border text-sm overflow-hidden',
        style.bg,
        style.text,
        style.border,
      )}
    >
      {/* Header - always visible */}
      <div
        className={cn(
          'flex items-start gap-2 p-3',
          hasDetails && 'cursor-pointer hover:bg-black/5',
        )}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <UIIcon
          iconName={style.icon}
          className="w-4 h-4 flex-shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{warning.title}</p>
          <p className="mt-0.5">{warning.message}</p>
        </div>
        {hasDetails && (
          <UIIcon
            iconName={expanded ? 'chevron-up' : 'chevron-down'}
            className="w-4 h-4 flex-shrink-0 mt-0.5"
          />
        )}
      </div>

      {/* Expandable Details */}
      {expanded && hasDetails && (
        <div className="px-3 pb-3 pl-9 space-y-2 border-t border-current/20">
          <div className="pt-2">
            <ul className="space-y-1 list-disc list-inside text-xs">
              {warning.details!.map((detail, i) => (
                <li key={i}>{detail}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export interface GoalDetailPanelProps {
  goal: TrackingGoalData;
  calculation: GoalCalculationData | null;
  onEdit?: () => void;
  onArchive?: () => void;
  className?: string;
}

export const GoalDetailPanel = observer(function GoalDetailPanel({
  goal,
  calculation,
  onEdit,
  onArchive,
  className,
}: GoalDetailPanelProps) {
  const status = calculation?.status ?? 'not_started';
  const statusStyle = statusStyles[status] ?? statusStyles.not_started;
  const progress = calculation?.progressPercent ?? 0;
  const metrics = calculation?.metrics ?? [];
  const warnings = calculation?.warnings ?? [];

  // Format eligibility date
  const eligibilityDateStr = calculation?.eligibilityDate
    ? formatDate(calculation.eligibilityDate, 'ui')
    : 'Not calculated';

  const daysUntil = calculation?.daysUntilEligible ?? null;

  // Get anchor dates from goal config (for UK ILR goals)
  const config = goal.config as {
    visaStartDate?: string;
    vignetteEntryDate?: string;
    type?: string;
  };
  const hasAnchorDates =
    config.type === 'uk_ilr' &&
    (config.visaStartDate || config.vignetteEntryDate);

  return (
    <Card className={cn('border-t-4 border-t-primary', className)}>
      <CardHeader className="pb-4 pt-4 bg-slate-50/50">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <UIIcon
                iconName="chevron-right"
                className="w-4 h-4 text-primary"
              />
              <span className="text-xs font-medium text-primary uppercase tracking-wide">
                Selected Goal
              </span>
            </div>
            <CardTitle className="text-xl">{goal.name}</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  statusStyle.badge,
                )}
              >
                {statusStyle.text}
              </span>
              <span className="text-xs text-muted-foreground">
                Since {formatDate(goal.startDate, 'ui')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                title="Edit goal"
              >
                <UIIcon iconName="pencil" className="w-4 h-4" />
              </Button>
            )}
            {onArchive && <DeleteGoalButton onClick={onArchive} />}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Anchor Dates - for UK ILR goals */}
        {hasAnchorDates && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
              Configuration
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {config.visaStartDate && (
                <div>
                  <p className="text-xs text-slate-600">Visa Start Date</p>
                  <p className="text-sm font-medium text-slate-900">
                    {formatDate(config.visaStartDate, 'ui')}
                  </p>
                </div>
              )}
              {config.vignetteEntryDate && (
                <div>
                  <p className="text-xs text-slate-600">Vignette Entry Date</p>
                  <p className="text-sm font-medium text-slate-900">
                    {formatDate(config.vignetteEntryDate, 'ui')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress and Eligibility */}
        <div className="flex items-center gap-4">
          <ProgressRing percent={progress} />
          <div className="flex-1">
            <p className="text-sm text-slate-600">Eligible</p>
            <p className="text-lg font-semibold text-slate-900">
              {eligibilityDateStr}
            </p>
            {daysUntil !== null && daysUntil > 0 && (
              <p className="text-sm text-muted-foreground">
                {daysUntil} days remaining
              </p>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.key}
                label={metric.label}
                value={`${metric.value}${metric.unit === 'days' ? '' : ` ${metric.unit}`}`}
                subtitle={metric.tooltip}
                status={
                  metric.status === 'ok'
                    ? 'ok'
                    : metric.status === 'warning'
                      ? 'warning'
                      : 'danger'
                }
              />
            ))}
          </div>
        )}

        {/* Explanations - Enhanced with icon-based details */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warning, idx) => (
              <WarningCard key={idx} warning={warning} />
            ))}
          </div>
        )}

        {/* Risk Chart - shows if visualization data available */}
        {calculation?.visualization?.rollingAbsenceData &&
          calculation.visualization.rollingAbsenceData.length > 0 && (
            <div className="mt-4">
              <RiskAreaChart />
            </div>
          )}
      </CardContent>
    </Card>
  );
});

/** Empty state when no goal is selected */
export function GoalEmptyState({ onAddGoal }: { onAddGoal: () => void }) {
  return (
    <Card className="text-center py-8">
      <CardContent className="space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center">
          <UIIcon iconName="target" className="w-8 h-8 text-slate-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Start Tracking Your Time
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Track your days for visa applications, tax purposes, or just to see
            how much you travel.
          </p>
        </div>
        <Button onClick={onAddGoal}>
          <UIIcon iconName="plus" className="w-4 h-4 mr-2" />
          Create Your First Goal
        </Button>
      </CardContent>
    </Card>
  );
}
