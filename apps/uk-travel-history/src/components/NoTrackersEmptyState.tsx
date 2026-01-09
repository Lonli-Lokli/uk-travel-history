'use client';

/**
 * NoTrackersEmptyState Component
 *
 * Displayed when the user has no tracking goals configured.
 * Encourages users to add their first goal/tracker.
 */

import { cn } from '@uth/utils';
import { UIIcon } from '@uth/ui';

export interface NoTrackersEmptyStateProps {
  className?: string;
  onAddGoal: () => void;
}

export function NoTrackersEmptyState({
  className,
  onAddGoal,
}: NoTrackersEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'min-h-[400px] px-4 py-12',
        'bg-slate-50 border border-slate-200 rounded-lg',
        className,
      )}
    >
      <div className="w-16 h-16 mb-4 rounded-full bg-slate-200 flex items-center justify-center">
        <UIIcon iconName="target" className="w-8 h-8 text-slate-400" />
      </div>

      <h2 className="text-xl font-semibold text-slate-900 mb-2">
        No Trackers Yet
      </h2>

      <p className="text-sm text-slate-600 text-center max-w-md mb-6">
        Get started by adding your first tracker. Track UK immigration goals,
        tax residency, Schengen stays, or create custom trackers for your needs.
      </p>

      <button
        onClick={onAddGoal}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
        type="button"
      >
        Add Your First Tracker
      </button>
    </div>
  );
}
