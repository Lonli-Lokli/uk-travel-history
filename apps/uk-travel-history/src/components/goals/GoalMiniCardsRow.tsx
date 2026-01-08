'use client';

import { observer } from 'mobx-react-lite';
import { Button } from '@uth/ui';
import { UIIcon } from '@uth/ui';
import { FeatureButton, useFeatureGate } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';
import { goalsStore } from '@uth/stores';
import { cn } from '@uth/utils';
import { GoalMiniCard } from './GoalMiniCard';

export interface GoalMiniCardsRowProps {
  onAddGoal: () => void;
  onUpgrade: () => void;
  className?: string;
}

export const GoalMiniCardsRow = observer(function GoalMiniCardsRow({
  onAddGoal,
  onUpgrade,
  className,
}: GoalMiniCardsRowProps) {
  const { hasAccess: isPremium } = useFeatureGate(
    FEATURE_KEYS.MULTI_GOAL_TRACKING,
  );
  const goals = goalsStore.activeGoals;
  const activeGoalId = goalsStore.activeGoalId;

  // Free tier can have 1 goal, Premium unlimited
  const canAddMore = isPremium || goals.length < 1;

  const handleGoalSelect = (goalId: string) => {
    goalsStore.setActiveGoal(goalId);
  };

  return (
    <div className={cn('relative', className)}>
      {/* Scrollable container */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
        {/* Goal cards */}
        {goals.map((goal) => (
          <GoalMiniCard
            key={goal.id}
            goal={goal}
            calculation={goalsStore.calculations.get(goal.id) ?? null}
            isSelected={goal.id === activeGoalId}
            onClick={() => handleGoalSelect(goal.id)}
          />
        ))}

        {/* Add goal button */}
        {canAddMore ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddGoal}
            className={cn(
              'min-w-[100px] w-[100px] h-[70px] flex-shrink-0',
              'flex flex-col items-center justify-center gap-1',
              'border-dashed border-2 hover:border-primary hover:bg-primary/5',
            )}
          >
            <UIIcon iconName="plus" className="w-4 h-4" />
            <span className="text-xs">Add Goal</span>
          </Button>
        ) : (
          <FeatureButton
            feature={FEATURE_KEYS.MULTI_GOAL_TRACKING}
            onClick={onUpgrade}
            variant="outline"
            size="sm"
            className={cn(
              'min-w-[100px] w-[100px] h-[70px] flex-shrink-0',
              'flex flex-col items-center justify-center gap-1',
              'border-dashed border-2',
            )}
          >
            <UIIcon iconName="lock" className="w-4 h-4" />
            <span className="text-xs text-center leading-tight">
              Upgrade for more
            </span>
          </FeatureButton>
        )}
      </div>

      {/* Scroll indicators (visual hint) */}
      {goals.length > 3 && (
        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
      )}
    </div>
  );
});
