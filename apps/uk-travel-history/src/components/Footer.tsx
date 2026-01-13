import Link from 'next/link';

import { BugReportDialog } from '@uth/widgets';
import { BuildInfo } from './BuildInfo';

interface FooterProps {
  /** User role for conditionally showing admin-onlylinks */
  isAdmin: boolean;
}

export function Footer({ isAdmin }: FooterProps) {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-6xl mx-auto px-3 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative">
          {/* Navigation Links */}
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/terms"
              className="text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
            >
              Terms and Conditions
            </Link>
            {isAdmin && (
              <>
                <span className="text-slate-300">•</span>
                <Link
                  href="/status"
                  className="text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                >
                  Status
                </Link>
              </>
            )}
            <span className="text-slate-300">•</span>
            <BugReportDialog>
              <button
                className="text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                aria-label="Report a bug"
              >
                Contact Us
              </button>
            </BugReportDialog>
            <span className="text-slate-300">•</span>
            <BuildInfo />
          </nav>
        </div>
      </div>
    </footer>
  );
}

Footer.displayName = 'Footer';
