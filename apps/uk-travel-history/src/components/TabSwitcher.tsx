'use client';

/**
 * TabSwitcher Component
 *
 * Mobile-first tab navigation for switching between Trackers and Timeline views.
 * - Syncs with URL query parameters (?tab=trackers or ?tab=timeline)
 * - Uses MobX for state management
 * - Smooth transitions and animations
 */

import { observer } from 'mobx-react-lite';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@uth/utils';
import { uiStore, type AppTab } from '@uth/stores';

export interface TabSwitcherProps {
  className?: string;
}

export const TabSwitcher = observer(function TabSwitcher({
  className,
}: TabSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sync URL param with store on mount and when URL changes
  useEffect(() => {
    const tabParam = searchParams.get('tab') as AppTab | null;
    if (tabParam === 'trackers' || tabParam === 'timeline') {
      if (uiStore.activeTab !== tabParam) {
        uiStore.setActiveTab(tabParam);
      }
    } else if (tabParam === null && uiStore.activeTab !== 'trackers') {
      // Default to trackers if no param
      uiStore.setActiveTab('trackers');
    }
  }, [searchParams]);

  const handleTabChange = (tab: AppTab) => {
    // Update store
    uiStore.setActiveTab(tab);

    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const tabs: { id: AppTab; label: string }[] = [
    { id: 'trackers', label: 'Trackers' },
    { id: 'timeline', label: 'Timeline' },
  ];

  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1 bg-slate-100 rounded-lg',
        className,
      )}
      role="tablist"
      aria-label="Main navigation tabs"
    >
      {tabs.map((tab) => {
        const isActive = uiStore.activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`${tab.id}-panel`}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
});
