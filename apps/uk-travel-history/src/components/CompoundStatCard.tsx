'use client';

import { Card, CardContent, IconName, UIIcon } from '@uth/ui';
import { ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';

interface StatItem {
  value: string | number;
  label: string;
  variant?: 'default' | 'success' | 'warning';
  tooltip?: string;
}

interface CompoundStatCardProps {
  icon: IconName;
  title: string;
  stats: StatItem[];
  subtitle?: ReactNode;
  variant?:
    | 'default'
    | 'primary'
    | 'warning'
    | 'success'
    | 'purple'
    | 'neutral';
  className?: string;
}

const variantStyles = {
  default: {
    card: 'bg-white',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    titleColor: 'text-slate-900',
    labelColor: 'text-muted-foreground',
  },
  neutral: {
    card: 'bg-slate-100 border border-slate-200',
    iconBg: 'bg-white/20',
    iconColor: 'text-slate-700',
    titleColor: 'text-slate-900',
    labelColor: 'text-slate-600',
  },
  primary: {
    card: 'bg-primary text-primary-foreground',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    titleColor: 'text-white',
    labelColor: 'text-white/80',
  },
  warning: {
    card: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    titleColor: 'text-white',
    labelColor: 'text-white/90',
  },
  success: {
    card: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    titleColor: 'text-white',
    labelColor: 'text-white/90',
  },
  purple: {
    card: 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    titleColor: 'text-white',
    labelColor: 'text-white/90',
  },
};

const statVariantStyles = {
  default: 'text-slate-600',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
};

export const CompoundStatCard = ({
  icon,
  title,
  stats,
  subtitle,
  variant = 'default',
  className = '',
}: CompoundStatCardProps) => {
  const styles = variantStyles[variant];

  // Determine grid columns based on number of stats
  const getGridCols = () => {
    if (stats.length <= 3) return 'grid-cols-3';
    if (stats.length === 4) return 'grid-cols-2 sm:grid-cols-4';
    if (stats.length === 5) return 'grid-cols-3 sm:grid-cols-5';
    return 'grid-cols-3 sm:grid-cols-6';
  };

  return (
    <Card className={`${styles.card} ${className}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-8 h-8 rounded-full ${styles.iconBg} flex items-center justify-center flex-shrink-0`}
          >
            <UIIcon iconName={icon} className={`w-4 h-4 ${styles.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-xs font-semibold ${styles.titleColor} leading-tight uppercase tracking-wide`}
            >
              {title}
            </p>
          </div>
        </div>

        <div className={`grid ${getGridCols()} gap-3`}>
          {stats.map((stat, index) => {
            const statColor =
              variant !== 'default' && variant !== 'neutral'
                ? styles.titleColor
                : stat.variant
                  ? statVariantStyles[stat.variant]
                  : styles.titleColor;

            return (
              <div key={index} className="text-center">
                <p className={`text-xl font-bold ${statColor} leading-tight`}>
                  {stat.value}
                </p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <p className={`text-xs ${styles.labelColor} leading-tight`}>
                    {stat.label}
                  </p>
                  {stat.tooltip && (
                    <Popover.Root>
                      <Popover.Trigger asChild>
                        <button
                          className="inline-flex items-center justify-center rounded-full hover:bg-black/10 transition-colors p-0.5"
                          type="button"
                          aria-label={`Info about ${stat.label}`}
                        >
                          <UIIcon
                            iconName="info-circle"
                            className={`w-3 h-3 ${styles.labelColor}`}
                          />
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content
                          className="bg-slate-900 text-white px-3 py-2 rounded-md text-xs max-w-xs shadow-lg z-50 animate-in fade-in-0 zoom-in-95"
                          sideOffset={5}
                          align="center"
                        >
                          {stat.tooltip}
                          <Popover.Arrow className="fill-slate-900" />
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {subtitle && (
          <div className={`text-xs ${styles.labelColor} mt-2 leading-tight`}>
            {subtitle}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
