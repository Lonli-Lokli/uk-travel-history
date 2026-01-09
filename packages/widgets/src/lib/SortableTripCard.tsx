'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDate } from '@uth/utils';
import { Button, UIIcon } from '@uth/ui';
import type { TripWithCalculations } from '@uth/calculators';

interface SortableTripCardProps {
  trip: TripWithCalculations;
  onCardClick: (tripId: string) => void;
  onDelete: (tripId: string) => void;
}

export function SortableTripCard({
  trip,
  onCardClick,
  onDelete,
}: SortableTripCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: trip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`p-2 rounded-lg border cursor-pointer transition-all ${
        trip.isIncomplete
          ? 'bg-red-50 border-red-200 hover:bg-red-100'
          : 'bg-white border-slate-200 hover:bg-slate-50'
      } ${isDragging ? 'shadow-lg scale-[1.02]' : ''}`}
      onClick={() => onCardClick(trip.id)}
    >
      {/* Header with drag handle and full days */}
      <div className="flex items-center justify-between mb-2">
        <div
          {...listeners}
          className="cursor-move flex-shrink-0 touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <UIIcon
            iconName="drag-drop"
            className="h-4 w-4 text-muted-foreground"
          />
        </div>
        <div className="text-center flex-1">
          <div className="text-xl font-bold text-primary">
            {trip.fullDays ?? '—'}
          </div>
          <div className="text-[0.625rem] text-muted-foreground uppercase leading-tight">
            Full Days
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(trip.id);
          }}
        >
          <UIIcon iconName="trash" className="h-3 w-3" />
        </Button>
      </div>

      {/* Departure section */}
      <div className="space-y-1 mb-2">
        <div className="text-[0.625rem] text-muted-foreground uppercase font-semibold">
          Departure
        </div>
        <div className="text-sm">
          {trip.outDate ? formatDate(trip.outDate) : 'Not set'}
        </div>
        {trip.outRoute && (
          <div className="text-xs text-muted-foreground">{trip.outRoute}</div>
        )}
      </div>

      {/* Return section */}
      <div className="space-y-1">
        <div className="text-[0.625rem] text-muted-foreground uppercase font-semibold">
          Return
        </div>
        <div className="text-sm">
          {trip.inDate ? formatDate(trip.inDate) : 'Not set'}
        </div>
        {trip.inRoute && (
          <div className="text-xs text-muted-foreground">{trip.inRoute}</div>
        )}
      </div>
    </div>
  );
}
