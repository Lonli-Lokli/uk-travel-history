'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { flexRender } from '@tanstack/react-table';
import type { Row } from '@tanstack/react-table';
import type { TripWithCalculations } from '@uth/rules';

interface SortableTableRowProps {
  row: Row<TripWithCalculations>;
  onRowClick: (tripId: string) => void;
}

export function SortableTableRow({ row, onRowClick }: SortableTableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.original.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`transition-colors cursor-pointer ${
        row.original.isIncomplete
          ? 'bg-red-50 hover:bg-red-100'
          : 'bg-white hover:bg-slate-50'
      } ${isDragging ? 'shadow-lg' : ''}`}
      onClick={() => onRowClick(row.original.id)}
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className="px-3 py-2"
          {...(cell.column.id === 'drag-handle' ? listeners : {})}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}
