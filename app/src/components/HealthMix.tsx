import Link from 'next/link';

const BANDS = [
  { key: 'green', label: 'Healthy', colour: '#12805c', note: 'score 80-100' },
  { key: 'yellow', label: 'Watch', colour: '#a86a00', note: 'score 50-79' },
  { key: 'red', label: 'At risk', colour: '#c0322b', note: 'below 50' },
] as const;

const CX = 96;
const CY = 92;
const R_OUT = 62;
const R_IN = 38;
const GAP = 1.6;

function point(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

/** One ring segment as a closed path, so it can be filled rather than stroked. */
function arc(from: number, to: number): string {
  const large = to - from > 180 ? 1 : 0;
  const [ax, ay] = point(R_OUT, from);
  const [bx, by] = point(R_OUT, to);
  const [dx, dy] = point(R_IN, to);
  const [ex, ey] = point(R_IN, from);
  return [
    `M${ax.toFixed(2)} ${ay.toFixed(2)}`,
    `A${R_OUT} ${R_OUT} 0 ${large} 1 ${bx.toFixed(2)} ${by.toFixed(2)}`,
    `L${dx.toFixed(2)} ${dy.toFixed(2)}`,
    `A${R_IN} ${R_IN} 0 ${large} 0 ${ex.toFixed(2)} ${ey.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/**
 * The portfolio's health mix, as a ring with a legend that filters the list.
 *
 * Sits below the table rather than above it: it gives context, and a funder
 * came to the page for the list of businesses, not for a chart about them.
 */
export function HealthMix({
  orgId,
  counts,
  activeTier,
}: {
  orgId: string;
  counts: { green: number; yellow: number; red: number };
  activeTier: string;
}) {
  const total = counts.green + counts.yellow + counts.red;
  const present = BANDS.filter((b) => counts[b.key] > 0);

  let cursor = 0;
  const slices = present.map((b) => {
    const sweep = (counts[b.key] / (total || 1)) * 360;
    const from = cursor + (present.length > 1 ? GAP / 2 : 0);
    const to = cursor + sweep - (present.length > 1 ? GAP / 2 : 0);
    cursor += sweep;
    return { ...b, d: arc(from, Math.max(from + 0.1, to)) };
  });

  return (
    <div
      className="panel-body"
      style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}
    >
      <div style={{ flex: '0 0 auto' }}>
        <svg
          className="donut"
          viewBox="0 0 192 184"
          width={168}
          height={161}
          role="img"
          aria-label={`${counts.green} healthy, ${counts.yellow} on watch, ${counts.red} at risk`}
        >
          {total === 0 ? (
            <circle cx={CX} cy={CY} r={(R_OUT + R_IN) / 2} fill="none" stroke="var(--line)"
              strokeWidth={R_OUT - R_IN} />
          ) : (
            slices.map((s) => <path key={s.key} d={s.d} fill={s.colour} />)
          )}
          <text className="dnum" x={CX} y={CY + 2} textAnchor="middle">
            {total}
          </text>
          <text className="dlbl" x={CX} y={CY + 18} textAnchor="middle">
            {total === 1 ? 'business' : 'businesses'}
          </text>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 170 }}>
        <div className="mix-legend">
          {BANDS.map((b) => (
            <Link
              key={b.key}
              href={`/funder/${orgId}${activeTier === b.key ? '' : `?tier=${b.key}`}`}
              className={activeTier === b.key ? 'on' : ''}
              title={b.note}
            >
              <i style={{ background: b.colour }} />
              {b.label}
              <span className="n">{counts[b.key]}</span>
            </Link>
          ))}
        </div>
        <div className="mix-hint">Click a band to filter the list, click again to clear.</div>
      </div>
    </div>
  );
}
