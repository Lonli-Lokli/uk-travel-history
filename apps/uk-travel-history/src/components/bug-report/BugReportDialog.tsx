'use client';

import { useState } from 'react';
import { Sheet } from 'react-modal-sheet';
import { BugReportForm } from './BugReportForm';
import './bug-report-sheet.css';

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
        <Sheet.Container>
          <Sheet.Header />
          <Sheet.Content className="bug-report-sheet-content">
            <div className="px-4 pb-6">
              <h2 className="text-2xl font-semibold mb-2">Report a Bug</h2>
              <p className="text-sm text-slate-600 mb-4">
                Help us improve by reporting any issues you encounter. We&apos;ll
                automatically capture a screenshot of the current page to help us
                understand the problem.
              </p>
              <BugReportForm onSuccess={handleSuccess} />
            </div>
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop />
      </Sheet>
    </>
  );
}
