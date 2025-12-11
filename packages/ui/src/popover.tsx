'use client';

import * as React from 'react';
import { cn } from '@uth/utils';

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface PopoverTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

interface PopoverContentProps {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

const PopoverContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
} | null>(null);

export function Popover({ open, onOpenChange, children }: PopoverProps) {
  const triggerRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <PopoverContext.Provider value={{ open, onOpenChange, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({ children, asChild }: PopoverTriggerProps) {
  const context = React.useContext(PopoverContext);
  if (!context) throw new Error('PopoverTrigger must be used within Popover');

  const { onOpenChange, triggerRef } = context;

  return (
    <div
      ref={triggerRef}
      onClick={() => onOpenChange(true)}
      className="cursor-pointer"
    >
      {children}
    </div>
  );
}

export function PopoverContent({
  children,
  className,
  align = 'start',
  side = 'bottom',
}: PopoverContentProps) {
  const context = React.useContext(PopoverContext);
  if (!context) throw new Error('PopoverContent must be used within Popover');

  const { open, onOpenChange } = context;

  if (!open) return null;

  const alignmentClasses = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  };

  const sideClasses = {
    top: 'bottom-full mb-2',
    right: 'left-full ml-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          'absolute z-50 bg-white rounded-md border border-slate-200 shadow-lg',
          sideClasses[side],
          alignmentClasses[align],
          className
        )}
      >
        {children}
      </div>
    </>
  );
}
