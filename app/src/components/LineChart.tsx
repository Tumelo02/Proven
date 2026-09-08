'use client';

import { useMemo, useState } from 'react';
import { moneyShort, money, monthLabel, type Period } from '@proven/engine';

/** The ranges offered above the chart, in months. `null` is everything. */
const RANGES: { key: string; label: string; months: number | null }[] = [
  { key: '6m', label: '6M', months: 6 },
  { key: '1y', label: '1Y', months: 12 },
  { key: '2y', label: '2Y', months: 24 },
  { key: 'all', label: 'All', months: null },
];

const SERIES = [
  { key: 'revenue' as const, label: 'Money in', colour: '#1d5490', fill: 'revFill' },
  { key: 'expenses' as const, label: 'Money out', colour: '#c0322b', fill: 'expFill' },
];

/**
 * Money in and money out, month by month.
 *
 * Hand-drawn SVG with no charting library: nothing to load, nothing to break
 * offline, and the whole thing is inspectable.
 *
 * Roughly 4:1, wide and low, so a full-width panel does not scale the chart
 * into a tall block that outgrows whatever sits beside it.
 *
 * The range buttons matter more here than they look. A business with two years
 * of history had its recent months squashed into the right-hand quarter of the
 * chart, which is the part it actually wants to read. Hovering — or the arrow
 * keys — reads out one month exactly, including what was left over, because
 * "did I keep anything last month" is the question and estimating it off a
 * gridline is not an answer.
 */
