'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  UIIcon,
  type IconName,
} from '@uth/ui';
import { cn } from '@uth/utils';
import { goalsStore } from '@uth/stores';
import type { CreateTrackingGoalData, GoalType, GoalJurisdiction } from '@uth/db';
import { CategoryStep } from './CategoryStep';
import { TemplateStep } from './TemplateStep';
import { ConfigureStep } from './ConfigureStep';

export type GoalCategory = 'immigration' | 'tax' | 'personal';

export interface GoalTemplate {
  id: string;
  jurisdiction: string;
  category: string;
  name: string;
  description: string | null;
  icon: string;
  type: string;
  defaultConfig: Record<string, unknown>;
  requiredFields: string[];
  isAvailableForTier: boolean;
  requiresUpgrade: boolean;
}

interface AddGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type WizardStep = 'category' | 'template' | 'configure';

export function AddGoalModal({ open, onOpenChange, onSuccess }: AddGoalModalProps) {
  const [step, setStep] = useState<WizardStep>('category');
  const [selectedCategory, setSelectedCategory] = useState<GoalCategory | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<GoalTemplate | null>(null);
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('category');
      setSelectedCategory(null);
      setSelectedTemplate(null);
      setError(null);
    }
  }, [open]);

  // Load templates when category is selected
  useEffect(() => {
    if (selectedCategory) {
      loadTemplates();
    }
  }, [selectedCategory]);

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await fetch('/api/goals/templates');
      const data = await response.json();
      if (response.ok) {
        // Filter by selected category
        const filtered = data.templates.filter(
          (t: GoalTemplate) => t.category === selectedCategory,
        );
        setTemplates(filtered);
      } else {
        setError(data.error || 'Failed to load templates');
      }
    } catch (err) {
      setError('Failed to load templates');
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleCategorySelect = (category: GoalCategory) => {
    setSelectedCategory(category);
    setStep('template');
  };

  const handleTemplateSelect = (template: GoalTemplate) => {
    if (template.requiresUpgrade) {
      // Could trigger upgrade flow here
      return;
    }
    setSelectedTemplate(template);
    setStep('configure');
  };

  const handleBack = () => {
    if (step === 'template') {
      setStep('category');
      setSelectedCategory(null);
    } else if (step === 'configure') {
      setStep('template');
      setSelectedTemplate(null);
    }
  };

  const handleCreate = async (config: Record<string, unknown>) => {
    if (!selectedTemplate) return;

    setIsCreating(true);
    setError(null);

    try {
      const goalData: CreateTrackingGoalData = {
        type: selectedTemplate.type as GoalType,
        jurisdiction: selectedTemplate.jurisdiction as GoalJurisdiction,
        name: (config.name as string) || selectedTemplate.name,
        config: { ...selectedTemplate.defaultConfig, ...config },
        startDate: (config.startDate as string) || new Date().toISOString().split('T')[0],
      };

      const goal = await goalsStore.createGoal(goalData);

      if (goal) {
        onSuccess?.();
        onOpenChange(false);
      } else {
        setError(goalsStore.error || 'Failed to create goal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal');
    } finally {
      setIsCreating(false);
    }
  };

  const stepTitles: Record<WizardStep, string> = {
    category: 'What would you like to track?',
    template: 'Choose a goal type',
    configure: 'Configure your goal',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{stepTitles[step]}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <UIIcon iconName="alert-circle" className="w-4 h-4" />
              {error}
            </div>
          )}

          {step === 'category' && (
            <CategoryStep onSelect={handleCategorySelect} />
          )}

          {step === 'template' && (
            <TemplateStep
              templates={templates}
              isLoading={isLoadingTemplates}
              onSelect={handleTemplateSelect}
              onBack={handleBack}
            />
          )}

          {step === 'configure' && selectedTemplate && (
            <ConfigureStep
              template={selectedTemplate}
              isCreating={isCreating}
              onSubmit={handleCreate}
              onBack={handleBack}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
