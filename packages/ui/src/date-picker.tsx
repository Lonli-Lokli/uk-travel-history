'use client';

import * as React from 'react';
import { format, parse, isValid } from 'date-fns';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@uth/utils';
import { Input } from './input';
import { Calendar } from './calendar';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon } from '@hugeicons/core-free-icons';

interface DatePickerProps {
  value: string; // ISO date string (YYYY-MM-DD)
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  defaultMonth?: Date; // For smart month selection
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  disabled = false,
  className,
  defaultMonth,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Memoize the parsed date to avoid re-parsing on every render
  const selectedDate = React.useMemo<Date | undefined>(() => {
    return value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  }, [value]);

  // Initialize input value when component mounts or value changes
  React.useEffect(() => {
    if (selectedDate) {
      setInputValue(format(selectedDate, 'yyyy-MM-dd'));
    } else {
      setInputValue('');
    }
  }, [selectedDate]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
      setIsOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Only parse YYYY-MM-DD format
    const parsedDate = parse(newValue, 'yyyy-MM-dd', new Date());

    // If we successfully parsed a valid date, update the value
    if (parsedDate && isValid(parsedDate)) {
      onChange(format(parsedDate, 'yyyy-MM-dd'));
    }
  };

  const handleInputBlur = () => {
    // Restore formatted value on blur if we have a valid date
    if (selectedDate) {
      setInputValue(format(selectedDate, 'yyyy-MM-dd'));
    } else {
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  };

  // Determine which month to show in the calendar
  const calendarDefaultMonth = defaultMonth || selectedDate || new Date();

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={cn('h-7 text-xs flex-1', className)}
      />
      <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            disabled={disabled}
            className={cn(
              'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
              'hover:bg-muted hover:text-muted-foreground',
              'h-7 w-7 flex-shrink-0',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
            type="button"
          >
            <HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4" /> 
          </button>
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
              defaultMonth={calendarDefaultMonth}
              autoFocus
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
