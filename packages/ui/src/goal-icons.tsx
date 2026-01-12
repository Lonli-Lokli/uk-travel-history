/**
 * Goal Icon Mapping
 *
 * CRITICAL: Icon names must NEVER be stored in the database.
 * This mapping provides compile-time safety - if an icon is removed,
 * TypeScript will error here, not at runtime.
 *
 * Icons are mapped from goal template IDs to React components.
 */

import { FC } from 'react';
import { IconName, UIIcon } from './icon';

/**
 * Icon wrapper component that handles both standard and custom icons
 */
export const  GoalIcon: FC<{
  templateId: string;
  className?: string;
}> = ({ templateId, className }) => {
  const iconConfig = GOAL_TEMPLATE_ICONS[templateId];

  if (!iconConfig) {
    // Fallback to airplane icon if template not found
    return <UIIcon iconName="airplane" className={className} aria-label="Unknown goal template" />;
  }

  return (
    <UIIcon
      iconName={iconConfig.icon}
      className={className}
      aria-label={iconConfig.label}
    />
  );
};

/**
 * Icon configuration type
 */
type IconConfig = {
  icon: IconName;
  label: string;
};

/**
 * Maps goal template IDs to their icons.
 * This ensures compile-time safety - if an icon is removed,
 * TypeScript will error here, not at runtime.
 *
 * Template IDs come from database seeded data in:
 * supabase/migrations/20260105100001_add_tracking_goals.sql
 */
export const GOAL_TEMPLATE_ICONS: Record<string, IconConfig> = {
  // UK Immigration
  uk_ilr_5yr: {
    icon: 'uk-flag',
    label: 'UK ILR 5-Year',
  },
  uk_ilr_3yr: {
    icon: 'uk-flag',
    label: 'UK ILR 3-Year',
  },
  uk_ilr_10yr: {
    icon: 'uk-flag',
    label: 'UK ILR 10-Year',
  },
  uk_citizenship: {
    icon: 'uk-flag',
    label: 'British Citizenship',
  },

  // UK Tax
  uk_tax: {
    icon: 'calculator',
    label: 'UK Tax Residency',
  },

  // Schengen
  schengen_90_180: {
    icon: 'eu-flag',
    label: 'Schengen 90/180',
  },

  // Personal / Generic
  days_away: {
    icon: 'airplane',
    label: 'Days Away',
  },
  days_present: {
    icon: 'map-pin',
    label: 'Days Present',
  },
  custom: {
    icon: 'settings',
    label: 'Custom Goal',
  },
} as const;

/**
 * Get icon configuration for a goal template ID
 * Returns null if template not found
 */
export function getGoalIconConfig(templateId: string): IconConfig | null {
  return GOAL_TEMPLATE_ICONS[templateId] ?? null;
}

/**
 * Check if a goal template has an icon configured
 */
export function hasGoalIcon(templateId: string): boolean {
  return templateId in GOAL_TEMPLATE_ICONS;
}

/**
 * Maps goal types to their icons.
 * Used when displaying goals (which have a type field)
 * rather than templates (which have an id field).
 */
export const GOAL_TYPE_ICONS: Record<string, IconConfig> = {
  uk_ilr: {
    icon: 'uk-flag',
    label: 'UK ILR',
  },
  uk_citizenship: {
    icon: 'uk-flag',
    label: 'British Citizenship',
  },
  uk_tax_residency: {
    icon: 'calculator',
    label: 'UK Tax Residency',
  },
  schengen_90_180: {
    icon: 'eu-flag',
    label: 'Schengen 90/180',
  },
  days_counter: {
    icon: 'airplane',
    label: 'Days Counter',
  },
  custom_threshold: {
    icon: 'settings',
    label: 'Custom Threshold',
  },
} as const;

/**
 * Goal icon component for use with goal types
 * Use this when displaying goals rather than templates
 */
export const GoalTypeIcon: FC<{
  goalType: string;
  className?: string;
}> = ({ goalType, className }) => {
  const iconConfig = GOAL_TYPE_ICONS[goalType];

  if (!iconConfig) {
    // Fallback to airplane icon if type not found
    return <UIIcon iconName="airplane" className={className} aria-label="Unknown goal template" />;
  }

  return (
    <UIIcon
      iconName={iconConfig.icon}
      className={className}
      aria-label={iconConfig.label}
    />
  );
};
