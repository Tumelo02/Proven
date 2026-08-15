import { notFound } from 'next/navigation';
import { healthAt, fmtDate, money, moneyShort, monthLabel, tierOf } from '@proven/engine';
import { getMyOrganisations, getScoredBusiness } from '@/lib/queries';
import { EntrepreneurShell } from '../shell';
import { Panel } from '@/components/workspace';
import { LineChart } from '@/components/LineChart';
import '../../../workspace.css';

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [scored, orgs] = await Promise.all([getScoredBusiness(id), getMyOrganisations()]);

  if (!scored) notFound();

  const { input, guidance, periods } = scored;
  const hist = input.history;

  const totIn = hist.reduce((s, p) => s + p.revenue, 0);
  const totOut = hist.reduce((s, p) => s + p.expenses, 0);
  const kept = totIn - totOut;
  const best = hist.reduce((a, b) => (b.revenue > a.revenue ? b : a), hist[0]!);

  const monthShort = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', {
      month: 'short',
      timeZone: 'UTC',
    });

  /* Newest first, but the score is the score as it stood at that month, so the
     table shows the record forming rather than today's number applied back. */
  const rows = hist
    .map((p, idx) => {
      const prev = idx > 0 ? hist[idx - 1] : null;
      const dv = prev && prev.revenue ? (p.revenue - prev.revenue) / prev.revenue : 0;
      return {
        p,
        idx,
        score: healthAt(input, idx).score,
        change: prev
          ? { dir: dv > 0.005 ? 'up' : dv < -0.005 ? 'down' : 'flat', pct: dv }
          : null,
      };
    })
    .reverse();

  /* Submitted months, newest first, as the entrepreneur's own record of what
     they have sent. */
  const updates = periods
    .filter((p) => p.submitted_at)
    .slice()
    .reverse();

  return (
    <EntrepreneurShell
      businessId={id}
      active="history"
      showSwitchRole={orgs.length > 0}
      guidanceCount={guidance.length}
      guidanceAlarm={guidance.some((g) => g.sev === 'red' || g.sev === 'yellow')}
    >
      <div style={{ marginBottom: 16 }}>
        <Panel
          title="Money in and money out"
          hint={`Last ${Math.min(hist.length, 8)} months`}
        >
          <div className="msum">
            <div className="ms">
              <div className="l">Money in, all months</div>
              <div className="v" style={{ color: 'var(--green)' }}>{money(totIn)}</div>
            </div>
            <div className="ms">
              <div className="l">Money out, all months</div>
              <div className="v">{money(totOut)}</div>
            </div>
            <div className="ms">
              <div className="l">{kept >= 0 ? 'Kept after costs' : 'Short after costs'}</div>
              <div className="v" style={{ color: kept >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {kept >= 0 ? '' : '−'}
                {money(Math.abs(kept))}
              </div>
            </div>
            <div className="ms">
              <div className="l">Best month</div>
              <div className="v">{monthShort(best.date)}</div>
              <div className="tiny muted">{money(best.revenue)} in</div>
            </div>
          </div>

          <LineChart history={hist} />
        </Panel>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-head">
            <h3>Month-by-month record</h3>
            <span className="hint" style={{ marginLeft: 'auto' }}>Newest first</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Money in</th>
                  <th>Money out</th>
                  <th>Left over</th>
                  <th>Customers</th>
                  <th>Score</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, score, change }) => {
                  const left = p.revenue - p.expenses;
                  const tier = tierOf(score);
                  return (
                    <tr key={p.date}>
                      <td>
                        <b>{monthLabel(p.date)}</b>
                        <div className="tiny muted">{fmtDate(p.date)}</div>
                      </td>
                      <td className="mono">
                        {moneyShort(p.revenue)}
                        <div className="tiny">
                          {change ? (
                            <span className={`mchange ${change.dir}`}>
                              {change.dir === 'up' ? '▲' : change.dir === 'down' ? '▼' : '■'}{' '}
                              {change.pct >= 0 ? '+' : ''}
                              {(change.pct * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="mchange flat">first month</span>
                          )}
                        </div>
                      </td>
                      <td className="mono">{moneyShort(p.expenses)}</td>
                      <td className="mono" style={{ color: left >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {left >= 0 ? '+' : '−'}
                        {moneyShort(Math.abs(left))}
                      </td>
                      <td className="mono">{p.customers}</td>
                      <td>
                        <span className={`chip ${tier}`}>{score}</span>
                      </td>
                      <td>
                        <span className={`stat-pill ${p.status}`}>
                          {p.status === 'on-time' ? 'On time' : p.status === 'late' ? 'Late' : 'Not sent'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Panel title="Your updates">
          <ul className="tl">
            {updates.length === 0 ? (
              <li>
                <div className="t-detail">You have not sent any updates yet.</div>
              </li>
            ) : (
              updates.map((p) => (
                <li key={p.id}>
                  <div className="t-title">{monthLabel(p.period_month)} figures sent</div>
                  <div className="t-detail">
                    {money(Number(p.revenue))} in, {money(Number(p.expenses))} out,{' '}
                    {p.customers} customers.
                  </div>
                  <div className="t-date">{fmtDate(p.submitted_at!.slice(0, 10))}</div>
                </li>
              ))
            )}
          </ul>
        </Panel>
      </div>
    </EntrepreneurShell>
  );
}
