'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent, UIIcon } from '@uth/ui';

export function Footer() {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const commitHash = process.env.NEXT_PUBLIC_GIT_COMMIT_HASH || 'dev';
  const buildTime =
    process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();

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
            <span className="text-slate-300">•</span>
            <Link
              href="/status"
              className="text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
            >
              Status
            </Link>
               {/* Developer Info Popover */}
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger>
              <button
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded px-2 py-1 sm:absolute sm:right-0"
                aria-label="View build information"
              >
                <span className="font-mono">© {new Date().getFullYear()}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="top"
              className="p-3 min-w-[200px]"
            >
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  Build Information
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-start gap-3">
                    <span className="text-slate-500 shrink-0">Commit:</span>
                    <code className="font-mono text-slate-900 bg-slate-50 px-1.5 py-0.5 rounded">
                      {commitHash.slice(0, 7)}
                    </code>
                  </div>
                  <div className="flex justify-between items-start gap-3">
                    <span className="text-slate-500 shrink-0">Built:</span>
                    <span className="text-slate-700 text-right">
                      {new Date(buildTime).toLocaleString('en-GB', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-start gap-3">
                    <span className="text-slate-500 shrink-0">
                      Environment:
                    </span>
                    <span className="text-slate-700">
                      {process.env.NODE_ENV || 'development'}
                    </span>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          </nav>

       
        </div>
      </div>
    </footer>
  );
}

Footer.displayName = 'Footer';
