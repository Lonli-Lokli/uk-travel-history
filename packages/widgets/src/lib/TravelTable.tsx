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
import { formatDate } from '@uth/utils';
import { travelStore } from '@uth/stores';
import { Button, UIIcon } from '@uth/ui';
import { TripWithCalculations } from '@uth/calculators';
import { EditableCell } from './editable-cell';

export const TravelTable = observer(() => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Access observable first so MobX tracks it
  const data = travelStore.tripsWithCalculations;

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      travelStore.reorderTrip(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  const columns = useMemo<ColumnDef<TripWithCalculations>[]>(
    () => [
      {
        id: 'drag-handle',
        header: () => <span className="sr-only">Reorder</span>,
        cell: ({ row }) => (
          <div
            className="cursor-move hover:bg-muted/50 rounded p-1 -m-1"
            draggable
            onDragStart={() => handleDragStart(row.index)}
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
            {row.original.outDate
              ? formatDate(row.original.outDate)
              : <span className="text-muted-foreground">Not set</span>}
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
            {row.original.inDate
              ? formatDate(row.original.inDate)
              : <span className="text-muted-foreground">Not set</span>}
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

  return (
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
      <div className="block md:hidden space-y-2">
        {table.getRowModel().rows.map((row, index) => (
          <div
            key={row.id}
            className={`p-2 rounded-lg border cursor-pointer transition-colors ${
              row.original.isIncomplete
                ? 'bg-red-50 border-red-200 hover:bg-red-100'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            } ${draggedIndex === index ? 'opacity-50' : ''}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onClick={() => handleRowClick(row.original.id)}
          >
            {/* Header with drag handle and full days */}
            <div className="flex items-center justify-between mb-2">
              <div
                className="cursor-move flex-shrink-0"
                onTouchStart={() => handleDragStart(index)}
                onClick={(e) => e.stopPropagation()}
              >
                <UIIcon
                  iconName="drag-drop"
                  className="h-4 w-4 text-muted-foreground"
                />
              </div>
              <div className="text-center flex-1">
                <div className="text-xl font-bold text-primary">
                  {row.original.fullDays ?? '—'}
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
                  travelStore.deleteTrip(row.original.id);
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
                {row.original.outDate
                  ? formatDate(row.original.outDate)
                  : 'Not set'}
              </div>
              {row.original.outRoute && (
                <div className="text-xs text-muted-foreground">
                  {row.original.outRoute}
                </div>
              )}
            </div>

            {/* Return section */}
            <div className="space-y-1">
              <div className="text-[0.625rem] text-muted-foreground uppercase font-semibold">
                Return
              </div>
              <div className="text-sm">
                {row.original.inDate ? formatDate(row.original.inDate) : 'Not set'}
              </div>
              {row.original.inRoute && (
                <div className="text-xs text-muted-foreground">
                  {row.original.inRoute}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

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
              table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`transition-colors cursor-pointer ${
                    row.original.isIncomplete
                      ? 'bg-red-50 hover:bg-red-100'
                      : 'bg-white hover:bg-slate-50'
                  } ${draggedIndex === index ? 'opacity-50' : ''}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  onClick={() => handleRowClick(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
