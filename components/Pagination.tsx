'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page:     number;
  pages:    number;
  count:    number;
  pageSize?: number;  // doit correspondre au PAGE_SIZE du backend (10)
  onPage:   (p: number) => void;
}

export function Pagination({ page, pages, count, pageSize = 10, onPage }: PaginationProps) {
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, count);

  // Build page numbers with ellipsis
  const range: (number | '…')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) {
      range.push(p);
    } else if (range[range.length - 1] !== '…') {
      range.push('…');
    }
  }

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
      <p className="text-xs text-iss-gray">
        {pages > 1 ? <>{from}–{to} sur </> : ''}<span className="font-semibold">{count}</span> résultat{count !== 1 ? 's' : ''}
      </p>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            className="p-1.5 rounded-lg border border-gray-200 text-iss-gray hover:bg-gray-50
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>

          {range.map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1 text-xs text-iss-gray select-none">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p as number)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                  p === page
                    ? 'text-white'
                    : 'border border-gray-200 text-iss-gray hover:bg-gray-50'
                }`}
                style={p === page ? { background: 'linear-gradient(135deg,#006633,#008844)' } : undefined}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => onPage(page + 1)}
            disabled={page === pages}
            className="p-1.5 rounded-lg border border-gray-200 text-iss-gray hover:bg-gray-50
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
