import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CR_BANDS,
  currentMilestone,
  fundingUtilisation,
  milestoneProgress,
  money,
  pct,
  reportingStatus,
} from '@proven/engine';
import { getBusinessShell, getScoredBusiness, getMyOrganisations } from '@/lib/queries';
import { EntrepreneurShell } from './shell';
import {
  Chip,
  Kpi,
  Panel,
  RecCard,
  ScoreRing,
  ScoreSpark,
  TrendGlyph,
} from '@/components/workspace';
import { MonthForm } from './month-form';
import '../../workspace.css';

export default async function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [shell, orgs] = await Promise.all([getBusinessShell(id), getMyOrganisations()]);
  if (!shell) notFound();

  /* A business with no months logged cannot be scored, so it gets the setup
     screen rather than a dashboard full of zeroes that would read as failure. */
  if (!shell.periods.length) {
    return (
      <EntrepreneurShell businessId={id} active="overview" showSwitchRole={orgs.length > 0}>
        <Panel title="Add your first month of figures">
          <p style={{ maxWidth: 460, marginTop: 0, color: 'var(--muted)', fontSize: 13.5 }}>
            Your score is worked out from what you report each month. Add one
            month to get started, and add the months before it if you have
            them: the more history, the stronger the record.
          </p>
          <div style={{ maxWidth: 420 }}>
            <MonthForm businessId={id} />
          </div>
        </Panel>
      </EntrepreneurShell>
    );
  }

  const scored = await getScoredBusiness(id);
  if (!scored) notFound();

  const { business, health, readiness, decision, guidance, delta, trend, input, funder } =
    scored;

  const last = input.history[input.history.length - 1]!;
  const cash = last.revenue - last.expenses;
  const rep = reportingStatus(input);
  const util = fundingUtilisation(input.milestones);
  const progress = milestoneProgress(input.milestones);

  /* Three states, each earned, rather than colour on everything or colour on
     nothing. Green marks a real improvement, amber a warning worth watching,
     red an actual problem. A number that is merely steady stays in plain ink,
     so the colours that do appear still mean something.

     Sales: growing is good, falling is a problem.
     Costs: the figure only matters against sales. Costs rising FASTER than
     sales is the problem, because that is the gap closing on the business.
     Costs rising more slowly than sales is normal growth, and costs actually
     falling is genuinely good news. */
  const revTone =
    health.revGrowth > 0.02
      ? 'var(--green)'
      : health.revGrowth < -0.005
        ? 'var(--red)'
        : undefined;

  const expGap = health.expGrowth - health.revGrowth;
  const expTone =
    expGap > 0.02
      ? 'var(--red)'
      : expGap > 0
        ? 'var(--yellow)'
        : health.expGrowth < 0
          ? 'var(--green)'
          : undefined;

  const bandIndex = CR_BANDS.indexOf(readiness.status);

  return (
    <EntrepreneurShell
      businessId={id}
      active="overview"
      showSwitchRole={orgs.length > 0}
      guidanceCount={guidance.length}
      guidanceAlarm={guidance.some((g) => g.sev === 'red' || g.sev === 'yellow')}
    >
      {/* Score, trend, stage progress and credit readiness, all in one row. */}
      <div className="panel score-hero" style={{ marginBottom: 16 }}>
        <ScoreRing score={health.score} tier={health.tier} />

        <div className="hero-detail">
          <Chip tier={health.tier}>{
            health.tier === 'green' ? 'Healthy' : health.tier === 'yellow' ? 'Watch' : 'At Risk'
          }</Chip>

          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span>
              Trend <TrendGlyph trend={trend} delta={delta} /> vs last month
            </span>
            <ScoreSpark biz={input} />
            <span className="tiny muted">last 6 months</span>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="tiny muted">Progress through the stages</div>
            <div className="progress-track" style={{ marginTop: 5 }}>
              <i style={{ width: `${progress}%` }} />
            </div>
            <div className="tiny muted" style={{ marginTop: 5 }}>
              {currentMilestone(input.milestones)} &middot; {progress}% complete
            </div>
          </div>
        </div>

        {/* Beside the score, so what the record is earning is visible without
            scrolling: it is the entrepreneur's reason to keep going. */}
        <div className={`cr-side ${readiness.color}`}>
          <div className="crs-label">Credit readiness</div>
          <div className="crs-status">{readiness.status}</div>
          <div className="crs-plain">{readiness.plain}</div>
          <div className="crs-dots">
            {CR_BANDS.map((b, i) => (
              <span key={b} className={`crs-dot${i <= bandIndex ? ' on' : ''}`} title={b} />
            ))}
            <span className="crs-of">{bandIndex + 1} of 4</span>
          </div>
        </div>
      </div>

      <div className="kpis">
        <Kpi
          label="Sales trend"
          value={pct(health.revGrowth)}
          foot="last 3 months vs the 3 before"
          {...(revTone ? { tone: revTone } : {})}
        />
        <Kpi
          label="Cost trend"
          value={pct(health.expGrowth)}
          foot="last 3 months vs the 3 before"
          {...(expTone ? { tone: expTone } : {})}
        />
        {/* Ending the month with money left is the clearest good news a small
            business gets, and ending short is the clearest problem. Both are
            worth marking. */}
        <Kpi
          label="Money left over"
          value={cash >= 0 ? 'Positive' : 'Negative'}
          foot={`${cash >= 0 ? 'You kept ' : 'You were short '}${money(Math.abs(cash))} last month`}
          tone={cash >= 0 ? 'var(--green)' : 'var(--red)'}
        />
        <Kpi
          label="Funding used"
          value={`${util}%`}
          foot={funder ? `of the funding from ${funder.name}` : 'of the funding received'}
        />
      </div>

      {/* Where this business stands in its reporting cycle, stated plainly. */}
      <div className={`duebar ${rep.state}`}>
        <span className="dueicon">
          {rep.sent ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
              <path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
          )}
        </span>
        <div>
          <div className="duetitle">{rep.title}</div>
          <div className="duesub">{rep.detail}</div>
        </div>
        {rep.state !== 'ok' && !rep.sent && (
          <Link className="btn sm duebtn" href={`/business/${id}/transactions`}>
            Send update
          </Link>
        )}
      </div>

      <div className="grid2">
        <Panel title="Where you stand" hint="What a funder would see right now">
          <div className={`decision ${decision.kind}`}>
            <div className="glyph">
              {decision.kind === 'release' ? '✔' : decision.kind === 'hold' ? '⏸' : '⚠'}
            </div>
            <div>
              <div className="lbl">Status</div>
              <div className="act">{decision.action}</div>
              <div className="why">{decision.why}</div>
            </div>
          </div>
        </Panel>

        <Panel title="Do this first">
          {guidance.slice(0, 1).map((g, i) => (
            <RecCard key={i} g={g} />
          ))}
          <Link
            className="btn ghost sm"
            style={{ marginTop: 10 }}
            href={`/business/${id}/guidance`}
          >
            See all recommendations
          </Link>
        </Panel>
      </div>
    </EntrepreneurShell>
  );
}
