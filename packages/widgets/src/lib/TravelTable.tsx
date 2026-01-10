'use client';

import { useState, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { formatDate } from '@uth/utils';
import { travelStore } from '@uth/stores';
import { Button, UIIcon } from '@uth/ui';
import { TripWithCalculations } from '@uth/calculators';
import { SortableTableRow } from './SortableTableRow';
import { SortableTripCard } from './SortableTripCard';

export const TravelTable = observer(() => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Access observable first so MobX tracks it
  const data = travelStore.tripsWithCalculations;

  // Configure sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300, // 300ms long-press for mobile
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = data.findIndex((item) => item.id === active.id);
      const newIndex = data.findIndex((item) => item.id === over.id);
      travelStore.reorderTrip(oldIndex, newIndex);
    }

    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const columns = useMemo<ColumnDef<TripWithCalculations>[]>(
    () => [
      {
        id: 'drag-handle',
        header: () => <span className="sr-only">Reorder</span>,
        cell: ({ row }) => (
          <div
            className="cursor-move hover:bg-muted/50 rounded p-1 -m-1 drag-handle"
            onClick={(e) => e.stopPropagation()}
          >
            <UIIcon
              iconName="drag-drop"
              className="h-4 w-4 text-muted-foreground"
            />
          </div>
        ),
        size: 30,
      },
      {
        accessorKey: 'outDate',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 text-xs font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Date Out
            <UIIcon iconName="arrow-down" className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.outDate ? (
              formatDate(row.original.outDate)
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'inDate',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 text-xs font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Date In
            <UIIcon iconName="arrow-up" className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.inDate ? (
              formatDate(row.original.inDate)
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'outRoute',
        header: () => <span className="text-xs font-semibold">Departure</span>,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
            {row.original.outRoute || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'inRoute',
        header: () => <span className="text-xs font-semibold">Return</span>,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
            {row.original.inRoute || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'fullDays',
        header: () => (
          <span className="text-xs font-semibold text-primary">Full Days</span>
        ),
        cell: ({ row }) => (
          <span
            className={`font-medium ${
              row.original.isIncomplete
                ? 'text-muted-foreground'
                : 'text-primary'
            }`}
          >
            {row.original.fullDays ?? '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => null,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              travelStore.deleteTrip(row.original.id);
            }}
          >
            <UIIcon iconName="trash" className="h-3.5 w-3.5" />
          </Button>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleRowClick = (tripId: string) => {
    travelStore.openDrawer('edit', tripId);
  };

  const activeTrip = activeId
    ? data.find((trip) => trip.id === activeId)
    : null;

  const tripIds = useMemo(() => data.map((trip) => trip.id), [data]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="w-full">
        {/* Add Row Button */}
        <div className="mb-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full md:w-auto"
            onClick={() => travelStore.openDrawer('create')}
          >
            <UIIcon iconName="plus" className="h-4 w-4 mr-1" />
            Add Trip
          </Button>
        </div>

        {/* Mobile Cards View */}
        <SortableContext items={tripIds} strategy={verticalListSortingStrategy}>
          <div className="block md:hidden space-y-2">
            {data.map((trip) => (
              <SortableTripCard
                key={trip.id}
                trip={trip}
                onCardClick={handleRowClick}
                onDelete={travelStore.deleteTrip.bind(travelStore)}
              />
            ))}
          </div>
        </SortableContext>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 py-2 text-left font-medium text-slate-600"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <SortableContext
              items={tripIds}
              strategy={verticalListSortingStrategy}
            >
              <tbody className="divide-y divide-slate-100">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No trips yet. Add a trip or import.
                    </td>
                  </tr>
                ) : (
                  table
                    .getRowModel()
                    .rows.map((row) => (
                      <SortableTableRow
                        key={row.id}
                        row={row}
                        onRowClick={handleRowClick}
                      />
                    ))
                )}
              </tbody>
            </SortableContext>
          </table>
        </div>

        {/* Drag Overlay - shows the item being dragged */}
        <DragOverlay>
          {activeTrip ? (
            <div className="bg-white shadow-2xl rounded-lg opacity-90 border-2 border-primary">
              <SortableTripCard
                trip={activeTrip}
                onCardClick={() => {
                  /* empty */
                }}
                onDelete={() => {
                  /* empty */
                }}
              />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
});
