'use client';

import { useMemo, useState } from 'react';
import { monthLabel } from '@proven/engine';

export interface GrowthPoint {
  month: string;
  businesses: number;
  reporting: number;
}

/** The ranges offered above the chart, in months. `null` is everything. */
const RANGES: { key: string; label: string; months: number | null }[] = [
  { key: '6m', label: '6M', months: 6 },
  { key: '1y', label: '1Y', months: 12 },
  { key: '3y', label: '3Y', months: 36 },
  { key: 'all', label: 'All', months: null },
];

const SERIES = [
  { key: 'businesses' as const, label: 'Enrolled', colour: '#1d5490', fill: 'growthEnrolled' },
  { key: 'reporting' as const, label: 'Reporting', colour: '#1f7a4d', fill: 'growthReporting' },
];

/**
 * Platform growth: businesses enrolled against businesses actually reporting.
 *
 * Hand-drawn SVG, matching the rest of the product: nothing to load, nothing to
 * break offline, and every number on it is inspectable.
 *
 * Two cumulative totals rather than per-month additions. The question a board
 * asks is "how big is this now", and the gap between the lines answers the one
 * that matters more: how many businesses enrolled and then went quiet.
 *
 * Interactive in two ways, both worth the code. The range buttons cut the
 * series down so a recent stretch is not flattened by two years of history
 * beside it. Hovering — or moving through it with the arrow keys — reads out
 * the exact figures for one month, because a chart is for the shape and a
 * reader who wants the number should not have to estimate it against a
 * gridline.
 */
