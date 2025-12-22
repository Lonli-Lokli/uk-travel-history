'use client';

import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react';
import { Card, CardContent } from '@uth/ui';
import { ReactNode } from 'react';

interface StatCardProps {
  icon: IconSvgElement;
  value: string | number;
  label: string;
  subtitle?: ReactNode;
  variant?: 'default' | 'primary' | 'warning' | 'success' | 'purple';
  iconBgColor?: string;
  iconColor?: string;
  className?: string;
}

const variantStyles = {
  default: {
    card: 'bg-white',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    valueColor: 'text-slate-900',
    labelColor: 'text-muted-foreground',
  },
  primary: {
    card: 'bg-primary text-primary-foreground',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    valueColor: 'text-white',
    labelColor: 'text-white/80',
  },
  warning: {
    card: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    valueColor: 'text-white',
    labelColor: 'text-white/90',
  },
  success: {
    card: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    valueColor: 'text-white',
    labelColor: 'text-white/90',
  },
  purple: {
    card: 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    valueColor: 'text-white',
    labelColor: 'text-white/90',
  },
};

export const StatCard = ({
  icon: Icon,
  value,
  label,
  subtitle,
  variant = 'default',
  className = '',
}: StatCardProps) => {
  const styles = variantStyles[variant];

  return (
    <Card className={`${styles.card} ${className}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full ${styles.iconBg} flex items-center justify-center flex-shrink-0`}
          >
            <HugeiconsIcon icon={Icon} className={`w-4 h-4 ${styles.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-xl font-bold ${styles.valueColor} leading-tight`}
            >
              {value}
            </p>
            <p className={`text-xs ${styles.labelColor} leading-tight`}>
              {label}
            </p>
            {subtitle && (
              <div className="text-xs opacity-75 mt-1 leading-tight">
                {subtitle}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
