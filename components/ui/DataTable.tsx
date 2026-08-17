'use client';

import { useMemo } from 'react';
import LoadingSkeleton from './LoadingSkeleton';
import EmptyState from './EmptyState';

export interface Column<T> {
  key:       string;
  header:    string;
  render?:   (row: T, index: number) => React.ReactNode;
  /** Largeur CSS optionnelle ex: "w-32" */
  width?:    string;
  align?:    'left' | 'center' | 'right';
  sortable?: boolean;
}

interface DataTableProps<T extends { id: number | string }> {
  columns:     Column<T>[];
  data:        T[];
  loading?:    boolean;
  emptyTitle?: string;
  emptyDesc?:  string;
  /** Rendu des actions inline (modifier, supprimer…) */
  actions?:    (row: T) => React.ReactNode;
  /** Clic sur une ligne */
  onRowClick?: (row: T) => void;
  className?:  string;
}

/** DataTable générique : columns typées, skeleton, état vide, actions inline. */
export default function DataTable<T extends { id: number | string }>({
  columns, data, loading = false,
  emptyTitle = 'Aucun résultat', emptyDesc,
  actions, onRowClick, className = '',
}: DataTableProps<T>) {
  const allCols = useMemo(() => {
    return actions
      ? [...columns, { key: '_actions', header: 'Actions', align: 'right' as const }]
      : columns;
  }, [columns, actions]);

  if (loading) return <LoadingSkeleton rows={5} cols={allCols.length} className="mt-2" />;

  if (!data.length) return <EmptyState title={emptyTitle} description={emptyDesc} />;

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="data-table w-full">
        <thead>
          <tr>
            {allCols.map(col => {
              // Tailwind safe : classes statiques explicites (sinon purge en build)
              const headerAlign = col.align === 'left' ? 'text-left'
                : col.align === 'right' ? 'text-right' : 'text-center';
              return (
                <th
                  key={col.key}
                  className={`${col.width ?? ''} ${headerAlign}`}
                  style={{ textAlign: col.align ?? 'center' }}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer' : ''}
            >
              {columns.map(col => {
                const cellAlign = col.align === 'center' ? 'text-center'
                  : col.align === 'right' ? 'text-right' : 'text-left';
                return (
                  <td
                    key={col.key}
                    className={`${cellAlign} ${col.width ?? ''}`}
                    style={{ textAlign: col.align ?? 'left' }}
                  >
                    {col.render
                      ? col.render(row, rowIndex)
                      : String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                );
              })}
              {actions && (
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    {actions(row)}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
