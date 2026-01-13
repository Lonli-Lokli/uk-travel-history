'use client';

/**
 * TripCard Component
 *
 * Displays a single trip entry in the timeline view.
 * - Shows departure and return dates
 * - Displays destination and routes
 * - Supports inline expansion for notes/details
 * - Drag-and-drop enabled for reordering
 */

import { useState } from 'react';
import { Card, CardContent, UIIcon } from '@uth/ui';
import { cn, differenceInDays, formatDate } from '@uth/utils';
import type { TripData } from '@uth/db';

export interface TripCardProps {
  trip: TripData;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function TripCard({ trip, onEdit, onDelete, className }: TripCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate duration
  const outDate = new Date(trip.outDate);
  const inDate = new Date(trip.inDate);
  const daysAway = differenceInDays(inDate, outDate) - 1; // Full days calculation

  const hasDetails = trip.notes || trip.outRoute || trip.inRoute;

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-shadow duration-200',
        className,
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <UIIcon iconName="airplane" className="w-5 h-5 text-blue-600" />
          </div>

          {/* Trip details */}
          <div className="flex-1 min-w-0">
            {/* Dates and destination */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {trip.destination || 'Unknown destination'}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                  <span>{formatDate(outDate, 'ui')}</span>
                  <UIIcon iconName="arrow-right" className="w-3 h-3" />
                  <span>{formatDate(inDate, 'ui')}</span>
                </div>
              </div>

              {/* Duration badge */}
              <div className="flex-shrink-0 px-2 py-1 bg-slate-100 rounded-md text-xs font-medium text-slate-700">
                {daysAway} {daysAway === 1 ? 'day' : 'days'}
              </div>
            </div>

            {/* Expand button if has details */}
            {hasDetails && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
                type="button"
              >
                <UIIcon
                  iconName={isExpanded ? 'chevron-up' : 'chevron-down'}
                  className="w-3 h-3"
                />
                {isExpanded ? 'Hide' : 'Show'} details
              </button>
            )}

            {/* Expanded details */}
            {isExpanded && hasDetails && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 text-xs">
                {trip.outRoute && (
                  <div>
                    <span className="font-medium text-slate-700">
                      Outbound:{' '}
                    </span>
                    <span className="text-slate-600">{trip.outRoute}</span>
                  </div>
                )}
                {trip.inRoute && (
                  <div>
                    <span className="font-medium text-slate-700">
                      Inbound:{' '}
                    </span>
                    <span className="text-slate-600">{trip.inRoute}</span>
                  </div>
                )}
                {trip.notes && (
                  <div>
                    <span className="font-medium text-slate-700">Notes: </span>
                    <span className="text-slate-600">{trip.notes}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
                type="button"
                aria-label="Edit trip"
              >
                <UIIcon iconName="pencil" className="w-4 h-4 text-slate-600" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1 hover:bg-red-50 rounded transition-colors"
                type="button"
                aria-label="Delete trip"
              >
                <UIIcon iconName="trash" className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
