'use client';

import { Button, UIIcon, type IconName } from '@uth/ui';
import { cn } from '@uth/utils';
import { goalsStore } from '@uth/stores';

interface CategoryOption {
  id: 'immigration' | 'tax' | 'personal';
  name: string;
  description: string;
  icon: IconName;
}

const categories: CategoryOption[] = [
  {
    id: 'immigration',
    name: 'Immigration',
    description: 'Visa, residency, citizenship',
    icon: 'home',
  },
  {
    id: 'tax',
    name: 'Tax',
    description: 'Tax years, SRT',
    icon: 'calculator',
  },
  {
    id: 'personal',
    name: 'Personal',
    description: 'Days away, custom goals',
    icon: 'calendar',
  },
];

/**
 * Category selection step - uses goalsStore.selectCategory action
 */
export function CategoryStep() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {categories.map((category) => (
        <Button
          key={category.id}
          variant="outline"
          className={cn(
            'h-auto py-4 flex flex-col items-center gap-2',
            'hover:bg-primary/5 hover:border-primary',
          )}
          onClick={() => goalsStore.selectCategory(category.id)}
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <UIIcon
              iconName={category.icon}
              className="w-5 h-5 text-slate-600"
            />
          </div>
          <div className="text-center">
            <p className="font-medium">{category.name}</p>
            <p className="text-xs text-muted-foreground">
              {category.description}
            </p>
          </div>
        </Button>
      ))}
    </div>
  );
}
