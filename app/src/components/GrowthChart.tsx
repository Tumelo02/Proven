import { monthLabel } from '@proven/engine';

export interface GrowthPoint {
  month: string;
  businesses: number;
  reporting: number;
}

/**
 * Platform growth: businesses enrolled against businesses actually reporting.
 *
 * Hand-drawn SVG, matching `LineChart` on the entrepreneur side: nothing to
 * load, nothing to break offline, and every number on it is inspectable.
 *
 * Two cumulative totals rather than per-month additions. The question a board
 * asks is "how big is this now", and the gap between the lines answers the one
 * that matters more: how many businesses enrolled and then went quiet. A bar
 * of monthly sign-ups hides exactly that.
 */
export function GrowthChart({ data }: { data: GrowthPoint[] }) {
  const d = data.slice(-14);

  if (d.length < 2) {
    return (
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Growth needs at least two months of enrolments to show a line. There
        {d.length === 1 ? ' is one month' : ' are none'} so far.
      </p>
    );
  }

  const W = 760;
  const H = 210;
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
  const quiet = latest.businesses - latest.reporting;

  return (
    <div className="table-wrap">
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxWidth: W, display: 'block' }}
        role="img"
        aria-label={`Platform growth: ${latest.businesses} businesses enrolled, ${latest.reporting} reporting`}
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

        <path
          d={path('businesses')}
          fill="none"
          stroke="#1d5490"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={path('reporting')}
          fill="none"
          stroke="#1f7a4d"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {d.map((p, i) => (
          <circle
            key={`b${i}`}
            cx={x(i).toFixed(1)}
            cy={y(p.businesses).toFixed(1)}
            r="3.2"
            fill="#fff"
            stroke="#1d5490"
            strokeWidth="2"
          />
        ))}
        {d.map((p, i) => (
          <circle
            key={`r${i}`}
            cx={x(i).toFixed(1)}
            cy={y(p.reporting).toFixed(1)}
            r="3.2"
            fill="#fff"
            stroke="#1f7a4d"
            strokeWidth="2"
          />
        ))}

        {d.map((p, i) =>
          i % step === 0 || i === n - 1 ? (
            <text
              key={`l${i}`}
              x={x(i).toFixed(1)}
              y={P.t + ih + 17}
              textAnchor="middle"
              fontSize="10"
              fill="#8b9bb0"
            >
              {monthLabel(p.month)}
            </text>
          ) : null,
        )}
      </svg>

      <div className="row" style={{ gap: 16, fontSize: 12, color: 'var(--muted)', marginTop: 6, flexWrap: 'wrap' }}>
        <span className="row" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#1d5490', borderRadius: 2 }} />
          Enrolled ({latest.businesses})
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#1f7a4d', borderRadius: 2 }} />
          Reporting ({latest.reporting})
        </span>
        {quiet > 0 && (
          <span className="tiny muted">
            The gap is {quiet} business{quiet === 1 ? '' : 'es'} enrolled but never reporting.
          </span>
        )}
      </div>
    </div>
  );
}
