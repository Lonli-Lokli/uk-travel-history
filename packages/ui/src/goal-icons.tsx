/**
 * Goal Icon Mapping
 *
 * CRITICAL: Icon names must NEVER be stored in the database.
 * This mapping provides compile-time safety - if an icon is removed,
 * TypeScript will error here, not at runtime.
 *
 * Icons are mapped from goal template IDs to React components.
 */

import {
  Home03Icon,
  CalculateIcon,
  Airplane01Icon,
  MapPinIcon,
  Configuration01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react';
import UKFlagIcon from './cutom-icons/uk-flag.svg';
import EUFlagIcon from './cutom-icons/eu-flag.svg';
import { FC } from 'react';

/**
 * Icon wrapper component that handles both standard and custom icons
 */
export const GoalIcon: FC<{
  templateId: string;
  className?: string;
}> = ({ templateId, className }) => {
  const iconConfig = GOAL_TEMPLATE_ICONS[templateId];

  if (!iconConfig) {
    // Fallback to airplane icon if template not found
    return (
      <HugeiconsIcon
        icon={Airplane01Icon}
        className={className}
        aria-label="Unknown goal type"
      />
    );
  }

  if (iconConfig.type === 'custom') {
    const CustomIcon = iconConfig.icon as React.FC<{ className?: string }>;
    return <CustomIcon className={className} />;
  }

  // Standard icon
  return (
    <HugeiconsIcon
      icon={iconConfig.icon as IconSvgElement}
      className={className}
      aria-label={iconConfig.label}
    />
  );
};

/**
 * Icon configuration type
 */
type IconConfig =
  | {
      type: 'standard';
      icon: IconSvgElement;
      label: string;
    }
  | {
      type: 'custom';
      icon: React.FC<{ className?: string }>;
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
    type: 'custom',
    icon: UKFlagIcon,
    label: 'UK ILR 5-Year',
  },
  uk_ilr_3yr: {
    type: 'custom',
    icon: UKFlagIcon,
    label: 'UK ILR 3-Year',
  },
  uk_ilr_10yr: {
    type: 'custom',
    icon: UKFlagIcon,
    label: 'UK ILR 10-Year',
  },
  uk_citizenship: {
    type: 'custom',
    icon: UKFlagIcon,
    label: 'British Citizenship',
  },

  // UK Tax
  uk_tax: {
    type: 'standard',
    icon: CalculateIcon,
    label: 'UK Tax Residency',
  },

  // Schengen
  schengen_90_180: {
    type: 'custom',
    icon: EUFlagIcon,
    label: 'Schengen 90/180',
  },

  // Personal / Generic
  days_away: {
    type: 'standard',
    icon: Airplane01Icon,
    label: 'Days Away',
  },
  days_present: {
    type: 'standard',
    icon: MapPinIcon,
    label: 'Days Present',
  },
  custom: {
    type: 'standard',
    icon: Configuration01Icon,
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
    type: 'custom',
    icon: UKFlagIcon,
    label: 'UK ILR',
  },
  uk_citizenship: {
    type: 'custom',
    icon: UKFlagIcon,
    label: 'British Citizenship',
  },
  uk_tax_residency: {
    type: 'standard',
    icon: CalculateIcon,
    label: 'UK Tax Residency',
  },
  schengen_90_180: {
    type: 'custom',
    icon: EUFlagIcon,
    label: 'Schengen 90/180',
  },
  days_counter: {
    type: 'standard',
    icon: Airplane01Icon,
    label: 'Days Counter',
  },
  custom_threshold: {
    type: 'standard',
    icon: Configuration01Icon,
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
    return (
      <HugeiconsIcon
        icon={Airplane01Icon}
        className={className}
        aria-label="Unknown goal type"
      />
    );
  }

  if (iconConfig.type === 'custom') {
    const CustomIcon = iconConfig.icon as React.FC<{ className?: string }>;
    return <CustomIcon className={className} />;
  }

  // Standard icon
  return (
    <HugeiconsIcon
      icon={iconConfig.icon as IconSvgElement}
      className={className}
      aria-label={iconConfig.label}
    />
  );
};
