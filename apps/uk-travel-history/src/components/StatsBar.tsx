'use client';

/**
 * StatsBar Component
 *
 * Displays key metrics and date range filter for the timeline view.
 * - Date range picker for filtering trips
 * - Key metrics: total trips, days away, etc.
 * - Mobile-responsive layout
 */

import { observer } from 'mobx-react-lite';
import { DatePicker } from '@uth/ui';
import { cn } from '@uth/utils';
import { uiStore } from '@uth/stores';

export interface StatsBarProps {
  className?: string;
  totalTrips?: number;
  daysAway?: number;
}

export const StatsBar = observer(function StatsBar({
  className,
  totalTrips = 0,
  daysAway = 0,
}: StatsBarProps) {
  const handleStartDateChange = (value: string) => {
    uiStore.setDateRange(value, uiStore.dateRangeEnd);
  };

  const handleEndDateChange = (value: string) => {
    uiStore.setDateRange(uiStore.dateRangeStart, value);
  };

  const handleClearDateRange = () => {
    uiStore.clearDateRange();
  };

  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-lg p-4',
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {/* Metrics */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-slate-900">
            {totalTrips}
          </span>
          <span className="text-xs text-slate-500 uppercase tracking-wide">
            Trips
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-slate-900">{daysAway}</span>
          <span className="text-xs text-slate-500 uppercase tracking-wide">
            Days Away
          </span>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
          Date Range:
        </label>
        <div className="flex items-center gap-2">
          <DatePicker
            value={uiStore.dateRangeStart ?? ''}
            onChange={handleStartDateChange}
            placeholder="Start date"
            className="w-32"
          />
          <span className="text-slate-400">—</span>
          <DatePicker
            value={uiStore.dateRangeEnd ?? ''}
            onChange={handleEndDateChange}
            placeholder="End date"
            className="w-32"
          />
          {uiStore.hasDateRange && (
            <button
              onClick={handleClearDateRange}
              className="text-xs text-slate-500 hover:text-slate-700 underline ml-1"
              type="button"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