export function GrowthChart({ data }: { data: GrowthPoint[] }) {
  const [range, setRange] = useState<string>('all');
  const [active, setActive] = useState<number | null>(null);

  const d = useMemo(() => {
    const months = RANGES.find((r) => r.key === range)?.months ?? null;
    return months === null ? data : data.slice(-months);
  }, [data, range]);

  /* Only offer a range there is actually history for: a 3Y button on four
     months of data promises something the chart cannot show. "All" always
     stays, so there is never a moment with nothing to press. */
  const available = RANGES.filter(
    (r) => r.months === null || data.length > r.months,
  );

  if (d.length < 2) {
    return (
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Growth needs at least two months of enrolments to show a line. There
        {data.length === 1 ? ' is one month' : ' are none'} so far.
      </p>
    );
  }

  const W = 760;
  const H = 220;
  const P = { t: 14, r: 16, b: 30, l: 44 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;

  /* Always anchored at zero. These are counts of real businesses, and a
     truncated axis would make three sign-ups look like a doubling. */
  const max = Math.max(...d.map((p) => p.businesses), 1);
  const top = Math.ceil(max * 1.15);

  const n = d.length;
  const x = (i: number) => P.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => P.t + ih - (v / top) * ih;

  const path = (key: 'businesses' | 'reporting') =>
    d.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');

  const area = (key: 'businesses' | 'reporting') =>
    `${path(key)} L${x(n - 1).toFixed(1)} ${P.t + ih} L${x(0).toFixed(1)} ${P.t + ih} Z`;

  const ticks = 3;
  const grid = Array.from({ length: ticks + 1 }, (_, i) => ({
    yy: P.t + (ih / ticks) * i,
    v: Math.round(top - (top / ticks) * i),
  }));

  /* Every label on a long series collides, so only some are drawn. The first
     and last always are: they are the two a reader looks for. */
  const step = Math.ceil(n / 7);

  const latest = d[d.length - 1]!;
  const shown = active !== null && d[active] ? d[active]! : latest;
  const quiet = shown.businesses - shown.reporting;

  /* Which point the pointer is nearest, from its position across the plot. */
  function pointFromEvent(event: React.MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const i = Math.round(((ratio * W - P.l) / iw) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  }

  return (
    <div className="growth">
      <div className="growth-head">
        {/* Reads the hovered month, or the latest when nothing is hovered, so
            the figures are always stated rather than left to be measured off
            the axis. */}
        <div className="growth-readout">
          <div className="growth-month">{monthLabel(shown.month)}</div>
          <div className="growth-figures">
            {SERIES.map((s) => (
              <span key={s.key} className="growth-fig">
                <span className="growth-dot" style={{ background: s.colour }} />
                {s.label} <b>{shown[s.key]}</b>
              </span>
            ))}
            {quiet > 0 && (
              <span className="tiny muted">
                {quiet} enrolled but not reporting
              </span>
            )}
          </div>
        </div>

        {available.length > 1 && (
          <div className="growth-ranges" role="group" aria-label="Chart range">
            {available.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`growth-range${range === r.key ? ' on' : ''}`}
                onClick={() => {
                  setRange(r.key);
                  setActive(null);
                }}
                aria-pressed={range === r.key}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="table-wrap">
        <svg
          className="chart growth-svg"
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ maxWidth: W, display: 'block' }}
          role="img"
          aria-label={`Platform growth: ${latest.businesses} businesses enrolled, ${latest.reporting} reporting`}
          onMouseMove={pointFromEvent}
          onMouseLeave={() => setActive(null)}
          tabIndex={0}
          onKeyDown={(e) => {
            /* The same reading by keyboard, so the figures are not locked
               behind a pointer. */
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              setActive((i) => Math.min(n - 1, (i === null ? n - 1 : i) + 1));
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setActive((i) => Math.max(0, (i === null ? n - 1 : i) - 1));
            } else if (e.key === 'Escape') {
              setActive(null);
            }
          }}
        >
          <defs>
            <linearGradient id="growthEnrolled" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d5490" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#1d5490" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="growthReporting" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1f7a4d" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#1f7a4d" stopOpacity="0" />
            </linearGradient>
          </defs>

          {grid.map(({ yy, v }, i) => (
            <g key={i}>
              <line x1={P.l} y1={yy.toFixed(1)} x2={W - P.r} y2={yy.toFixed(1)} stroke="#eaeff6" />
              <text x={P.l - 9} y={(yy + 3.5).toFixed(1)} textAnchor="end" fontSize="10" fill="#8b9bb0">
                {v}
              </text>
            </g>
          ))}

          <path d={area('businesses')} fill="url(#growthEnrolled)" />
          <path d={area('reporting')} fill="url(#growthReporting)" />

          {SERIES.map((s) => (
            <path
              key={s.key}
              d={path(s.key)}
              fill="none"
              stroke={s.colour}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* The hovered month, marked down the whole plot so both series are
              read at the same instant rather than two separate guesses. */}
          {active !== null && d[active] && (
            <g>
              <line
                x1={x(active).toFixed(1)}
                y1={P.t}
                x2={x(active).toFixed(1)}
                y2={P.t + ih}
                stroke="#0a2540"
                strokeOpacity="0.18"
                strokeWidth="1"
              />
              {SERIES.map((s) => (
                <circle
                  key={s.key}
                  cx={x(active).toFixed(1)}
                  cy={y(d[active]![s.key]).toFixed(1)}
                  r="5"
                  fill="#fff"
                  stroke={s.colour}
                  strokeWidth="2.6"
                />
              ))}
            </g>
          )}

          {/* Small markers on every month, so the points are visible as points
              even before anything is hovered. */}
          {SERIES.map((s) =>
            d.map((p, i) =>
              i === active ? null : (
                <circle
                  key={`${s.key}${i}`}
                  cx={x(i).toFixed(1)}
                  cy={y(p[s.key]).toFixed(1)}
                  r="3.2"
                  fill="#fff"
                  stroke={s.colour}
                  strokeWidth="2"
                />
              ),
            ),
          )}

          {d.map((p, i) =>
            i % step === 0 || i === n - 1 ? (
              <text
                key={`l${i}`}
                x={x(i).toFixed(1)}
                y={P.t + ih + 17}
                textAnchor="middle"
                fontSize="10"
                fill={i === active ? '#0a2540' : '#8b9bb0'}
                fontWeight={i === active ? 700 : 400}
              >
                {monthLabel(p.month)}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      <div className="growth-legend">
        {SERIES.map((s) => (
          <span className="growth-fig" key={s.key}>
            <span className="growth-dot" style={{ background: s.colour }} />
            {s.label} ({latest[s.key]})
          </span>
        ))}
        <span className="tiny muted">Hover the chart, or use the arrow keys, for one month.</span>
      </div>
    </div>
  );
}
