'use client';

import { observer } from 'mobx-react-lite';
import { Button, Input, Label, UIIcon } from '@uth/ui';
import { goalsStore } from '@uth/stores';
import type { GoalTemplateWithAccess } from '@uth/db';

interface ConfigureStepProps {
  template: GoalTemplateWithAccess;
  isCreating: boolean;
  onSubmit: () => void;
}

/** Field configuration based on required fields */
const fieldConfigs: Record<
  string,
  { label: string; type: string; placeholder: string; required?: boolean }
> = {
  name: { label: 'Goal Name', type: 'text', placeholder: 'e.g., UK ILR 2027' },
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
    required: true,
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
    required: true,
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
 * Configure step - uses goalsStore for form state
 */
export const ConfigureStep = observer(function ConfigureStep({
  template,
  isCreating,
  onSubmit,
}: ConfigureStepProps) {
  const formData = goalsStore.addModalFormData;

  const handleChange = (field: string, value: string) => {
    goalsStore.setFormField(field, value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  // Determine which fields to show
  const fieldsToShow = ['name', 'startDate', ...template.requiredFields];

  // Add optional fields based on template type
  if (template.type === 'uk_ilr') {
    if (!fieldsToShow.includes('visaStartDate')) {
      fieldsToShow.push('visaStartDate');
    }
    fieldsToShow.push('vignetteEntryDate');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fieldsToShow.map((fieldKey) => {
        const config = fieldConfigs[fieldKey];
        if (!config) return null;

        const isRequired =
          config.required || template.requiredFields.includes(fieldKey);

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
              value={formData[fieldKey] || ''}
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
          onClick={() => goalsStore.goBackInModal()}
          className="flex-1"
        >
          <UIIcon iconName="arrow-left" className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button type="submit" disabled={isCreating} className="flex-1">
          {isCreating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Creating...
            </>
          ) : (
            <>
              Create Goal
              <UIIcon iconName="arrow-right" className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
});
