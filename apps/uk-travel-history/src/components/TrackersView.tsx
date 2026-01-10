'use client';

/**
 * TrackersView Component
 *
 * Displays all tracking goals in a grid layout.
 * This is the main view shown when the "Trackers" tab is active.
 */

import { observer } from 'mobx-react-lite';
import { cn } from '@uth/utils';
import { goalsStore } from '@uth/stores';
import { GoalCard } from './goals/GoalCard';
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

  // Show empty state if no goals
  if (goals.length === 0) {
    return <NoTrackersEmptyState onAddGoal={onAddGoal} className={className} />;
  }

  // Handle goal card click
  const handleGoalClick = (goalId: string) => {
    goalsStore.setActiveGoal(goalId);
  };

  return (
    <div className={cn('', className)}>
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
