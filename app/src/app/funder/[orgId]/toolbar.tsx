'use client';

import { useRouter } from 'next/navigation';
import { tierLabel } from '@proven/engine';

/**
 * Filter, search and sort for the portfolio.
 *
 * State lives in the URL rather than in the component, so a funder can send
 * someone the exact view they are looking at, and the back button behaves.
 */
export function PortfolioToolbar({
  orgId,
  tier,
  q,
  sort,
  counts,
}: {
  orgId: string;
  tier: string;
  q: string;
  sort: string;
  counts: { all: number; green: number; yellow: number; red: number };
}) {
  const router = useRouter();

  function go(next: Partial<{ tier: string; q: string; sort: string }>) {
    const params = new URLSearchParams();
    const merged = { tier, q, sort, ...next };
    if (merged.tier && merged.tier !== 'all') params.set('tier', merged.tier);
    if (merged.q) params.set('q', merged.q);
    if (merged.sort && merged.sort !== 'score') params.set('sort', merged.sort);
    const qs = params.toString();
    router.push(`/funder/${orgId}${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="toolbar">
      <div className="seg">
        {(['all', 'green', 'yellow', 'red'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={tier === t ? 'on' : ''}
            onClick={() => go({ tier: t })}
          >
            {t === 'all' ? 'All' : tierLabel(t)} ({counts[t]})
          </button>
        ))}
      </div>

      <form
        className="tbfield"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get('q');
          go({ q: String(value ?? '') });
        }}
      >
        <label htmlFor="q">Search</label>
        <input
          id="q"
          name="q"
          type="text"
          defaultValue={q}
          placeholder="Business, industry or region…"
        />
      </form>

      <div className="tbfield">
        <label htmlFor="sortSel">Sort</label>
        <select id="sortSel" value={sort} onChange={(e) => go({ sort: e.target.value })}>
          <option value="score">Health score</option>
          <option value="name">Name</option>
          <option value="industry">Industry</option>
        </select>
      </div>

      {/* The report every funder and incubator has to send upward, otherwise
          rebuilt by hand from figures already held here. */}
      <div className="exports">
        {/* Excel downloads, so it carries the download arrow. */}
        <a className="btn ghost sm" href={`/funder/${orgId}/export`} title="Download as a spreadsheet">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.5v11" />
            <path d="m7.5 10 4.5 4.5 4.5-4.5" />
            <path d="M4 16.5v4h16v-4" />
          </svg>
          Excel
        </a>

        {/* PDF opens the report to read first. No download arrow: saving a copy
            is a decision the funder makes after seeing it, not before. */}
        <a className="btn ghost sm" href={`/funder/${orgId}/report`} title="Open the printable report">
          PDF
        </a>
      </div>
    </div>
  );
}
