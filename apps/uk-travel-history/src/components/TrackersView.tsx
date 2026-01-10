'use client';

/**
 * TrackersView Component
 *
 * Displays all tracking goals in a grid layout.
 * This is the main view shown when the "Trackers" tab is active.
 */

import { observer } from 'mobx-react-lite';
import { cn } from '@uth/utils';
import { goalsStore, useRefreshAccessContext } from '@uth/stores';
import { GoalCard } from './goals/GoalCard';
import { GoalDetailPanel } from './goals/GoalDetailPanel';
import { NoTrackersEmptyState } from './NoTrackersEmptyState';

export interface TrackersViewProps {
  className?: string;
  onAddGoal: () => void;
}

export const TrackersView = observer(function TrackersView({
  className,
  onAddGoal,
}: TrackersViewProps) {
  const goals = goalsStore.goals;
  const calculations = goalsStore.calculations;
  const activeGoal = goalsStore.activeGoal;
  const activeCalculation = goalsStore.activeCalculation;
  const refreshAccessContext = useRefreshAccessContext();

  // Show empty state if no goals
  if (goals.length === 0) {
    return <NoTrackersEmptyState onAddGoal={onAddGoal} className={className} />;
  }

  // Handle goal card click
  const handleGoalClick = (goalId: string) => {
    goalsStore.setActiveGoal(goalId);
  };

  // Handle edit button click
  const handleEdit = (goalId: string) => {
    goalsStore.openEditModal(goalId);
  };

  // Handle delete button click
  const handleArchive = async (goalId: string) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      const success = await goalsStore.archiveGoal(goalId);
      if (success) {
        // Trigger server-side re-hydration to get fresh calculations
        refreshAccessContext();
      }
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Active goal detail panel (if a goal is selected) */}
      {activeGoal && (
        <GoalDetailPanel
          goal={activeGoal}
          calculation={activeCalculation}
          onEdit={() => handleEdit(activeGoal.id)}
          onArchive={() => handleArchive(activeGoal.id)}
        />
      )}

      {/* Goal cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map((goal) => {
          const calculation = calculations.get(goal.id) ?? null;
          return (
            <GoalCard
              key={goal.id}
              goal={goal}
              calculation={calculation}
              onClick={() => handleGoalClick(goal.id)}
            />
          );
        })}
      </div>
    </div>
  );
});
