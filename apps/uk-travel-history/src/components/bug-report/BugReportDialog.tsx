'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@uth/ui';
import { BugReportForm } from './BugReportForm';

interface BugReportDialogProps {
  children: React.ReactNode;
}

/**
 * Dialog component for bug report form
 *
 * Wraps the bug report form in a Radix UI dialog
 * that can be triggered by any child element.
 */
export function BugReportDialog({ children }: BugReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSuccess = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
          <DialogDescription>
            Help us improve by reporting any issues you encounter. We&apos;ll automatically
            capture a screenshot of the current page to help us understand the problem.
          </DialogDescription>
        </DialogHeader>
        <BugReportForm onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}
