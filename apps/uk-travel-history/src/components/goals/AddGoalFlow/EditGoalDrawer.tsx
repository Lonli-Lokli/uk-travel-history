'use client';

/**
 * EditGoalDrawer - Drawer for editing existing goals
 *
 * Similar to AddGoalDrawer but simplified for editing.
 * State is managed in goalsStore using MobX.
 */

import { observer } from 'mobx-react-lite';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Button,
  Input,
  Label,
  UIIcon,
} from '@uth/ui';
import { goalsStore, useRefreshAccessContext } from '@uth/stores';

interface EditGoalDrawerProps {
  onSuccess?: () => void;
}

/** Field configuration for editing */
const fieldConfigs: Record<
  string,
  { label: string; type: string; placeholder: string; required?: boolean }
> = {
  name: { label: 'Goal Name', type: 'text', placeholder: 'e.g., UK ILR 2027', required: true },
  startDate: {
    label: 'Start Date',
    type: 'date',
    placeholder: '',
    required: true,
  },
  visaStartDate: {
    label: 'Visa Start Date',
    type: 'date',
    placeholder: '',
  },
  vignetteEntryDate: {
    label: 'Vignette Entry Date',
    type: 'date',
    placeholder: '',
  },
  ilrGrantDate: {
    label: 'ILR Grant Date',
    type: 'date',
    placeholder: '',
  },
  taxYear: { label: 'Tax Year', type: 'text', placeholder: 'e.g., 2024-25' },
  thresholdDays: {
    label: 'Day Limit',
    type: 'number',
    placeholder: 'e.g., 180',
  },
  windowDays: {
    label: 'Window (days)',
    type: 'number',
    placeholder: 'e.g., 365',
  },
  referenceLocation: {
    label: 'Reference Location',
    type: 'text',
    placeholder: 'e.g., UK',
  },
};

/**
 * Edit Goal Drawer - Uses MobX for all state management
 *
 * State is managed in goalsStore:
 * - isEditModalOpen: whether drawer is visible
 * - editingGoalId: ID of goal being edited
 * - editModalFormData: form field values
 * - isUpdating: loading state for goal update
 * - editModalError: error message
 */
export const EditGoalDrawer = observer(function EditGoalDrawer({
  onSuccess,
}: EditGoalDrawerProps) {
  const {
    isEditModalOpen,
    editingGoalId,
    editModalFormData,
    isUpdating,
    editModalError,
  } = goalsStore;

  const refreshAccessContext = useRefreshAccessContext();

  const editingGoal = editingGoalId
    ? goalsStore.goals.find((g) => g.id === editingGoalId)
    : null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      goalsStore.closeEditModal();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await goalsStore.updateGoalFromModal();
    if (success) {
      // Trigger server-side re-hydration to get fresh calculations
      refreshAccessContext();
      onSuccess?.();
    }
  };

  const handleChange = (field: string, value: string) => {
    goalsStore.setEditFormField(field, value);
  };

  if (!editingGoal) return null;

  // Determine which fields to show based on goal type
  const fieldsToShow = ['name', 'startDate'];

  // Add type-specific fields
  if (editingGoal.type === 'uk_ilr') {
    fieldsToShow.push('visaStartDate', 'vignetteEntryDate');
  }

  // Add config fields if they exist
  if (editingGoal.config) {
    Object.keys(editingGoal.config).forEach(key => {
      if (!fieldsToShow.includes(key) && fieldConfigs[key]) {
        fieldsToShow.push(key);
      }
    });
  }

  return (
    <Drawer open={isEditModalOpen} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Edit Goal</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6">
          {editModalError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <UIIcon iconName="alert-circle" className="w-4 h-4" />
              {editModalError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {fieldsToShow.map((fieldKey) => {
              const config = fieldConfigs[fieldKey];
              if (!config) return null;

              const isRequired = config.required || fieldKey === 'name' || fieldKey === 'startDate';

              return (
                <div key={fieldKey} className="space-y-1.5">
                  <Label htmlFor={fieldKey}>
                    {config.label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Input
                    id={fieldKey}
                    type={config.type}
                    placeholder={config.placeholder}
                    value={editModalFormData[fieldKey] || ''}
                    onChange={(e) => handleChange(fieldKey, e.target.value)}
                    required={isRequired}
                  />
                </div>
              );
            })}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => goalsStore.closeEditModal()}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating} className="flex-1">
                {isUpdating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
});
