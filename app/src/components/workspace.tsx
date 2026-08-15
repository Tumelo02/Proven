import {
  healthAt,
  tierLabel,
  tierOf,
  type BusinessInput,
  type GuidanceItem,
  type Tier,
  type Trend,
} from '@proven/engine';

/** The score, in a coloured ring. */
export function ScoreRing({
  score,
  tier,
  label = 'SCORE',
}: {
  score: number;
  tier: Tier;
  label?: string;
}) {
  const color =
    tier === 'green' ? '#12805c' : tier === 'yellow' ? '#a86a00' : '#c0322b';
  const bg = tier === 'green' ? '#e3f6ee' : tier === 'yellow' ? '#fdf1dc' : '#fdeae8';

  return (
    <div
      className="ring"
      style={{ background: bg }}
      role="img"
      aria-label={`Score ${score} out of 100, ${tierLabel(tier)}`}
    >
      <div>
        <div>
          <div className="n" style={{ color }}>
            {score}
          </div>
          <div className="u">{label}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Six months of score in a thumbnail.
 *
 * Shows direction, which a single number cannot. Deliberately small: it
 * supports the ring rather than competing with it.
 */
export function ScoreSpark({ biz }: { biz: Pick<BusinessInput, 'history'> }) {
  const pts = biz.history.map((_, i) => healthAt(biz, i).score).slice(-6);
  if (pts.length < 2) return null;

  const W = 108;
  const H = 30;
  const mn = Math.min(...pts);
  const mx = Math.max(...pts);
  const span = mx - mn || 1;

  const x = (i: number) => (i / (pts.length - 1)) * (W - 4) + 2;
  const y = (v: number) => H - 3 - ((v - mn) / span) * (H - 8);

  const d = pts
    .map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');

  const lastTier = tierOf(pts[pts.length - 1]!);
  const col =
    lastTier === 'green' ? '#12805c' : lastTier === 'yellow' ? '#a86a00' : '#c0322b';

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <path d={d} fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(pts.length - 1).toFixed(1)} cy={y(pts[pts.length - 1]!).toFixed(1)} r="2.8" fill={col} />
    </svg>
  );
}

export function TrendGlyph({ trend, delta }: { trend: Trend; delta: number }) {
  const glyph = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '-';
  return (
    <span className={`trend ${trend}`}>
      {glyph} {delta > 0 ? '+' : ''}
      {delta.toFixed(1)}
    </span>
  );
}

export function Chip({ tier, children }: { tier: string; children: React.ReactNode }) {
  return (
    <span className={`chip ${tier}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

/** One piece of guidance. The issue, then the practical next step. */
export function RecCard({ g }: { g: GuidanceItem }) {
  return (
    <div className={`rec-card ${g.sev}`}>
      <div className="issue">{g.issue}</div>
      <div className="rec">
        <b>Try this:</b> {g.rec}
      </div>
    </div>
  );
}

export function Kpi({
  label,
  value,
  foot,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  foot: string;
  tone?: string;
}) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="foot">{foot}</div>
    </div>
  );
}

export function Panel({
  title,
  hint,
  className,
  children,
}: {
  title?: string;
  hint?: string;
  /** Extra classes on the panel itself, e.g. spacing between stacked panels. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ? `panel ${className}` : 'panel'}>
      {title && (
        <div className="panel-head">
          <h3>{title}</h3>
          {hint && <span className="hint" style={{ marginLeft: 'auto' }}>{hint}</span>}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </div>
  );
}
