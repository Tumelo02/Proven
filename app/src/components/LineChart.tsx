import { moneyShort, type Period } from '@proven/engine';

/**
 * Money in and money out, over the last eight months.
 *
 * Hand-drawn SVG with no charting library: nothing to
 * load, nothing to break offline, and the whole thing is inspectable.
 *
 * Roughly 4:1, wide and low, so a full-width panel does not scale the chart
 * into a tall block that outgrows whatever sits beside it.
 */
export function LineChart({ history }: { history: Period[] }) {
  const h = history.slice(-8);
  if (h.length < 2) return null;

  const W = 760;
  const H = 190;
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

  return (
    <div className="table-wrap">
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxWidth: W, display: 'block' }}
        role="img"
        aria-label="Money in and money out, by month"
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

        <path d={area('revenue')} fill="url(#revFill)" />
        <path d={area('expenses')} fill="url(#expFill)" />

        <path d={path('revenue')} fill="none" stroke="#1d5490" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round" />
        <path d={path('expenses')} fill="none" stroke="#c0322b" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round" />

        {h.map((d, i) => (
          <circle key={`r${i}`} cx={x(i).toFixed(1)} cy={y(d.revenue).toFixed(1)} r="3.5"
            fill="#fff" stroke="#1d5490" strokeWidth="2" />
        ))}
        {h.map((d, i) => (
          <circle key={`e${i}`} cx={x(i).toFixed(1)} cy={y(d.expenses).toFixed(1)} r="3.5"
            fill="#fff" stroke="#c0322b" strokeWidth="2" />
        ))}

        {/* Real month names on the axis, instead of P1, P2, P3. */}
        {h.map((d, i) => (
          <text key={`l${i}`} x={x(i).toFixed(1)} y={P.t + ih + 17} textAnchor="middle"
            fontSize="10" fill="#8b9bb0">
            {monthShort(d.date)}
          </text>
        ))}
      </svg>

      <div className="row" style={{ gap: 16, fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
        <span className="row" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#1d5490', borderRadius: 2 }} />
          Money in
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#c0322b', borderRadius: 2 }} />
          Money out
        </span>
      </div>
    </div>
  );
}
