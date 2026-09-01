import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CR_BANDS,
  currentMilestone,
  milestoneProgress,
  money,
  monthLabel,
  pct,
  reportingStatus,
  tierLabel,
} from '@proven/engine';
import { getBusinessProfile, getCurrentProfile, getScoredBusiness } from '@/lib/queries';
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

  const [scored, businessProfile] = await Promise.all([
    getScoredBusiness(id),
    getBusinessProfile(id),
  ]);

  if (!scored || !businessProfile) notFound();

  const { business, health, readiness, input, decision, guidance, delta, trend } = scored;
  const rep = reportingStatus(input);
  const progress = milestoneProgress(input.milestones);
  const currentStage = currentMilestone(input.milestones);
  const bandIndex = CR_BANDS.indexOf(readiness.status);
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

            <ScoreRing score={health.score} tier={health.tier} />

            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="tiny muted">
                {[business.industry, business.region].filter(Boolean).join(' · ')}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{business.name}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip tier={health.tier}>{tierLabel(health.tier)}</Chip>
                <span className={`chip ${readiness.color}`}>{readiness.status}</span>
                <span className={`due-pill ${rep.state}`}>{rep.label}</span>
              </div>
            </div>

            <div className={`decision ${decision.kind}`} style={{ flex: '1 1 280px', margin: 0 }}>
              <div className="glyph">
                {decision.kind === 'release' ? '✔' : decision.kind === 'hold' ? '⏸' : '⚠'}
              </div>
              <div style={{ flex: 1 }}>
                <div className="lbl">Current action</div>
                <div className="act">{decision.action}</div>
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  {decision.why}
                </div>
              </div>
            </div>
          </div>

          <div className="kpis">
            <Kpi label="Health score" value={`${health.score}/100`} foot={tierLabel(health.tier)} />
            <Kpi label="Current stage" value={currentStage || 'Not started'} foot={`${progress}% complete`} />
            <Kpi label="Reporting status" value={rep.title} foot={rep.detail} />
            <Kpi
              label="Latest month"
              value={last ? monthLabel(last.date) : 'No data'}
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
                  <div className="status" style={{ marginTop: 4 }}>{readiness.status}</div>
                  <div className="tiny" style={{ color: 'var(--muted)', marginTop: 6 }}>
                    {readiness.plain}
                  </div>
                  <div className="crs-dots" style={{ marginTop: 12 }}>
                    {CR_BANDS.map((b, i) => (
                      <span key={b} className={`crs-dot${i <= bandIndex ? ' on' : ''}`} title={b} />
                    ))}
                    <span className="crs-of">{bandIndex + 1} of 4</span>
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
                  <div style={{ fontSize: 28, fontWeight: 800 }}>{health.score}</div>
                </div>
                <div>
                  <div className="tiny muted">Trend</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '•'} {delta > 0 ? '+' : ''}
                    {delta.toFixed(1)} vs last month
                  </div>
                </div>
              </div>

              <div className="about-grid" style={{ marginTop: 12 }}>
                <div className="ab">
                  <div className="l">Revenue growth</div>
                  <div className="v">{pct(health.revGrowth)}</div>
                </div>
                <div className="ab">
                  <div className="l">Expense growth</div>
                  <div className="v">{pct(health.expGrowth)}</div>
                </div>
                <div className="ab">
                  <div className="l">Average revenue</div>
                  <div className="v">{money(health.avgRevenue)}</div>
                </div>
                <div className="ab">
                  <div className="l">Average expenses</div>
                  <div className="v">{money(health.avgExpenses)}</div>
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
                    {input.history.map((period, index) => {
                      const score = input.history.slice(0, index + 1).length > 0 ? 0 : 0;
                      const periodScore = score;

                      return (
                        <tr key={period.date}>
                          <td>{monthLabel(period.date)}</td>
                          <td className="num mono">{money(period.revenue)}</td>
                          <td className="num mono">{money(period.expenses)}</td>
                          <td className="num mono">{money(period.revenue - period.expenses)}</td>
                          <td className="num mono">{periodScore}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {guidance.length > 0 && (
            <div className="panel" style={{ marginTop: 16 }}>
              <div className="panel-head">
                <h3>Recommendations</h3>
              </div>
              <div className="panel-body">
                {guidance.map((g, i) => (
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
