'use client';

import { useState } from 'react';
import { Sheet } from 'react-modal-sheet';
import { BugReportForm } from './BugReportForm';

interface BugReportDialogProps {
  children: React.ReactNode;
}

/**
 * Dialog component for bug report form
 *
 * Wraps the bug report form in a bottom sheet
 * that can be triggered by any child element.
 */
export function BugReportDialog({ children }: BugReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSuccess = () => {
    setIsOpen(false);
  };

  return (
    <>
      <div onClick={() => setIsOpen(true)}>{children}</div>
      <Sheet isOpen={isOpen} onClose={() => setIsOpen(false)} detent="content">
        <Sheet.Container className="!rounded-t-2xl">
          <Sheet.Header className="!h-10" />
          <Sheet.Content>
            <div className="px-4 pb-6 max-w-2xl mx-auto">
              <h2 className="text-2xl font-semibold mb-2">Report a Bug</h2>
              <BugReportForm onSuccess={handleSuccess} />
            </div>
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop />
      </Sheet>
    </>
  );
}
