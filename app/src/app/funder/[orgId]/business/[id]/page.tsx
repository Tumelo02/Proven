import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CR_BANDS,
  currentMilestone,
  evidenceCoverage,
  fmtDate,
  fundingUtilisation,
  milestoneProgress,
  money,
  moneyShort,
  monthLabel,
  pct,
  reportingStatus,
  tierLabel,
} from '@proven/engine';
import {
  getBusinessProfile,
  getFollowUps,
  getMyOrganisations,
  getPendingLinkRequests,
  getPortfolio,
  getScoredBusiness,
} from '@/lib/queries';
import { FollowUpControl } from '../../follow-up';
import { FunderShell } from '../../shell';
import { Chip, Kpi, Panel, RecCard, ScoreRing } from '@/components/workspace';
import { LineChart } from '@/components/LineChart';
import { BusinessProfileCard } from '@/components/BusinessProfileCard';
import '../../../../workspace.css';

/** The tabs, in the order a funder needs them. */
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'score', label: 'Why this score' },
  { key: 'performance', label: 'Performance' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'profile', label: 'Business profile' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default async function FunderBusinessProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { orgId, id } = await params;
  const { tab: rawTab } = await searchParams;

  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'overview';

  const orgs = await getMyOrganisations();
  const membership = orgs.find((o) => o.org.id === orgId);
  if (!membership) notFound();

  const [scored, portfolio, pending, profile, followUps] = await Promise.all([
    getScoredBusiness(id),
    getPortfolio(orgId),
    getPendingLinkRequests(orgId),
    getBusinessProfile(id),
    getFollowUps(id, orgId),
  ]);

  /* Null covers both "no such business" and "your organisation has no
     confirmed link to it". The security rules already made that call. */
  if (!scored) notFound();

  const { business, health, readiness, decision, guidance, input } = scored;
  const rep = reportingStatus(input);
  const util = fundingUtilisation(input.milestones);
  const progress = milestoneProgress(input.milestones);
  const bandIndex = CR_BANDS.indexOf(readiness.status);

  const documented = new Set(scored.documentedTransactionIds);
  const coverage = evidenceCoverage(
    scored.transactions.map((t) => ({
      amount: Number(t.amount),
      hasDocument: documented.has(t.id),
    })),
  );

  const attention = portfolio.filter((b) => b.health.tier !== 'green').length;

  const months = input.history.length;
  const lastPeriod = input.history[months - 1];

  /* Jobs from the headcount record when it exists, falling back to the single
     figure captured at enrolment. */
  const latestStaff = profile?.staffCounts[profile.staffCounts.length - 1];
  const jobs = latestStaff
    ? latestStaff.full_time + latestStaff.part_time + latestStaff.casual
    : (profile?.team.filter((m) => !m.left_on).length ?? business.staff_count);

  return (
    <FunderShell
      orgId={orgId}
      orgName={membership.org.name}
      active="portfolio"
      title={business.name}
      sub="Full performance record"
      attentionCount={attention}
      requestCount={pending.length}
    >
      <Link
        href={`/funder/${orgId}`}
        className="tiny"
        style={{ display: 'inline-block', marginBottom: 13, textDecoration: 'none' }}
      >
        ← Back to portfolio
      </Link>

      {/* Always visible: who this is, the score, and the call. Everything else
          sits behind a tab, so a funder reads the decision first and the
          supporting detail only when they go looking for it. */}
      <div className="panel score-hero">
        <ScoreRing score={health.score} tier={health.tier} />

        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="tiny muted">
            {[business.industry, business.region].filter(Boolean).join(' · ')}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{business.name}</div>
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Chip tier={health.tier}>{tierLabel(health.tier)}</Chip>
            <span className={`chip ${readiness.color}`}>{readiness.status}</span>
            <span className={`due-pill ${rep.state}`}>{rep.label}</span>
          </div>
        </div>

        <div className={`decision ${decision.kind}`} style={{ flex: '1 1 300px', margin: 0 }}>
          <div className="glyph">
            {decision.kind === 'release' ? '✔' : decision.kind === 'hold' ? '⏸' : '⚠'}
          </div>
          <div style={{ flex: 1 }}>
            <div className="lbl">What we suggest you do</div>
            <div className="act">{decision.action}</div>
            {/* The funder's own record of acting on this. Never shown to the
                entrepreneur, which is what makes it worth writing honestly. */}
            <FollowUpControl
              businessId={id}
              orgId={orgId}
              score={health.score}
              history={followUps}
            />
          </div>
        </div>
      </div>

      <div className="ptabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            className={`ptab${tab === t.key ? ' on' : ''}`}
            href={`/funder/${orgId}/business/${id}${t.key === 'overview' ? '' : `?tab=${t.key}`}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid2">
          <div className="stack">
            <Panel title="About this business">
              <div className="about-grid">
                <div className="ab">
                  <div className="l">Led by</div>
                  <div className="v">{business.owner_name || '—'}</div>
                </div>
                <div className="ab">
                  <div className="l">People employed</div>
                  <div className="v">{jobs}</div>
                </div>
                <div className="ab">
                  <div className="l">Trading since</div>
                  <div className="v">
                    {business.started_on ? monthLabel(business.started_on) : '—'}
                  </div>
                </div>
                <div className="ab">
                  <div className="l">On Proven</div>
                  <div className="v">{months} months</div>
                  {lastPeriod && (
                    <div className="s">last update {fmtDate(lastPeriod.date)}</div>
                  )}
                </div>
                <div className="ab">
                  <div className="l">Funding</div>
                  <div className="v">
                    {scored.fundingAmount ? money(scored.fundingAmount) : '—'}
                  </div>
                </div>
                <div className="ab">
                  <div className="l">Released so far</div>
                  <div className="v">{util}%</div>
                  <div className="s">against stages reached</div>
                </div>
              </div>
            </Panel>

            <Panel title="Why we suggest this">
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                {decision.why}
              </div>
            </Panel>
          </div>

          <div className="stack">
            <div className="cr-hero">
              <div
                className="tiny"
                style={{
                  color: '#9fb6d1',
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  fontWeight: 700,
                }}
              >
                Credit readiness
              </div>
              <div className="status">{readiness.status}</div>
              <div className="tiny" style={{ color: '#b9cbe0', marginTop: 2 }}>
                {readiness.plain}
              </div>
              <ul>
                {readiness.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <div className="tiny" style={{ marginTop: 12, color: '#9fb6d1' }}>
                This is evidence to support, not replace, a formal credit assessment.
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'score' && (
        <Panel title="Why this score" hint="Four measures, each shown with its weight">
          {(
            [
              ['Are sales growing?', health.factors.revenue, '35%',
                `Sales over the last 3 months compared with the 3 months before: ${pct(health.revGrowth)}.`],
              ['Is spending under control?', health.factors.expense, '25%',
                `For every R1 earned, about R${health.ratio.toFixed(2)} goes out in costs.`],
              ['Are updates sent on time?', health.factors.consistency, '20%',
                `${health.onTime} on time, ${health.late} late, ${health.missed} missed over the last 6 months.`],
              ['Are customers growing?', health.factors.customers, '20%',
                `Customers over the last 3 months compared with the 3 months before: ${pct(health.custGrowth)}.`],
            ] as const
          ).map(([label, value, weight, detail]) => (
            <div className="factor" key={label}>
              <div className="top">
                <span className="fname">{label}</span>
                <span className="wt">weight {weight}</span>
                <span className="contrib">{value.toFixed(1)}</span>
              </div>
              <div className="bar">
                <i
                  className={value >= 80 ? 'green' : value >= 50 ? 'yellow' : 'red'}
                  style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                />
              </div>
              <div className="expl">{detail}</div>
            </div>
          ))}
          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid var(--line-2)',
              fontSize: 12.5,
              color: 'var(--muted)',
            }}
          >
            {decision.why}
          </div>
        </Panel>
      )}

      {tab === 'performance' && (
        <>
          <div className="perf-split">
            <Panel title="Money in and money out" hint={`Last ${months} months`}>
              <LineChart history={input.history} />
            </Panel>

            <Panel title="Stages" hint={`${progress}% complete`}>
              {input.milestones.map((m, i) => (
                <div className={`milestone-row ${m.status}`} key={m.label}>
                  <div className="mnum">{m.status === 'done' ? '✔' : i + 1}</div>
                  <div className="mlabel">
                    {m.label}
                    <div className="tiny muted" style={{ fontWeight: 500 }}>
                      {m.status === 'done'
                        ? 'Completed'
                        : m.status === 'delayed'
                          ? 'Running late'
                          : m.status === 'current'
                            ? 'Working on it now'
                            : 'Not started yet'}
                    </div>
                  </div>
                </div>
              ))}
            </Panel>
          </div>

          <div className="kpis" style={{ marginTop: 16, marginBottom: 0 }}>
            <Kpi
              label="Funding"
              value={scored.fundingAmount ? moneyShort(scored.fundingAmount) : '—'}
              foot={`${util}% released against stages reached`}
            />
            <Kpi
              label="Reporting"
              value={`${health.onTime}/${health.periods}`}
              foot={`${health.late} late · ${health.missed} missed`}
            />
            <Kpi
              label="Months on record"
              value={months}
              foot="Longer records score higher"
            />
            <Kpi
              label="Last reported"
              value={lastPeriod ? moneyShort(lastPeriod.revenue) : '—'}
              foot={lastPeriod ? `money out ${moneyShort(lastPeriod.expenses)}` : ''}
            />
          </div>
        </>
      )}

      {tab === 'evidence' && (
        <>
          <Panel title="Proof behind the numbers" hint="Same view as the entrepreneur">
            <div className="cov-head">
              <div>
                <div className="cov-title">
                  {coverage.pct >= 70
                    ? 'Well documented'
                    : coverage.pct >= 40
                      ? 'Partly documented'
                      : 'Thinly documented'}
                </div>
                <div className="tiny muted">
                  {coverage.withProof} of {coverage.count} entries carry a document
                </div>
              </div>
              <div
                className="cov-pct"
                style={{
                  color:
                    coverage.pct >= 70
                      ? 'var(--green)'
                      : coverage.pct >= 40
                        ? 'var(--yellow)'
                        : 'var(--red)',
                }}
              >
                {coverage.pct}%
              </div>
            </div>
            <div className="cov-bar">
              <span
                style={{
                  width: `${coverage.pct}%`,
                  background:
                    coverage.pct >= 70
                      ? 'var(--green)'
                      : coverage.pct >= 40
                        ? 'var(--yellow)'
                        : 'var(--red)',
                }}
              />
            </div>
            <div className="cov-note">
              The share of logged value with a supporting document attached.
            </div>
          </Panel>

          <Panel
            title="What the owner was told to do"
            hint="The same advice they see"
            className="mt-16"
          >
            {guidance.length === 0 ? (
              <p className="tiny muted" style={{ margin: 0 }}>
                Nothing flagged right now.
              </p>
            ) : (
              guidance.map((g, i) => <RecCard key={i} g={g} />)
            )}
          </Panel>
        </>
      )}

      {tab === 'profile' && (
        <>
          {profile ? (
            <BusinessProfileCard
              business={profile.business}
              team={profile.team}
              staffCounts={profile.staffCounts}
              logoUrl={profile.logoUrl}
            />
          ) : (
            <Panel title="Business profile">
              <p className="tiny muted" style={{ margin: 0 }}>
                This business has not filled in its profile yet.
              </p>
            </Panel>
          )}
        </>
      )}

    </FunderShell>
  );
}
