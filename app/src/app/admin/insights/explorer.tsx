'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Paged } from '@/components/Paged';

/** The slice of an insight row this component needs, kept serialisable. */
export interface ExplorerRow {
  id: string;
  name: string;
  industry: string;
  region: string;
  fundingStatus: string;
  funderName: string | null;
  months: number;
  score: number | null;
  tier: 'green' | 'yellow' | 'red' | null;
  createdAt: string;
}

type Dimension = 'industry' | 'region' | 'fundingStatus';

const DIMENSION_LABEL: Record<Dimension, string> = {
  industry: 'Industry',
  region: 'Region',
  fundingStatus: 'Funding status',
};

const TIER_LABEL: Record<string, string> = {
  green: 'Healthy',
  yellow: 'Watch',
  red: 'At risk',
  none: 'Not yet scored',
};

/** Every distinct value of one field, with blanks folded into one bucket. */
function optionsFor(rows: ExplorerRow[], key: Dimension): string[] {
  return [...new Set(rows.map((r) => r[key] || 'Not stated'))].sort();
}

/**
 * The breakdown explorer.
 *
 * Filtering happens in the browser rather than on the server, deliberately.
 * The whole platform is a few hundred rows at the scale this runs at, so a
 * round trip per filter change would add latency to a control that should feel
 * instant, and the data is already on the page. If the platform outgrows that,
 * this is the component to move to a server action, not the page around it.
 *
 * The bars are counts, not an average score. An average over four businesses
 * in one province reads as a fact about that province, which it is not; a
 * count with a tier split says exactly what it knows.
 */
