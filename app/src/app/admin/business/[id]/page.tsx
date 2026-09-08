import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CR_BANDS,
  currentMilestone,
  healthAt,
  milestoneProgress,
  money,
  monthLabel,
  pct,
  reportingStatus,
  tierLabel,
} from '@proven/engine';
import {
  getBusinessProfile,
  getBusinessShell,
  getCurrentProfile,
  getScoredBusiness,
} from '@/lib/queries';
import { Chip, Kpi, ScoreRing } from '@/components/workspace';
import { LogoPreview } from '@/components/logo-preview';
import '../../../workspace.css';

function fmtMoney(value: number) {
  return value >= 0 ? money(value) : `-${money(Math.abs(value))}`;
}

export default async function AdminBusinessSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  if (!profile?.is_platform_admin) notFound();

  const [shell, scored, businessProfile] = await Promise.all([
    getBusinessShell(id),
    getScoredBusiness(id),
    getBusinessProfile(id),
  ]);

  /* Only a business that genuinely does not exist, or that this admin may not
     read, is a 404. */
  if (!businessProfile || !shell) notFound();

  /* A business that has never reported a month cannot be scored, so
     `getScoredBusiness` returns null for it. That is an ordinary state — it is
     the "None" in the tracking list — not a missing page, and 404ing on it hid
     every business an admin most needs to look at: the ones that enrolled and
     then went quiet.

     So the summary is still rendered, with the same panels in the same places,
     and the figures simply left empty. An admin should see who this business
     is and how to reach them; what they must not see is a fabricated score or
     a zero that reads as a real, badly performing measurement. */
  const business = businessProfile.business;
  const input = scored?.input ?? { history: [], milestones: [], ledger: [] };
  const rep = reportingStatus(input);
  const progress = scored ? milestoneProgress(input.milestones) : 0;
  const currentStage = scored ? currentMilestone(input.milestones) : '';
  const bandIndex = scored ? CR_BANDS.indexOf(scored.readiness.status) : -1;
  const last = input.history[input.history.length - 1];

  return (
    <div className="app">
      <main className="main">
        <div className="topbar">
          <div>
            <h2>Business summary</h2>
            <div className="sub">Admin performance view</div>
          </div>
          <div className="row">
            <Link className="btn ghost sm" href="/admin">
              Back to admin
            </Link>
          </div>
        </div>

        <div className="content">
          <Link href="/admin" className="tiny" style={{ display: 'inline-block', marginBottom: 13, textDecoration: 'none' }}>
            ← Back to tracking list
          </Link>

          <div className="panel score-hero" style={{ marginBottom: 16 }}>
            <LogoPreview
              logoUrl={businessProfile.logoUrl}
              alt={`${business.name} logo`}
              fallback={business.name.slice(0, 2).toUpperCase() || 'B'}
            />

            {/* No ring at all rather than a ring reading zero: a score of 0 is
                a real, very bad measurement, and this business has not been
                measured. */}
            {scored ? (
              <ScoreRing score={scored.health.score} tier={scored.health.tier} />
            ) : (
              <div className="score-ring-empty" aria-label="No score yet">
                <span className="sre-dash">—</span>
                <span className="sre-note">No score</span>
              </div>
            )}

            <div className="hero-detail">
              <div className="tiny muted">
                {[business.industry, business.region].filter(Boolean).join(' · ')}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{business.name}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {scored ? (
                  <>
                    <Chip tier={scored.health.tier}>{tierLabel(scored.health.tier)}</Chip>
                    <span className={`chip ${scored.readiness.color}`}>
                      {scored.readiness.status}
                    </span>
                  </>
                ) : (
                  <span className="chip muted-chip">Not yet reported</span>
                )}
                <span className={`due-pill ${rep.state}`}>{rep.label}</span>
              </div>
            </div>

            {scored ? (
              <div
                className={`decision decision-hero ${scored.decision.kind}`}
                style={{ margin: 0 }}
              >
                <div className="glyph">
                  {scored.decision.kind === 'release'
                    ? '✔'
                    : scored.decision.kind === 'hold'
                      ? '⏸'
                      : '⚠'}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="lbl">Current action</div>
                  <div className="act">{scored.decision.action}</div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {scored.decision.why}
                  </div>
                </div>
              </div>
            ) : (
              /* Deliberately not a decision. Nothing has been reported, so
                 there is nothing to release, hold or flag on — saying so is the
                 honest answer, and it points at the one thing that would
                 change it. */
              <div className="decision decision-hero" style={{ margin: 0 }}>
                <div className="glyph">•</div>
                <div style={{ flex: 1 }}>
                  <div className="lbl">Current action</div>
                  <div className="act">Nothing to assess yet</div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    This business has not reported a month, so there are no
                    figures to judge.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Same four tiles in the same order whether or not there are
              figures, so an admin reads the page the same way every time. An
              em dash marks a measurement that does not exist yet; it is not the
              same statement as a zero. */}
          <div className="kpis">
            <Kpi
              label="Health score"
              value={scored ? `${scored.health.score}/100` : '—'}
              foot={scored ? tierLabel(scored.health.tier) : 'No months reported'}
            />
            <Kpi
              label="Current stage"
              value={currentStage || 'Not started'}
              foot={scored ? `${progress}% complete` : 'Starts with the first report'}
            />
            <Kpi label="Reporting status" value={rep.title} foot={rep.detail} />
            <Kpi
              label="Latest month"
              value={last ? monthLabel(last.date) : '—'}
              foot={last ? `${fmtMoney(last.revenue - last.expenses)} cash left` : 'Awaiting first report'}
            />
          </div>

          <div className="grid2" style={{ marginTop: 16 }}>
            <div className="panel">
              <div className="panel-head">
                <h3>Business profile</h3>
              </div>
              <div className="panel-body">
                <div className="about-grid">
                  <div className="ab">
                    <div className="l">Owner</div>
                    <div className="v">{business.owner_name || '—'}</div>
                  </div>
                  <div className="ab">
                    <div className="l">Industry</div>
                    <div className="v">{business.industry || '—'}</div>
                  </div>
                  <div className="ab">
                    <div className="l">Region</div>
                    <div className="v">{business.region || '—'}</div>
                  </div>
                  <div className="ab">
                    <div className="l">Started</div>
                    <div className="v">{business.started_on ? monthLabel(business.started_on) : '—'}</div>
                  </div>
                  <div className="ab">
                    <div className="l">Owner email</div>
                    <div className="v">{business.owner_email || '—'}</div>
                  </div>
                  <div className="ab">
                    <div className="l">Owner phone</div>
                    <div className="v">{business.owner_phone || '—'}</div>
                  </div>
                  <div className="ab" style={{ gridColumn: '1 / -1' }}>
                    <div className="l">Description</div>
                    <div className="v">{business.description || 'No description added.'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>Stage progress</h3>
              </div>
              <div className="panel-body">
                <div className="tiny muted">Current milestone</div>
                <div style={{ fontWeight: 800, fontSize: 17, marginTop: 4 }}>{currentStage || 'Not started yet'}</div>

                <div className="progress-track" style={{ marginTop: 12 }}>
                  <i style={{ width: `${progress}%` }} />
                </div>
                <div className="tiny muted" style={{ marginTop: 8 }}>
                  {progress}% of the business journey complete
                </div>

                <div style={{ marginTop: 16 }}>
                  <div className="tiny muted">Credit readiness</div>
                  <div className="status" style={{ marginTop: 4 }}>
                    {scored ? scored.readiness.status : '—'}
                  </div>
                  <div className="tiny" style={{ color: 'var(--muted)', marginTop: 6 }}>
                    {scored
                      ? scored.readiness.plain
                      : 'Readiness is earned by reporting. Nothing has been reported yet.'}
                  </div>
                  {/* Every dot unlit and no "n of 4" count: an unmeasured
                      business is not standing at the bottom band, it is not on
                      the scale at all. */}
                  <div className="crs-dots" style={{ marginTop: 12 }}>
                    {CR_BANDS.map((b, i) => (
                      <span key={b} className={`crs-dot${i <= bandIndex ? ' on' : ''}`} title={b} />
                    ))}
                    {scored && <span className="crs-of">{bandIndex + 1} of 4</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head">
              <h3>Health overview</h3>
            </div>
            <div className="panel-body">
              <div className="grid2">
                <div>
                  <div className="tiny muted">Score</div>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>
                    {scored ? scored.health.score : '—'}
                  </div>
                </div>
                <div>
                  <div className="tiny muted">Trend</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {scored ? (
                      <>
                        {scored.trend === 'up' ? '▲' : scored.trend === 'down' ? '▼' : '•'}{' '}
                        {scored.delta > 0 ? '+' : ''}
                        {scored.delta.toFixed(1)} vs last month
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
              </div>

              {/* Growth and averages are all divisions over reported months.
                  With no months they would print as 0% and R0, which reads as a
                  business that earned nothing rather than one that has told us
                  nothing. */}
              <div className="about-grid" style={{ marginTop: 12 }}>
                <div className="ab">
                  <div className="l">Revenue growth</div>
                  <div className="v">{scored ? pct(scored.health.revGrowth) : '—'}</div>
                </div>
                <div className="ab">
                  <div className="l">Expense growth</div>
                  <div className="v">{scored ? pct(scored.health.expGrowth) : '—'}</div>
                </div>
                <div className="ab">
                  <div className="l">Average revenue</div>
                  <div className="v">{scored ? money(scored.health.avgRevenue) : '—'}</div>
                </div>
                <div className="ab">
                  <div className="l">Average expenses</div>
                  <div className="v">{scored ? money(scored.health.avgExpenses) : '—'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head">
              <h3>Month by month</h3>
            </div>
            <div className="panel-body">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="num">Money in</th>
                      <th className="num">Money out</th>
                      <th className="num">Cash left</th>
                      <th className="num">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {input.history.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '18px 8px' }}>
                          No months reported yet.
                        </td>
                      </tr>
                    ) : (
                      input.history.map((period, index) => (
                        <tr key={period.date}>
                          <td>{monthLabel(period.date)}</td>
                          <td className="num mono">{money(period.revenue)}</td>
                          <td className="num mono">{money(period.expenses)}</td>
                          <td className="num mono">{money(period.revenue - period.expenses)}</td>
                          {/* The score as it stood that month, so the column
                              shows the record forming rather than today's
                              number applied backwards. It previously printed a
                              hard-coded 0 in every row, from a leftover
                              expression that could only ever evaluate to 0. */}
                          <td className="num mono">{healthAt(input, index).score}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {scored && scored.guidance.length > 0 && (
            <div className="panel" style={{ marginTop: 16 }}>
              <div className="panel-head">
                <h3>Recommendations</h3>
              </div>
              <div className="panel-body">
                {scored.guidance.map((g, i) => (
                  <div key={i} className={`rec-card ${g.sev}`} style={{ marginBottom: 10 }}>
                    <div className="issue">{g.issue}</div>
                    <div className="rec">
                      <b>Try this:</b> {g.rec}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
