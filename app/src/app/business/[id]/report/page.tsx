import Link from 'next/link';
import { notFound } from 'next/navigation';
import { money, monthLabel, pct } from '@proven/engine';
import { getMyOrganisations, getScoredBusiness } from '@/lib/queries';
import { EntrepreneurShell } from '../shell';
import { getBusinessReport, defaultRange, rangeLabel } from './report-data';
import { ReportRange } from './range';
import { StatementTable } from './statement';
import '../../../workspace.css';

/**
 * The business's own financial report.
 *
 * What a bank, a funder or an accountant asks for. Deliberately dense: the
 * figures come first as a strip, then the whole account as one statement that
 * scrolls sideways rather than down. An earlier version repeated the
 * month-by-month table and a bar chart underneath it, which made the page long
 * without telling the reader anything the other screens had not already said.
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

  const { totals, latestBalance } = report;
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
        <div className="panel">
          <div className="panel-body">
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              There are no figures for {rangeLabel(from, to)}. Choose a
              different range, or{' '}
              <Link href={`/business/${id}/transactions`}>add those months</Link>.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Everything a reader needs at a glance, in one strip rather than
              four cards and a chart they have to scroll past. */}
          <div className="rpt-figures">
            <div className="rpt-fig">
              <div className="l">Money in</div>
              <div className="v" style={{ color: 'var(--green)' }}>
                {money(totals.revenue)}
              </div>
              <div className="f">{money(totals.averageRevenue)} a month</div>
            </div>
            <div className="rpt-fig">
              <div className="l">Money out</div>
              <div className="v">{money(totals.expenses)}</div>
              <div className="f">{money(totals.averageExpenses)} a month</div>
            </div>
            <div className="rpt-fig">
              <div className="l">{kept ? 'Kept' : 'Short'}</div>
              <div className="v" style={{ color: kept ? 'var(--green)' : 'var(--red)' }}>
                {money(Math.abs(totals.profit))}
              </div>
              <div className="f">
                {totals.revenue > 0 ? `${pct(totals.margin)} margin` : 'no income'}
              </div>
            </div>

            {/* The cash position, which profit alone never shows. */}
            <div className="rpt-fig rpt-fig-bank">
              <div className="l">In the bank</div>
              {/* The available balance, which is what the business could
                  actually spend. Falls back to what the account held when no
                  available figure was given, rather than showing nothing. */}
              <div className="v">
                {latestBalance
                  ? money(latestBalance.available ?? latestBalance.closing)
                  : '—'}
              </div>
              <div className="f">
                {latestBalance
                  ? `available at ${monthLabel(latestBalance.month)}`
                  : 'no balance reported'}
              </div>
            </div>

            <div className="rpt-fig">
              <div className="l">Months</div>
              <div className="v">{totals.months}</div>
              <div className="f">
                {totals.profitableMonths} up · {totals.lossMonths} down
              </div>
            </div>
            <div className="rpt-fig">
              <div className="l">Score</div>
              <div className="v">{report.score ?? '—'}</div>
              <div className="f">{report.readiness ?? 'not yet scored'}</div>
            </div>
          </div>

          <StatementTable
            rows={report.lines.map((l) => ({
              month: l.month,
              label: l.label,
              revenue: l.revenue,
              expenses: l.expenses,
              profit: l.profit,
              margin: l.margin,
              customers: l.customers,
              closingBalance: l.closingBalance,
              availableBalance: l.availableBalance,
            }))}
            spending={report.spending.map((s) => ({
              category: s.category,
              byMonth: s.byMonth,
              total: s.total,
            }))}
          />

          <p className="tiny muted rpt-foot">
            Best month {totals.bestMonth ? totals.bestMonth.label : '—'}
            {totals.bestMonth && ` (${money(totals.bestMonth.profit)})`} · hardest{' '}
            {totals.worstMonth ? totals.worstMonth.label : '—'}
            {totals.worstMonth && ` (${money(totals.worstMonth.profit)})`} ·{' '}
            {totals.customers} customers · {report.evidencePct}% backed by evidence.
            Every figure comes from the months you reported; nothing is
            estimated, and a funder linked to you sees the same numbers.
          </p>
        </>
      )}
    </EntrepreneurShell>
  );
}