export function InsightsExplorer({ rows }: { rows: ExplorerRow[] }) {
  const [dimension, setDimension] = useState<Dimension>('industry');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [tier, setTier] = useState('');

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (industry && (r.industry || 'Not stated') !== industry) return false;
        if (region && (r.region || 'Not stated') !== region) return false;
        if (tier === 'none' ? r.tier !== null : tier && r.tier !== tier) return false;
        return true;
      }),
    [rows, industry, region, tier],
  );

  /* Grouped on whichever dimension is selected, largest first. */
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { total: number; green: number; yellow: number; red: number; unscored: number; months: number }
    >();

    for (const r of filtered) {
      const key = r[dimension] || 'Not stated';
      const g =
        map.get(key) ?? { total: 0, green: 0, yellow: 0, red: 0, unscored: 0, months: 0 };
      g.total += 1;
      g.months += r.months;
      if (r.tier === 'green') g.green += 1;
      else if (r.tier === 'yellow') g.yellow += 1;
      else if (r.tier === 'red') g.red += 1;
      else g.unscored += 1;
      map.set(key, g);
    }

    return [...map.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  }, [filtered, dimension]);

  const widest = Math.max(...groups.map((g) => g.total), 1);

  const scored = filtered.filter((r) => r.score !== null);
  const averageScore = scored.length
    ? scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length
    : null;
  const reporting = filtered.filter((r) => r.months > 0).length;

  const anyFilter = industry !== '' || region !== '' || tier !== '';

  /* Sorted once here rather than inside the table, so paging slices an order
     that is already settled. */
  const ranked = useMemo(
    () => [...filtered].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    [filtered],
  );

  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>Break the platform down</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            {filtered.length} of {rows.length} businesses
          </span>
        </div>

        <div className="panel-body">
          <div className="adm-filters">
            <label className="adm-filter">
              <span>Group by</span>
              <select value={dimension} onChange={(e) => setDimension(e.target.value as Dimension)}>
                {(Object.keys(DIMENSION_LABEL) as Dimension[]).map((d) => (
                  <option key={d} value={d}>
                    {DIMENSION_LABEL[d]}
                  </option>
                ))}
              </select>
            </label>

            <label className="adm-filter">
              <span>Industry</span>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                <option value="">All industries</option>
                {optionsFor(rows, 'industry').map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>

            <label className="adm-filter">
              <span>Region</span>
              <select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">All regions</option>
                {optionsFor(rows, 'region').map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>

            <label className="adm-filter">
              <span>Health</span>
              <select value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">Any health</option>
                <option value="green">Healthy</option>
                <option value="yellow">Watch</option>
                <option value="red">At risk</option>
                <option value="none">Not yet scored</option>
              </select>
            </label>

            {anyFilter && (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  setIndustry('');
                  setRegion('');
                  setTier('');
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="statstrip" style={{ marginTop: 14, marginBottom: 0 }}>
            <div className="s">
              <div className="l">In this selection</div>
              <div className="v">{filtered.length}</div>
              <div className="f">{reporting} reporting</div>
            </div>
            <div className="s">
              <div className="l">Average score</div>
              <div className="v">{averageScore === null ? '—' : averageScore.toFixed(1)}</div>
              <div className="f">
                {scored.length ? `across ${scored.length} scored` : 'none scored yet'}
              </div>
            </div>
            <div className="s">
              <div className="l">Healthy</div>
              <div className="v">{filtered.filter((r) => r.tier === 'green').length}</div>
              <div className="f">score 75 and above</div>
            </div>
            <div className="s">
              <div className="l">At risk</div>
              <div className="v">{filtered.filter((r) => r.tier === 'red').length}</div>
              <div className="f">needs attention now</div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>By {DIMENSION_LABEL[dimension].toLowerCase()}</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            Each bar split by health
          </span>
        </div>
        <div className="panel-body">
          {groups.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Nothing matches these filters.
            </p>
          ) : (
            <div className="adm-bars">
              {groups.map((g) => (
                <div className="adm-bar-row" key={g.key}>
                  <div className="adm-bar-label" title={g.key}>
                    {g.key}
                  </div>
                  <div className="adm-bar-track">
                    {/* Widths are shares of the group, and the group's own width
                        is its share of the largest group, so one bar is
                        comparable with the next as well as within itself. */}
                    <div
                      className="adm-bar"
                      style={{ width: `${(g.total / widest) * 100}%` }}
                      aria-hidden="true"
                    >
                      {g.green > 0 && (
                        <span className="seg green" style={{ flex: g.green }} title={`${g.green} healthy`} />
                      )}
                      {g.yellow > 0 && (
                        <span className="seg yellow" style={{ flex: g.yellow }} title={`${g.yellow} on watch`} />
                      )}
                      {g.red > 0 && (
                        <span className="seg red" style={{ flex: g.red }} title={`${g.red} at risk`} />
                      )}
                      {g.unscored > 0 && (
                        <span
                          className="seg none"
                          style={{ flex: g.unscored }}
                          title={`${g.unscored} not yet scored`}
                        />
                      )}
                    </div>
                  </div>
                  <div className="adm-bar-value">
                    {g.total}
                    <span className="tiny muted"> · {g.months} months</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="row adm-legend">
            {(['green', 'yellow', 'red', 'none'] as const).map((k) => (
              <span className="row" style={{ gap: 6 }} key={k}>
                <span className={`legend-dot ${k}`} />
                {TIER_LABEL[k]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>The businesses in this selection</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            Best score first
          </span>
        </div>
        <Paged items={ranked} label="businesses">
          {(pageRows) => (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Industry</th>
                <th>Region</th>
                <th>Funder</th>
                <th className="num">Months</th>
                <th className="num">Score</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '18px 8px' }}>
                    Nothing matches these filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/admin/business/${r.id}`}
                        style={{ textDecoration: 'none', color: 'var(--ink)' }}
                      >
                        <strong>{r.name}</strong>
                      </Link>
                    </td>
                    <td className="muted">{r.industry || '—'}</td>
                    <td className="muted">{r.region || '—'}</td>
                    <td className="muted">{r.funderName || '—'}</td>
                    <td className="num mono">{r.months || <span className="muted">None</span>}</td>
                    <td className="num">
                      {r.score === null ? (
                        <span className="muted">—</span>
                      ) : (
                        <span className={`chip ${r.tier}`}>{r.score}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          )}
        </Paged>
      </div>
    </>
  );
}
