'use client';

import * as React from 'react';
import 'react-day-picker/style.css';

import { DayFlag, DayPicker } from 'react-day-picker';

import { cn } from '@uth/utils';
import { UIIcon } from './icon';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const defaultStartMonth = new Date(2015, 0);
const defaultEndMonth = new Date(new Date().getFullYear() + 5, 11);
export const Calendar = ({
  className,
  classNames,
  showOutsideDays = true,
  endMonth = defaultEndMonth,
  ...props
}: CalendarProps) => {
  return (
    <div className="[&_select]:text-sm [&_option]:text-sm">
      <DayPicker
        showOutsideDays={showOutsideDays}
        captionLayout="dropdown"
        startMonth={defaultStartMonth}
        endMonth={endMonth}
        numberOfMonths={1}
        className={cn('p-3 text-sm', className)}
        classNames={{
          [DayFlag.disabled]: 'text-muted-foreground opacity-50',
          [DayFlag.hidden]: 'invisible',
          ...classNames,
        }}
        components={{
          Chevron: ({ ...props }) => <Chevron {...props} />,
        }}
        {...props}
      />
    </div>
  );
};

const Chevron = ({ orientation = 'left' }) => {
  switch (orientation) {
    case 'left':
      return <UIIcon iconName="arrow-left" className="h-6 w-6" />;
    case 'right':
      return <UIIcon iconName="arrow-right" className="h-6 w-6" />;
    case 'up':
      return <UIIcon iconName="arrow-up" className="h-6 w-6" />;
    case 'down':
      return <UIIcon iconName="arrow-down" className="h-6 w-6" />;
    default:
      return null;
  }
};
