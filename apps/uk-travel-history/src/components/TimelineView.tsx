'use client';

/**
 * TimelineView Component
 *
 * Displays trips in a chronological timeline with sticky month headers.
 * - Groups trips by month
 * - Sticky month headers for easy navigation
 * - Supports filtering by date range
 * - Responsive layout
 */

import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';
import { cn } from '@uth/utils';
import type { TripData } from '@uth/db';
import { format, parseISO } from 'date-fns';
import { uiStore } from '@uth/stores';
import { TripCard} from '@uth/widgets';

export interface TimelineViewProps {
  trips: TripData[];
  onEditTrip?: (tripId: string) => void;
  onDeleteTrip?: (tripId: string) => void;
  onAddTrip?: () => void;
  className?: string;
}

interface GroupedTrips {
  monthKey: string;
  monthLabel: string;
  trips: TripData[];
}

export const TimelineView = observer(function TimelineView({
  trips,
  onEditTrip,
  onDeleteTrip,
  onAddTrip,
  className,
}: TimelineViewProps) {
  // Filter trips by date range if set
  const filteredTrips = useMemo(() => {
    if (!uiStore.hasDateRange) {
      return trips;
    }

    return trips.filter((trip) => {
      const outDate = parseISO(trip.outDate);
      const inDate = parseISO(trip.inDate);

      const start = uiStore.dateRangeStart
        ? parseISO(uiStore.dateRangeStart)
        : null;
      const end = uiStore.dateRangeEnd ? parseISO(uiStore.dateRangeEnd) : null;

      if (start && outDate < start) return false;
      if (end && inDate > end) return false;

      return true;
    });
  }, [trips]);

  // Group trips by month (based on outDate)
  const groupedTrips = useMemo(() => {
    const groups = new Map<string, GroupedTrips>();

    // Sort trips by outDate descending (newest first)
    const sortedTrips = [...filteredTrips].sort((a, b) => {
      return new Date(b.outDate).getTime() - new Date(a.outDate).getTime();
    });

    sortedTrips.forEach((trip) => {
      const monthKey = format(parseISO(trip.outDate), 'yyyy-MM');
      const monthLabel = format(parseISO(trip.outDate), 'MMMM yyyy');

      if (!groups.has(monthKey)) {
        groups.set(monthKey, {
          monthKey,
          monthLabel,
          trips: [],
        });
      }

      groups.get(monthKey)!.trips.push(trip);
    });

    return Array.from(groups.values());
  }, [filteredTrips]);

  // Empty state
  if (trips.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center',
          'min-h-[400px] px-4 py-12',
          'bg-slate-50 border border-slate-200 rounded-lg',
          className,
        )}
      >
        <div className="w-16 h-16 mb-4 rounded-full bg-slate-200 flex items-center justify-center">
          <span className="text-2xl">✈️</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          No Trips Yet
        </h2>
        <p className="text-sm text-slate-600 text-center max-w-md mb-6">
          Start tracking your travels by adding your first trip. You can import
          from PDF, Excel, or add trips manually.
        </p>
        {onAddTrip && (
          <button
            onClick={onAddTrip}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
            type="button"
          >
            Add Your First Trip
          </button>
        )}
      </div>
    );
  }

  // No trips after filtering
  if (filteredTrips.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center',
          'min-h-[300px] px-4 py-12',
          'bg-slate-50 border border-slate-200 rounded-lg',
          className,
        )}
      >
        <p className="text-slate-600 text-center">
          No trips found in the selected date range.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {groupedTrips.map((group) => (
        <div key={group.monthKey} className="relative">
          {/* Sticky month header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 py-2 mb-3">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              {group.monthLabel}
            </h3>
          </div>

          {/* Trip cards */}
          <div className="space-y-3">
            {group.trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onEdit={onEditTrip ? () => onEditTrip(trip.id) : undefined}
                onDelete={
                  onDeleteTrip ? () => onDeleteTrip(trip.id) : undefined
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
