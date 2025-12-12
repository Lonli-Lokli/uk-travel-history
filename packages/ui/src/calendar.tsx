'use client';

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from 'lucide-react';
import * as React from 'react';
import { DayFlag, DayPicker, SelectionState, UI } from 'react-day-picker';

import { buttonVariants } from './button';
import { cn } from '@uth/utils';

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
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout="dropdown"
      startMonth={defaultStartMonth}
      endMonth={endMonth}
      numberOfMonths={1}
      className={cn('p-3', className)}
      classNames={{
        [UI.Months]: 'relative overflow-hidden',
        [UI.Month]: 'space-y-4 ml-0',

        [UI.CaptionLabel]: '!hidden',

        [UI.Dropdown]: cn(
          'h-8 px-2 py-1 text-sm rounded-md border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex-shrink-0 z-10'
        ),

        [UI.MonthCaption]:
          'relative flex flex-row flex-nowrap justify-center items-center h-10 gap-1.5 px-2',
        [UI.DropdownRoot]:
          'inline-flex flex-row flex-nowrap items-center gap-1.5',
        [UI.MonthsDropdown]: 'w-[100px] flex-shrink-0',
        [UI.YearsDropdown]: 'w-[75px] flex-shrink-0',
        [UI.PreviousMonthButton]: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute left-1 top-0 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
        ),
        [UI.NextMonthButton]: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute right-1 top-0 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
        ),
        [UI.MonthGrid]: 'w-full border-collapse space-y-1',
        [UI.Weekdays]: 'flex',
        [UI.Weekday]:
          'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
        [UI.Week]: 'flex w-full mt-2',
        [UI.Day]:
          'h-9 w-9 rounded-md p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
        [UI.DayButton]: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal text-center aria-selected:opacity-100 hover:bg-primary hover:text-primary-foreground'
        ),
        [SelectionState.range_end]: 'day-range-end',
        [SelectionState.selected]:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        [SelectionState.range_middle]:
          'aria-selected:bg-accent aria-selected:text-accent-foreground',
        [DayFlag.today]: 'bg-accent text-accent-foreground',
        [DayFlag.outside]:
          'day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
        [DayFlag.disabled]: 'text-muted-foreground opacity-50',
        [DayFlag.hidden]: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ ...props }) => <Chevron {...props} />,
      }}
      {...props}
    />
  );
};

const Chevron = ({ orientation = 'left' }) => {
  switch (orientation) {
    case 'left':
      return <ChevronLeftIcon className="h-4 w-4" />;
    case 'right':
      return <ChevronRightIcon className="h-4 w-4" />;
    case 'up':
      return <ChevronUpIcon className="h-4 w-4" />;
    case 'down':
      return <ChevronDownIcon className="h-4 w-4" />;
    default:
      return null;
  }
};
