'use client';

import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@uth/ui';

export const BuildInfo = () => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const commitHash = process.env.NEXT_PUBLIC_GIT_COMMIT_HASH || 'dev';
  const buildTime =
    process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();
  
  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger>
        <button
          className="text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded text-xs"
          aria-label="View build information"
        >
          © {new Date().getFullYear()}
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
  );
};
