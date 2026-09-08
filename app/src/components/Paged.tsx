'use client';

import { useEffect, useMemo, useState } from 'react';

/** Ten fits a laptop screen without scrolling and keeps paging quick. */
export const PAGE_SIZE = 10;

/**
 * Pagination for the admin tables.
 *
 * A render prop rather than a table component, because every table on the
 * staff side has different columns and only the paging is shared. This owns
 * the arithmetic, the controls and the "showing 1 to 10 of 240" line; the
 * caller keeps its own markup.
 *
 * Below the page size nothing is rendered at all: a pager under a four-row
 * table is furniture, not navigation.
 */
export function Paged<T>({
  items,
  pageSize = PAGE_SIZE,
  label,
  children,
}: {
  items: T[];
  pageSize?: number;
  /** Plural noun for the counts line, e.g. "businesses". */
  label: string;
  children: (pageItems: T[], offset: number) => React.ReactNode;
}) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  /* A filter upstream can shorten the list under a reader who is on page 9.
     Snapping back to the last real page beats showing an empty table. */
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const start = (safePage - 1) * pageSize;
  const pageItems = useMemo(
    () => items.slice(start, start + pageSize),
    [items, start, pageSize],
  );

  return (
    <>
      {children(pageItems, start)}

      {items.length > pageSize && (
        <div className="pager">
          <div className="pager-count">
            Showing <b>{start + 1}</b>&ndash;<b>{Math.min(start + pageSize, items.length)}</b> of{' '}
            <b>{items.length}</b> {label}
          </div>

          <div className="pager-controls">
            <button
              type="button"
              className="pager-btn"
              onClick={() => setPage(1)}
              disabled={safePage <= 1}
              aria-label="First page"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17 5l-7 7 7 7M7 5v14" />
              </svg>
            </button>
            <button
              type="button"
              className="pager-btn"
              onClick={() => setPage(safePage - 1)}
              disabled={safePage <= 1}
              aria-label="Previous page"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>

            {pageNumbers(safePage, totalPages).map((n, i) =>
              n === null ? (
                <span className="pager-gap" key={`gap${i}`} aria-hidden="true">
                  &hellip;
                </span>
              ) : (
                <button
                  type="button"
                  key={n}
                  className={`pager-btn${n === safePage ? ' on' : ''}`}
                  onClick={() => setPage(n)}
                  aria-label={`Page ${n}`}
                  aria-current={n === safePage ? 'page' : undefined}
                >
                  {n}
                </button>
              ),
            )}

            <button
              type="button"
              className="pager-btn"
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= totalPages}
              aria-label="Next page"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              type="button"
              className="pager-btn"
              onClick={() => setPage(totalPages)}
              disabled={safePage >= totalPages}
              aria-label="Last page"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 5l7 7-7 7M17 5v14" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The page numbers to show, with gaps.
 *
 * Always the first and last page, always the current one and its neighbours.
 * A thousand businesses is a hundred pages, and a hundred buttons is not
 * navigation; this keeps the control a fixed width however long the list is.
 * `null` marks an elided run.
 */
function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const out: (number | null)[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);

  if (from > 2) out.push(null);
  for (let n = from; n <= to; n += 1) out.push(n);
  if (to < total - 1) out.push(null);

  out.push(total);
  return out;
}
