import Link from 'next/link';
import { notFound } from 'next/navigation';
import { money, pct } from '@proven/engine';
import { getMyOrganisations, getScoredBusiness } from '@/lib/queries';
import { EntrepreneurShell } from '../shell';
import { Kpi, Panel } from '@/components/workspace';
import { LineChart } from '@/components/LineChart';
import { getBusinessReport, defaultRange, rangeLabel } from './report-data';
import { ReportRange } from './range';
import '../../../workspace.css';

/**
 * The business's own financial report.
 *
 * What a bank, a funder or an accountant asks for: income and costs month by
 * month over a period, what was kept, where it went, and how steady it has
 * been. Built from the months the business reported, so it can never disagree
 * with the dashboard, and every figure traces back to something the owner
 * entered.
 *
 * Defaults to this calendar year, because that is what "this year's figures"
 * means to the person asking for them.
 */
export default async function BusinessReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from: rawFrom, to: rawTo } = await searchParams;

  const fallback = defaultRange();
  const month = /^\d{4}-\d{2}$/;
  const from = rawFrom && month.test(rawFrom) ? rawFrom : fallback.from;
  const to = rawTo && month.test(rawTo) ? rawTo : fallback.to;

  const [report, orgs, scored] = await Promise.all([
    getBusinessReport(id, from, to),
    getMyOrganisations(),
    getScoredBusiness(id),
  ]);

  if (!report) notFound();

  const { totals } = report;
  const kept = totals.profit >= 0;

  return (
    <EntrepreneurShell
      businessId={id}
      active="report"
      showSwitchRole={orgs.length > 0}
      {...(scored
        ? {
            guidanceCount: scored.guidance.length,
            guidanceAlarm: scored.guidance.some((g) => g.sev === 'red' || g.sev === 'yellow'),
          }
        : {})}
    >
      <ReportRange businessId={id} from={from} to={to} />

      {report.lines.length === 0 ? (
        <Panel title="Nothing reported in this period">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            There are no figures for {rangeLabel(from, to)}. Choose a different
            range, or{' '}
            <Link href={`/business/${id}/transactions`}>add those months</Link>.
          </p>
        </Panel>
      ) : (
        <>
          <div className="kpis">
            <Kpi
              label="Money in"
              value={money(totals.revenue)}
              foot={`${money(totals.averageRevenue)} a month on average`}
              tone="var(--green)"
            />
            <Kpi
              label="Money out"
              value={money(totals.expenses)}
              foot={`${money(totals.averageExpenses)} a month on average`}
            />
            <Kpi
              label={kept ? 'Kept after costs' : 'Short after costs'}
              value={money(Math.abs(totals.profit))}
              foot={
                totals.revenue > 0
                  ? `${pct(totals.margin)} of everything earned`
                  : 'No income in this period'
              }
              tone={kept ? 'var(--green)' : 'var(--red)'}
            />
            <Kpi
              label="Months reported"
              value={`${totals.months}`}
              foot={`${totals.profitableMonths} profitable · ${totals.lossMonths} at a loss`}
            />
          </div>

          <Panel
            title="Money in and money out"
            hint={rangeLabel(from, to)}
          >
            <LineChart
              history={report.lines.map((l) => ({
                date: l.month,
                revenue: l.revenue,
                expenses: l.expenses,
                customers: l.customers,
                status: 'on-time' as const,
              }))}
            />
          </Panel>

          <div className="grid2" style={{ marginTop: 16 }}>
            <div className="panel">
              <div className="panel-head">
                <h3>Month by month</h3>
                <span className="hint" style={{ marginLeft: 'auto' }}>
                  Newest first
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="num">In</th>
                      <th className="num">Out</th>
                      <th className="num">Left</th>
                      <th className="num">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...report.lines].reverse().map((l) => (
                      <tr key={l.month}>
                        <td>{l.label}</td>
                        <td className="num mono">{money(l.revenue)}</td>
                        <td className="num mono">{money(l.expenses)}</td>
                        <td
                          className="num mono"
                          style={{ color: l.profit >= 0 ? 'var(--green)' : 'var(--red)' }}
                        >
                          {l.profit >= 0 ? '' : '−'}
                          {money(Math.abs(l.profit))}
                        </td>
                        <td className="num mono">
                          {l.revenue > 0 ? pct(l.margin) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>
                        <b>Total</b>
                      </td>
                      <td className="num mono">
                        <b>{money(totals.revenue)}</b>
                      </td>
                      <td className="num mono">
                        <b>{money(totals.expenses)}</b>
                      </td>
                      <td
                        className="num mono"
                        style={{ color: kept ? 'var(--green)' : 'var(--red)' }}
                      >
                        <b>
                          {kept ? '' : '−'}
                          {money(Math.abs(totals.profit))}
                        </b>
                      </td>
                      <td className="num mono">
                        <b>{totals.revenue > 0 ? pct(totals.margin) : '—'}</b>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>Where the money went</h3>
                <span className="hint" style={{ marginLeft: 'auto' }}>
                  Largest first
                </span>
              </div>
              {report.spending.length === 0 ? (
                <div className="panel-body">
                  <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
                    No individual costs were logged in this period, so there is
                    nothing to break down. The monthly totals above still count.
                  </p>
                </div>
              ) : (
                <div className="panel-body">
                  <div className="adm-bars">
                    {report.spending.map((s) => (
                      <div className="adm-bar-row" key={s.category}>
                        <div className="adm-bar-label" title={s.category}>
                          {s.category}
                        </div>
                        <div className="adm-bar-track">
                          <div
                            className="adm-bar"
                            style={{ width: `${Math.max(2, s.share * 100)}%` }}
                          >
                            <span className="seg red" style={{ flex: 1 }} />
                          </div>
                        </div>
                        <div className="adm-bar-value">
                          {money(s.total)}
                          <span className="tiny muted"> · {pct(s.share)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Panel title="How this period reads">
            <div className="about-grid">
              <div className="ab">
                <div className="l">Best month</div>
                <div className="v">
                  {totals.bestMonth
                    ? `${totals.bestMonth.label} · ${money(totals.bestMonth.profit)}`
                    : '—'}
                </div>
              </div>
              <div className="ab">
                <div className="l">Hardest month</div>
                <div className="v">
                  {totals.worstMonth
                    ? `${totals.worstMonth.label} · ${money(totals.worstMonth.profit)}`
                    : '—'}
                </div>
              </div>
              <div className="ab">
                <div className="l">Health score</div>
                <div className="v">{report.score ?? '—'}</div>
              </div>
              <div className="ab">
                <div className="l">Credit readiness</div>
                <div className="v">{report.readiness ?? '—'}</div>
              </div>
              <div className="ab">
                <div className="l">Customers served</div>
                <div className="v">{totals.customers || '—'}</div>
              </div>
              <div className="ab">
                <div className="l">Backed by evidence</div>
                <div className="v">{report.evidencePct}%</div>
              </div>
            </div>
            <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Every figure here comes from the months you reported. Nothing is
              estimated, and the same numbers are what a funder linked to you
              sees.
            </p>
          </Panel>
        </>
      )}
    </EntrepreneurShell>
  );
}
