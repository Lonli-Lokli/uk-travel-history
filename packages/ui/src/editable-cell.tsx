'use client';

import * as React from 'react';
import { cn } from '@uth/utils';
import { Input } from './input';
import { DatePicker } from './date-picker';
import { Button } from './button';
import { Check, X, Pencil } from 'lucide-react';

interface EditableCellProps {
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'date';
  placeholder?: string;
  className?: string;
  displayValue?: string;
  editable?: boolean;
}

export function EditableCell({
  value,
  onSave,
  type = 'text',
  placeholder = '—',
  className,
  displayValue,
  editable = true,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current && type === 'text') {
      inputRef.current.focus();
    }
  }, [isEditing, type]);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!editable) {
    return (
      <div className={cn('px-1 py-0.5', className)}>
        {displayValue || value || placeholder}
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div
        className={cn(
          'group cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 flex items-center justify-between transition-colors',
          className
        )}
        onClick={() => setIsEditing(true)}
      >
        <span className="truncate">{displayValue || value || placeholder}</span>
        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 ml-1 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {type === 'date' ? (
        <DatePicker
          value={editValue}
          onChange={setEditValue}
          placeholder="Select date"
          className="h-7 text-xs"
        />
      ) : (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 text-xs"
          placeholder={placeholder}
        />
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 flex-shrink-0"
        onClick={handleSave}
        type="button"
      >
        <Check className="h-3 w-3 text-green-600" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 flex-shrink-0"
        onClick={handleCancel}
        type="button"
      >
        <X className="h-3 w-3 text-red-600" />
      </Button>
    </div>
  );
}
