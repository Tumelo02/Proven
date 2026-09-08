'use client';

import { useEffect, useMemo, useState, Children } from 'react';

/** Ten fits a laptop screen without scrolling and keeps paging quick. */
export const PAGE_SIZE = 10;

/**
 * Pagination for the admin tables.
 *
 * Takes already-rendered children and shows one page of them at a time,
 * rather than a function that renders a slice.
 *
 * That distinction matters and is not a style choice. An earlier version took
 * a render prop, which meant a Server Component had to hand this Client
 * Component a *function* as its child. Functions cannot cross that boundary:
 * React has nothing to serialise, so every admin page that used it threw at
 * render time and showed the error screen. Elements serialise; functions do
 * not. So the caller renders its rows on the server, and this only decides
 * which of them are on screen.
 *
 * The cost is that every row is rendered rather than only the visible ten.
 * At the scale this runs at — the whole platform is one page of HTML either
 * way — that is cheaper than the round trip a server-side page would need, and
 * it keeps paging instant. A platform of tens of thousands would want the
 * slice done in the query instead, and this is the component to replace.
 */
export function Paged({
  children,
  pageSize = PAGE_SIZE,
  label,
}: {
  children: React.ReactNode;
  pageSize?: number;
  /** Plural noun for the counts line, e.g. "businesses". */
  label: string;
}) {
  const rows = useMemo(() => Children.toArray(children), [children]);

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  /* A filter upstream can shorten the list under a reader who is on page 9.
     Snapping back to the last real page beats showing an empty table. */
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const start = (safePage - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);

  return (
    <>
      {visible}

      {rows.length > pageSize && (
        <div className="pager">
          <div className="pager-count">
            Showing <b>{start + 1}</b>&ndash;<b>{Math.min(start + pageSize, rows.length)}</b> of{' '}
            <b>{rows.length}</b> {label}
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
 * A paged table body.
 *
 * `Paged` renders its own wrapper markup, which cannot sit between `<table>`
 * and `<tr>`: the browser hoists any stray element out of a table, and the
 * rows lose their table entirely. So the pager goes below the table and this
 * puts only the visible rows inside `<tbody>`.
 */
export function PagedRows({
  children,
  pageSize = PAGE_SIZE,
  label,
  columns,
  empty,
}: {
  children: React.ReactNode;
  pageSize?: number;
  label: string;
  /** Column count, for the empty row's `colSpan`. */
  columns: number;
  empty?: string;
}) {
  const rows = useMemo(() => Children.toArray(children), [children]);

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const start = (safePage - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);

  if (rows.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={columns} className="muted" style={{ textAlign: 'center', padding: '18px 8px' }}>
            {empty ?? 'Nothing to show.'}
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <>
      <tbody>{visible}</tbody>

      {rows.length > pageSize && (
        <tfoot>
          <tr>
            <td colSpan={columns} style={{ padding: 0 }}>
              <div className="pager">
                <div className="pager-count">
                  Showing <b>{start + 1}</b>&ndash;
                  <b>{Math.min(start + pageSize, rows.length)}</b> of <b>{rows.length}</b> {label}
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
            </td>
          </tr>
        </tfoot>
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
