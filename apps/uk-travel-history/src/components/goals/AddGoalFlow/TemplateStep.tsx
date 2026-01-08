'use client';

import { Button, UIIcon, type IconName } from '@uth/ui';
import { cn } from '@uth/utils';
import type { GoalTemplate } from './AddGoalModal';

interface TemplateStepProps {
  templates: GoalTemplate[];
  isLoading: boolean;
  onSelect: (template: GoalTemplate) => void;
  onBack: () => void;
}

export function TemplateStep({ templates, isLoading, onSelect, onBack }: TemplateStepProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No templates available for this category.</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <UIIcon iconName="arrow-left" className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {templates.map((template) => (
          <Button
            key={template.id}
            variant="outline"
            className={cn(
              'w-full justify-between h-auto py-3 px-4',
              template.requiresUpgrade && 'opacity-60',
              !template.requiresUpgrade && 'hover:bg-primary/5 hover:border-primary',
            )}
            onClick={() => onSelect(template)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <UIIcon
                  iconName={(template.icon as IconName) || 'target'}
                  className="w-4 h-4 text-slate-600"
                />
              </div>
              <div className="text-left">
                <p className="font-medium">{template.name}</p>
                {template.description && (
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {template.requiresUpgrade && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  PRO
                </span>
              )}
              <UIIcon iconName="chevron-right" className="w-4 h-4 text-slate-400" />
            </div>
          </Button>
        ))}
      </div>

      <Button variant="ghost" onClick={onBack} className="w-full">
        <UIIcon iconName="arrow-left" className="w-4 h-4 mr-2" />
        Back
      </Button>
    </div>
  );
}