export function LineChart({ history }: { history: Period[] }) {
  const [range, setRange] = useState<string>('1y');
  const [active, setActive] = useState<number | null>(null);
  /* Which single point is under the pointer. Separate from the month, so one
     series can be singled out where the two lines run close together. */
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const h = useMemo(() => {
    const months = RANGES.find((r) => r.key === range)?.months ?? null;
    return months === null ? history : history.slice(-months);
  }, [history, range]);

  /* Only offer a range there is history for, so a button never promises a
     stretch the chart cannot show. */
  const available = RANGES.filter(
    (r) => r.months === null || history.length > r.months,
  );

  /* A business with one reported month gets that month drawn, not a blank
     space where a chart should be. It returned null before, so the panel
     around it sat empty with no explanation — the worst of both. A line
     appears as soon as there is a second month to join to. */
  if (h.length === 0) return null;

  const W = 760;
  const H = 200;
  const P = { t: 12, r: 16, b: 30, l: 52 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;

  let mx = Math.max(...h.map((x) => Math.max(x.revenue, x.expenses)));
  let mn = Math.min(...h.map((x) => Math.min(x.revenue, x.expenses)));
  const pad = (mx - mn) * 0.18 || mx * 0.1 || 1;
  mx += pad;
  mn = Math.max(0, mn - pad);

  const n = h.length;
  const x = (i: number) => P.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => P.t + ih - ((v - mn) / (mx - mn || 1)) * ih;

  const path = (key: 'revenue' | 'expenses') =>
    h.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');

  /* Area under each line, closed along the baseline, for a soft fill. */
  const area = (key: 'revenue' | 'expenses') =>
    `${path(key)} L${x(n - 1).toFixed(1)} ${P.t + ih} L${x(0).toFixed(1)} ${P.t + ih} Z`;

  const ticks = 3;
  const grid = Array.from({ length: ticks + 1 }, (_, i) => {
    const yy = P.t + (ih / ticks) * i;
    const mv = mx - ((mx - mn) / ticks) * i;
    return { yy, mv };
  });

  const monthShort = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', {
      month: 'short',
      timeZone: 'UTC',
    });

  const step = Math.ceil(n / 8);
  const latest = h[h.length - 1]!;
  const shown = active !== null && h[active] ? h[active]! : latest;
  const left = shown.revenue - shown.expenses;

  function pointFromEvent(event: React.MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const i = Math.round(((ratio * W - P.l) / iw) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  }

  return (
    <div className="growth">
      <div className="growth-head">
        <div className="growth-readout">
          <div className="growth-month">{monthLabel(shown.date)}</div>
          <div className="growth-figures">
            {SERIES.map((s) => (
              <span key={s.key} className="growth-fig">
                <span className="growth-dot" style={{ background: s.colour }} />
                {s.label} <b>{money(shown[s.key])}</b>
              </span>
            ))}
            {/* The figure the other two exist to produce. */}
            <span
              className="growth-fig"
              style={{ color: left >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}
            >
              {left >= 0 ? 'Kept ' : 'Short '}
              {money(Math.abs(left))}
            </span>
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
          aria-label="Money in and money out, by month"
          onMouseMove={pointFromEvent}
          onMouseLeave={() => {
            setActive(null);
            setHoverKey(null);
          }}
          tabIndex={0}
          onKeyDown={(e) => {
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
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d5490" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#1d5490" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c0322b" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#c0322b" stopOpacity="0" />
            </linearGradient>
          </defs>

          {grid.map(({ yy, mv }, i) => (
            <g key={i}>
              <line x1={P.l} y1={yy.toFixed(1)} x2={W - P.r} y2={yy.toFixed(1)} stroke="#eaeff6" />
              <text
                x={P.l - 9}
                y={(yy + 3.5).toFixed(1)}
                textAnchor="end"
                fontSize="10"
                fill="#8b9bb0"
              >
                {moneyShort(mv)}
              </text>
            </g>
          ))}

          {n > 1 && (
            <>
              <path d={area('revenue')} fill="url(#revFill)" />
              <path d={area('expenses')} fill="url(#expFill)" />
            </>
          )}

          {/* One month strokes nothing — the path is a single `M` with no `L`
              after it — so the marker below carries it instead. */}
          {n > 1 &&
            SERIES.map((s) => (
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

          {active !== null && h[active] && (
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
                  cy={y(h[active]![s.key]).toFixed(1)}
                  r="5"
                  fill="#fff"
                  stroke={s.colour}
                  strokeWidth="2.6"
                />
              ))}
            </g>
          )}

          {SERIES.map((s) =>
            h.map((d, i) =>
              i === active ? null : (
                <circle
                  key={`${s.key}${i}`}
                  cx={x(i).toFixed(1)}
                  cy={y(d[s.key]).toFixed(1)}
                  r={n === 1 ? 5 : 3.5}
                  fill="#fff"
                  stroke={s.colour}
                  strokeWidth={n === 1 ? 2.6 : 2}
                />
              ),
            ),
          )}

          {/* One invisible target per point, so a single month's money in or
              money out can be picked out on its own. Generous radius, because
              a 3px dot is not a hit target. */}
          {SERIES.map((s) =>
            h.map((d, i) => (
              <circle
                key={`hit-${s.key}${i}`}
                cx={x(i).toFixed(1)}
                cy={y(d[s.key]).toFixed(1)}
                r="12"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => {
                  setActive(i);
                  setHoverKey(s.key);
                }}
                onMouseLeave={() => setHoverKey(null)}
              >
                <title>{`${monthLabel(d.date)} — ${s.label}: ${money(d[s.key])}`}</title>
              </circle>
            )),
          )}

          {/* Real month names on the axis, instead of P1, P2, P3. */}
          {h.map((d, i) =>
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
                {monthShort(d.date)}
              </text>
            ) : null,
          )}
          {/* The exact figure beside the point, flipped near the right edge so
              it never runs off the plot. */}
          {active !== null && hoverKey && h[active] && (
            (() => {
              const point = h[active]!;
              const series = SERIES.find((s) => s.key === hoverKey)!;
              const px = x(active);
              const py = y(point[series.key]);
              const flip = px > W - 160;
              /* Below the point when there is no room above it, so a value at
                 the top of the axis is not cut off by the edge of the plot. */
              const below = py < 44;
              const boxY = below ? py + 10 : py - 34;
              return (
                <g pointerEvents="none">
                  <rect
                    x={(flip ? px - 146 : px + 12).toFixed(1)}
                    y={boxY.toFixed(1)}
                    width="134"
                    height="40"
                    rx="8"
                    fill="#0a2540"
                    opacity="0.95"
                  />
                  <text
                    x={(flip ? px - 136 : px + 22).toFixed(1)}
                    y={(boxY + 16).toFixed(1)}
                    fontSize="10"
                    fill="#9fb3ca"
                  >
                    {monthLabel(point.date)}
                  </text>
                  <text
                    x={(flip ? px - 136 : px + 22).toFixed(1)}
                    y={(boxY + 30).toFixed(1)}
                    fontSize="12"
                    fontWeight="700"
                    fill="#fff"
                  >
                    {`${series.label}: ${money(point[series.key])}`}
                  </text>
                </g>
              );
            })()
          )}
        </svg>
      </div>

      <div className="growth-legend">
        {SERIES.map((s) => (
          <span className="growth-fig" key={s.key}>
            <span className="growth-dot" style={{ background: s.colour }} />
            {s.label}
          </span>
        ))}
        <span className="tiny muted">Hover the chart, or use the arrow keys, for one month.</span>
      </div>
    </div>
  );
}
