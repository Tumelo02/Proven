import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  currentMilestone,
  evidenceCoverage,
  fundingUtilisation,
  healthAt,
  moneyShort,
  reportingStatus,
  tierLabel,
  trendOf,
  fmtDate,
} from '@proven/engine';
import {
  getLogoUrls,
  getMyOrganisations,
  getPendingLinkRequests,
  getPortfolio,
} from '@/lib/queries';
import { FunderShell } from './shell';
import { Kpi, Panel, TrendGlyph } from '@/components/workspace';
import { HealthMix } from '@/components/HealthMix';
import { SUPPORT_KIND_LABEL } from '@/lib/database.types';
import { PortfolioToolbar } from './toolbar';
import '../../workspace.css';

/** Two letters, so a table row is scannable without reading every name. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default async function FunderPortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ tier?: string; q?: string; sort?: string }>;
}) {
  const { orgId } = await params;
  const { tier = 'all', q = '', sort = 'score' } = await searchParams;

  const orgs = await getMyOrganisations();
  const membership = orgs.find((o) => o.org.id === orgId);
  /* Not a member: indistinguishable from the organisation not existing, so a
     stranger cannot probe which organisation IDs are real. */
  if (!membership) notFound();

  const [portfolio, pending] = await Promise.all([
    getPortfolio(orgId),
    getPendingLinkRequests(orgId),
  ]);

  /* Logos for the whole list in one call, so a business a funder recognises by
     its mark is recognisable here too. */
  const logos = await getLogoUrls(portfolio.map((b) => b.business.logo_path));

  const total = portfolio.length;
  const counts = {
    green: portfolio.filter((b) => b.health.tier === 'green').length,
    yellow: portfolio.filter((b) => b.health.tier === 'yellow').length,
    red: portfolio.filter((b) => b.health.tier === 'red').length,
  };
  const needAttention = counts.red + counts.yellow;

  const overdue = portfolio.filter(
    (b) => reportingStatus(b.input).state === 'overdue',
  ).length;

  const avgScore = total
    ? Math.round(portfolio.reduce((s, b) => s + b.health.score, 0) / total)
    : 0;

  /* Direction answers "is this working?", which a single average cannot. */
  const prevAvg = total
    ? Math.round(
        portfolio.reduce((s, b) => {
          const h = b.input.history;
          return s + (h.length > 1 ? healthAt(b.input, h.length - 2).score : b.health.score);
        }, 0) / total,
      )
    : 0;
  const trendDelta = avgScore - prevAvg;
  const trendDir = trendDelta > 0 ? 'up' : trendDelta < 0 ? 'down' : 'flat';

  /* Across the whole portfolio, by value: the same figure each entrepreneur
     sees on their own Transactions tab, aggregated. */
  const coverage = evidenceCoverage(
    portfolio.flatMap((b) => {
      const documented = new Set(b.documentedTransactionIds);
      return b.transactions.map((t) => ({
        amount: Number(t.amount),
        hasDocument: documented.has(t.id),
      }));
    }),
  );

  const avgUtil = total
    ? Math.round(
        portfolio.reduce((s, b) => s + fundingUtilisation(b.input.milestones), 0) / total,
      )
    : 0;

  /* Filter, search and sort, all from the URL so a funder can share the view
     they are looking at. */
  const needle = q.trim().toLowerCase();
  const rows = portfolio
    .filter((b) => (tier === 'all' ? true : b.health.tier === tier))
    .filter((b) =>
      needle
        ? `${b.business.name} ${b.business.industry} ${b.business.region}`
            .toLowerCase()
            .includes(needle)
        : true,
    )
    .sort((a, b) => {
      if (sort === 'name') return a.business.name.localeCompare(b.business.name);
      if (sort === 'industry') return a.business.industry.localeCompare(b.business.industry);
      /* Lowest score first by default, so a business that needs support is
         read before one that is doing well. */
      return a.health.score - b.health.score;
    });

  return (
    <FunderShell
      orgId={orgId}
      orgName={membership.org.name}
      active="portfolio"
      title="Portfolio Overview"
      sub="Sorted by health score. The same score the entrepreneur sees."
      attentionCount={needAttention}
      requestCount={pending.length}
    >
      <div className="kpis">
        <Kpi
          label="Needs attention"
          value={needAttention}
          foot={`${counts.red} at risk · ${counts.yellow} on watch${overdue ? ` · ${overdue} behind on updates` : ''}`}
          {...(needAttention ? { tone: 'var(--red)' } : {})}
        />
        <Kpi
          label="Portfolio health"
          value={
            <>
              {avgScore}/100{' '}
              <span style={{ fontSize: 13 }}>
                <TrendGlyph trend={trendDir} delta={trendDelta} />
              </span>
            </>
          }
          foot={`average score · ${trendDelta === 0 ? 'unchanged' : `${trendDelta > 0 ? 'up' : 'down'} since last month`}`}
        />
        <Kpi
          label="Evidence coverage"
          value={`${coverage.pct}%`}
          foot="of logged value backed by a document"
        />
        <Kpi
          label="Funding at work"
          value={`${avgUtil}%`}
          foot="released against stages reached"
        />
      </div>

      <PortfolioToolbar
        orgId={orgId}
        tier={tier}
        q={q}
        sort={sort}
        counts={{ ...counts, all: total }}
      />

      <div className="panel">
        {rows.length === 0 ? (
          <div className="panel-body">
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              {total === 0
                ? `No businesses yet. When one asks to be linked to ${membership.org.name} and you confirm it, it appears here.`
                : 'No businesses match this filter.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Funding</th>
                  <th>Stage</th>
                  <th>Score</th>
                  <th>How it&rsquo;s doing</th>
                  <th>Trend</th>
                  <th>Reporting</th>
                  <th>Credit readiness</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const rep = reportingStatus(b.input);
                  const trend = trendOf(b.input);
                  const funding = b.funder ? b.fundingAmount : null;
                  return (
                    <tr key={b.business.id}>
                      <td>
                        <div className="biz-cell">
                          {/* The business's own logo when it has one, initials
                              when it does not. */}
                          <div className="avatar">
                            {b.business.logo_path && logos[b.business.logo_path] ? (
                              /* eslint-disable-next-line @next/next/no-img-element -- a
                                 signed storage URL, already short-lived; next/image
                                 would cache a link that expires. */
                              <img
                                src={logos[b.business.logo_path]}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            ) : (
                              initials(b.business.name)
                            )}
                          </div>
                          <div>
                            <Link
                              className="nm"
                              href={`/funder/${orgId}/business/${b.business.id}`}
                              style={{ textDecoration: 'none', color: 'var(--ink)' }}
                            >
                              {b.business.name}
                            </Link>
                            <div className="sc">
                              {[b.business.industry, b.business.region]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* A programme place carries no rand figure, so the kind
                          of support stands in rather than a misleading dash. */}
                      <td className="mono">
                        {funding ? (
                          moneyShort(funding)
                        ) : b.fundingLink ? (
                          <span className="tiny muted">
                            {SUPPORT_KIND_LABEL[b.fundingLink.support_kind]}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="tiny">{currentMilestone(b.input.milestones)}</td>
                      <td>
                        <div className="scorebox">
                          <span className="scorenum">{b.health.score}</span>
                          <span className="minibar">
                            <i className={b.health.tier} style={{ width: `${b.health.score}%` }} />
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`chip ${b.health.tier}`}>
                          <span className="dot" />
                          {tierLabel(b.health.tier)}
                        </span>
                      </td>
                      <td>
                        <TrendGlyph trend={trend} delta={b.delta} />
                      </td>
                      <td>
                        <span className={`due-pill ${rep.state}`}>{rep.label}</span>
                        <div className="tiny muted">due {fmtDate(rep.due)}</div>
                      </td>
                      <td>
                        <span className={`chip ${b.readiness.color}`}>
                          <span className="dot" />
                          {b.readiness.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* The mix and the positioning note sit below the list, where they give
          context without delaying the thing a funder came to see. */}
      <div className="grid2 mt-16">
        <div className="panel">
          <div className="panel-head">
            <h3>How your businesses are doing</h3>
            <span className="hint" style={{ marginLeft: 'auto' }}>
              {needAttention
                ? `${needAttention} of ${total} need a closer look`
                : `All ${total} in the healthy band`}
            </span>
          </div>
          <HealthMix orgId={orgId} counts={counts} activeTier={tier} />
        </div>

        <Panel title="What this means">
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
            Businesses on Watch or At Risk are flagged so support can reach them
            early. The same score, the same explanation and the same
            recommendation are visible to the entrepreneur: this is a shared
            evidence platform, not a surveillance tool.
          </div>
        </Panel>
      </div>

    </FunderShell>
  );
}
