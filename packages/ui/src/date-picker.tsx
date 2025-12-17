'use client';

import * as React from 'react';
import { format, parse } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@uth/utils';
import { Button } from './button';
import { Calendar } from './calendar';

interface DatePickerProps {
  value: string; // ISO date string (YYYY-MM-DD)
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled = false,
  className,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Memoize the parsed date to avoid re-parsing on every render
  const selectedDate = React.useMemo<Date | undefined>(() => {
    return value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
      setIsOpen(false);
    }
  };

  const displayValue = selectedDate
    ? format(selectedDate, 'dd/MM/yyyy')
    : placeholder;

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal h-9 text-sm',
            !selectedDate && 'text-muted-foreground',
            className
          )}
          type="button"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          className="z-50 bg-white rounded-md border border-slate-200 shadow-lg p-0 outline-none"
          sideOffset={4}
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            defaultMonth={selectedDate}
            autoFocus
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
