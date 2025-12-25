'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent, UIIcon } from '@uth/ui';

export function Footer() {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const commitHash = process.env.NEXT_PUBLIC_GIT_COMMIT_HASH || 'dev';
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();

  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-6xl mx-auto px-3 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Navigation Links */}
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/about"
              className="text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
            >
              About
            </Link>
            <span className="text-slate-300">•</span>
            <Link
              href="/terms"
              className="text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
            >
              Terms and Conditions
            </Link>
          </nav>

          {/* Developer Info Popover */}
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger>
              <button
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded px-2 py-1"
                aria-label="View build information"
              >
                <UIIcon iconName="info-circle" className="h-3.5 w-3.5" />
                <span className="font-mono">{commitHash.slice(0, 7)}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="p-3 min-w-[200px]">
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
                    <span className="text-slate-500 shrink-0">Environment:</span>
                    <span className="text-slate-700">
                      {process.env.NODE_ENV || 'development'}
                    </span>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </footer>
  );
}

Footer.displayName = 'Footer';
