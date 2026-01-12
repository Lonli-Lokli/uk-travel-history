'use client';

import { observer } from 'mobx-react-lite';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  UIIcon,
} from '@uth/ui';
import { goalsStore } from '@uth/stores';
import { CategoryStep } from './CategoryStep';
import { TemplateStep } from './TemplateStep';
import { ConfigureStep } from './ConfigureStep';

// Re-export types from db for consumers
export type { GoalTemplateWithAccess as GoalTemplate } from '@uth/db';
export type GoalCategory = 'immigration' | 'tax' | 'personal';

interface AddGoalModalProps {
  onSuccess?: () => void;
}

const stepTitles = {
  category: 'What would you like to track?',
  template: 'Choose a goal type',
  configure: 'Configure your goal',
} as const;

/**
 * Add Goal Modal - Uses MobX for all state management
 *
 * State is managed in goalsStore:
 * - isAddModalOpen: whether modal is visible
 * - addModalStep: current wizard step
 * - selectedCategory: selected goal category
 * - selectedTemplate: selected template
 * - filteredTemplates: templates filtered by category (computed)
 * - addModalFormData: form field values
 * - isCreating: loading state for goal creation
 * - addModalError: error message
 */
export const AddGoalModal = observer(function AddGoalModal({
  onSuccess,
}: AddGoalModalProps) {
  const {
    isAddModalOpen,
    addModalStep,
    selectedTemplate,
    filteredTemplates,
    isLoadingTemplates,
    isCreating,
    addModalError,
  } = goalsStore;

  const handleOpenChange = (open: boolean) => {
    if (open) {
      goalsStore.openAddModal();
    } else {
      goalsStore.closeAddModal();
    }
  };

  const handleCreate = async () => {
    const goal = await goalsStore.createGoalFromModal();
    if (goal) {
      onSuccess?.();
    }
  };

  return (
    <Dialog open={isAddModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{stepTitles[addModalStep]}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {addModalError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <UIIcon iconName="alert-circle" className="w-4 h-4" />
              {addModalError}
            </div>
          )}

          {addModalStep === 'category' && <CategoryStep />}

          {addModalStep === 'template' && (
            <TemplateStep
              templates={filteredTemplates}
              isLoading={isLoadingTemplates}
            />
          )}

          {addModalStep === 'configure' && selectedTemplate && (
            <ConfigureStep
              template={selectedTemplate}
              isCreating={isCreating}
              onSubmit={handleCreate}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
