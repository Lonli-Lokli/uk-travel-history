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
import { Trash2, Plus, ArrowUpDown, Check, X, GripVertical } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { travelStore, TripWithCalculations } from './stores/travelStore';
import { formatDate } from '@uth/utils';

interface EditingCell {
  rowId: string;
  columnId: string;
}

export const TravelTable = observer(() => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const startEditing = (
    rowId: string,
    columnId: string,
    currentValue: string
  ) => {
    setEditingCell({ rowId, columnId });
    setEditValue(currentValue || '');
  };

  const saveEdit = () => {
    if (editingCell) {
      travelStore.updateTrip(editingCell.rowId, {
        [editingCell.columnId]: editValue,
      });
      setEditingCell(null);
      setEditValue('');
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

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
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
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
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const value = row.original.outDate;
          const isEditing =
            editingCell?.rowId === row.original.id &&
            editingCell?.columnId === 'outDate';

          if (isEditing) {
            return (
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-7 w-32 text-xs"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={saveEdit}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={cancelEdit}
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            );
          }

          return (
            <div
              className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1"
              onClick={() => startEditing(row.original.id, 'outDate', value)}
            >
              {value ? formatDate(value) : '—'}
            </div>
          );
        },
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
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const value = row.original.inDate;
          const isEditing =
            editingCell?.rowId === row.original.id &&
            editingCell?.columnId === 'inDate';

          if (isEditing) {
            return (
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-7 w-32 text-xs"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={saveEdit}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={cancelEdit}
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            );
          }

          return (
            <div
              className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1"
              onClick={() => startEditing(row.original.id, 'inDate', value)}
            >
              {value ? formatDate(value) : '—'}
            </div>
          );
        },
      },
      {
        accessorKey: 'outRoute',
        header: () => <span className="text-xs font-semibold">Departure</span>,
        cell: ({ row }) => {
          const value = row.original.outRoute;
          const isEditing =
            editingCell?.rowId === row.original.id &&
            editingCell?.columnId === 'outRoute';

          if (isEditing) {
            return (
              <div className="flex items-center gap-1">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-7 text-xs"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={saveEdit}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={cancelEdit}
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            );
          }

          return (
            <div
              className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 truncate max-w-[200px]"
              onClick={() => startEditing(row.original.id, 'outRoute', value)}
              title={value}
            >
              {value || '—'}
            </div>
          );
        },
      },
      {
        accessorKey: 'inRoute',
        header: () => <span className="text-xs font-semibold">Return</span>,
        cell: ({ row }) => {
          const value = row.original.inRoute;
          const isEditing =
            editingCell?.rowId === row.original.id &&
            editingCell?.columnId === 'inRoute';

          if (isEditing) {
            return (
              <div className="flex items-center gap-1">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-7 text-xs"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={saveEdit}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={cancelEdit}
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            );
          }

          return (
            <div
              className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 truncate max-w-[200px]"
              onClick={() => startEditing(row.original.id, 'inRoute', value)}
              title={value}
            >
              {value || '—'}
            </div>
          );
        },
      },
      {
        accessorKey: 'calendarDays',
        header: () => (
          <span className="text-xs font-semibold hidden sm:inline">Days</span>
        ),
        cell: ({ row }) => (
          <span className="hidden sm:inline text-center">
            {row.original.calendarDays ?? '—'}
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
            onClick={() => travelStore.deleteTrip(row.original.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ),
      },
    ],
    [editingCell, editValue]
  );

  const table = useReactTable({
    data: travelStore.tripsWithCalculations,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="w-full">
      {/* Add Row Button */}
      <div className="mb-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full md:w-auto"
          onClick={() => travelStore.addTrip()}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Trip
        </Button>
      </div>

      {/* Mobile Cards View */}
      <div className="block md:hidden space-y-2">
        {table.getRowModel().rows.map((row, index) => (
          <div
            key={row.id}
            className={`p-3 rounded-lg border ${
              row.original.isIncomplete
                ? 'bg-red-50 border-red-200'
                : 'bg-white border-slate-200'
            } ${draggedIndex === index ? 'opacity-50' : ''}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
          >
            <div className="flex justify-between items-start mb-2">
              <div
                className="cursor-move pr-2 flex-shrink-0"
                onTouchStart={() => handleDragStart(index)}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Out</div>
                <div
                  className="font-medium cursor-pointer hover:text-primary"
                  onClick={() =>
                    startEditing(
                      row.original.id,
                      'outDate',
                      row.original.outDate
                    )
                  }
                >
                  {row.original.outDate
                    ? formatDate(row.original.outDate)
                    : 'Click to set'}
                </div>
                <div
                  className="text-xs text-muted-foreground truncate max-w-[140px] cursor-pointer hover:text-foreground"
                  onClick={() =>
                    startEditing(
                      row.original.id,
                      'outRoute',
                      row.original.outRoute
                    )
                  }
                >
                  {row.original.outRoute || 'Add route'}
                </div>
              </div>
              <div className="text-center px-3">
                <div className="text-2xl font-bold text-primary">
                  {row.original.fullDays ?? '—'}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase">
                  Full Days
                </div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-xs text-muted-foreground">In</div>
                <div
                  className="font-medium cursor-pointer hover:text-primary"
                  onClick={() =>
                    startEditing(row.original.id, 'inDate', row.original.inDate)
                  }
                >
                  {row.original.inDate
                    ? formatDate(row.original.inDate)
                    : 'Click to set'}
                </div>
                <div
                  className="text-xs text-muted-foreground truncate max-w-[140px] cursor-pointer hover:text-foreground"
                  onClick={() =>
                    startEditing(
                      row.original.id,
                      'inRoute',
                      row.original.inRoute
                    )
                  }
                >
                  {row.original.inRoute || 'Add route'}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => travelStore.deleteTrip(row.original.id)}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
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
                    className="px-3 py-2.5 text-left font-medium text-slate-600"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
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
                  No trips yet. Add a trip or import from PDF.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`transition-colors ${
                    row.original.isIncomplete
                      ? 'bg-red-50 hover:bg-red-100'
                      : 'bg-white hover:bg-slate-50'
                  } ${draggedIndex === index ? 'opacity-50' : ''}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal for Mobile */}
      {editingCell && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:hidden">
          <div className="w-full bg-white rounded-t-2xl p-4 animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">
                Edit {editingCell.columnId.replace(/([A-Z])/g, ' $1').trim()}
              </h3>
              <Button variant="ghost" size="icon" onClick={cancelEdit}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <Input
              type={editingCell.columnId.includes('Date') ? 'date' : 'text'}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveEdit}>
                Save
              </Button>
              <Button variant="outline" className="flex-1" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
