import Link from 'next/link';
import { monthLabel } from '@proven/engine';
import { requireAdmin } from '../guard';
import { AdminShell } from '../admin-shell';
import { PagedRows } from '@/components/Paged';
import type { AdminInsightRow } from '@/lib/queries';
import '../../workspace.css';
import '../../admin.css';

/**
 * Who is doing well, and who needs an eye.
 *
 * The scores here are the same ones the entrepreneur and their funder see,
 * from the same engine, so nothing on this page is a staff-only opinion about
 * a business.
 *
 * At risk comes first. A page that opens on its best businesses is a page for
 * reporting upward; this one is for finding the business that is about to fail
 * while everyone is looking at the average.
 */
function HealthTable({
  rows,
  empty,
}: {
  rows: AdminInsightRow[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="panel-body">
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
          {empty}
        </p>
      </div>
    );
  }

  /* Paged, because these lists are unbounded: every business on the platform
     lands in exactly one of them, so a thousand businesses is a thousand rows
     to scroll past.

     The rows are rendered here and handed to `PagedRows` as elements. Passing
     it a function instead would mean this Server Component sending a function
     across the client boundary, which React cannot serialise. */
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Industry</th>
            <th>Funder</th>
            <th className="num">Score</th>
            <th className="num">Trend</th>
            <th>Last month</th>
            <th>Reporting</th>
          </tr>
        </thead>
        <PagedRows label="businesses" columns={7}>
          {rows.map((r) => (
            <tr key={r.business.id}>
              <td>
                <Link
                  href={`/admin/business/${r.business.id}`}
                  style={{ textDecoration: 'none', color: 'var(--ink)' }}
                >
                  <strong>{r.business.name}</strong>
                </Link>
                <div className="tiny muted">{r.business.region || 'Region not stated'}</div>
              </td>
              <td className="muted">{r.business.industry || '—'}</td>
              <td className="muted">{r.funderName || <span className="tiny">Not linked</span>}</td>
              <td className="num">
                {r.score === null ? (
                  <span className="muted">—</span>
                ) : (
                  <span className={`chip ${r.tier}`}>{r.score}</span>
                )}
              </td>
              <td className="num mono">
                {r.trend === null ? (
                  <span className="muted">—</span>
                ) : (
                  <span
                    style={{
                      color:
                        r.trend === 'up'
                          ? 'var(--green)'
                          : r.trend === 'down'
                            ? 'var(--red)'
                            : 'var(--muted)',
                    }}
                  >
                    {r.trend === 'up' ? '▲' : r.trend === 'down' ? '▼' : '•'}{' '}
                    {r.delta > 0 ? '+' : ''}
                    {r.delta.toFixed(1)}
                  </span>
                )}
              </td>
              <td className="muted">{r.lastReported ? monthLabel(r.lastReported) : '—'}</td>
              <td>
                <span className={`due-pill ${r.reportingState}`}>{r.reportingLabel}</span>
              </td>
            </tr>
          ))}
        </PagedRows>
      </table>
    </div>
  );
}

export default async function AdminHealthPage() {
  const { profile, intel, badges, hide } = await requireAdmin();

  const scored = intel.rows.filter((r) => r.score !== null);
  const byScore = [...scored].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

  const atRisk = byScore.filter((r) => r.tier === 'red');
  const watch = byScore.filter((r) => r.tier === 'yellow');
  const healthy = [...byScore].reverse().filter((r) => r.tier === 'green');
  const unscored = intel.rows.filter((r) => r.score === null);

  /* Falling regardless of tier. A business dropping from 88 to 76 is still
     "healthy" and is still the most interesting thing on the page, because the
     direction is what a tier cannot tell you. */
  const falling = scored
    .filter((r) => r.trend === 'down')
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 8);

  const average = scored.length
    ? (scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length).toFixed(1)
    : '—';

  return (
    <AdminShell
      active="health"
      email={profile.email}
      badges={badges}
      hide={hide}
      title="Portfolio health"
      subtitle="The same scores the businesses and their funders see"
    >
      <div className="statstrip">
        <div className="s">
          <div className="l">Healthy</div>
          <div className="v" style={{ color: 'var(--green)' }}>{healthy.length}</div>
          <div className="f">Score 75 and above</div>
        </div>
        <div className="s">
          <div className="l">On watch</div>
          <div className="v" style={{ color: 'var(--yellow)' }}>{watch.length}</div>
          <div className="f">Worth keeping an eye on</div>
        </div>
        <div className="s">
          <div className="l">At risk</div>
          <div className="v" style={{ color: 'var(--red)' }}>{atRisk.length}</div>
          <div className="f">Needs attention now</div>
        </div>
        <div className="s">
          <div className="l">Average score</div>
          <div className="v">{average}</div>
          <div className="f">
            Across {scored.length} scored &middot; {unscored.length} not yet reporting
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>At risk</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>Lowest score first</span>
        </div>
        <HealthTable rows={atRisk} empty="No business is currently at risk." />
      </div>

      {falling.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <h3>Falling fastest</h3>
            <span className="hint" style={{ marginLeft: 'auto' }}>
              Whatever tier they are in
            </span>
          </div>
          <HealthTable rows={falling} empty="Nothing is falling." />
          <div className="panel-body">
            <p className="tiny muted" style={{ margin: 0 }}>
              A healthy business losing ground is easy to miss, because the
              colour still says it is fine. The direction is the early warning.
            </p>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>On watch</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>Lowest score first</span>
        </div>
        <HealthTable rows={watch} empty="Nothing is on watch." />
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>Performing well</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>Best score first</span>
        </div>
        <HealthTable
          rows={healthy}
          empty="No business has reached a healthy score yet."
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Not yet scored</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            {unscored.length} business{unscored.length === 1 ? '' : 'es'}
          </span>
        </div>
        <HealthTable
          rows={unscored}
          empty="Every enrolled business has reported at least one month."
        />
        <div className="panel-body">
          <p className="tiny muted" style={{ margin: 0 }}>
            These have no score because they have reported nothing, which is not
            the same as scoring badly. They are listed in{' '}
            <Link href="/admin/alerts">Needs attention</Link> with contact
            details, since the fix is a conversation rather than a number.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
