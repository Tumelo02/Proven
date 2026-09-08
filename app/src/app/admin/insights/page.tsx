import { requireAdmin } from '../guard';
import { AdminShell } from '../admin-shell';
import { GrowthChart } from '@/components/GrowthChart';
import { InsightsExplorer, type ExplorerRow } from './explorer';
import '../../workspace.css';
import '../../admin.css';

/**
 * Business intelligence for the platform.
 *
 * Two questions, in the order a board asks them: is the platform growing, and
 * what is inside it. Growth first as a single chart, then the breakdown, which
 * is filterable because "how are we doing" is never really one question — it
 * is that question asked of a province, an industry, or the businesses at risk.
 */
export default async function AdminInsightsPage() {
  const { profile, intel, badges, hide } = await requireAdmin();

  const rows: ExplorerRow[] = intel.rows.map((r) => ({
    id: r.business.id,
    name: r.business.name,
    industry: r.business.industry,
    region: r.business.region,
    fundingStatus:
      r.business.funding_status === 'funded'
        ? 'Funded'
        : r.business.funding_status === 'applicant'
          ? 'Awaiting a funder'
          : 'Tracking alone',
    funderName: r.funderName,
    months: r.months,
    score: r.score,
    tier: r.tier,
    createdAt: r.business.created_at,
  }));

  /* Counted from the businesses themselves, not from the last point on the
     chart. The chart's final month is the month being reported ON, and this
     month's figures are not due until the middle of next month — so its
     `reporting` value is legitimately low, and reading the headline rate off
     it would say nobody had ever reported. This is the real answer: how many
     businesses have ever sent a month. */
  const everReported = intel.rows.filter((r) => r.months > 0).length;
  const reportingRate = intel.rows.length
    ? Math.round((everReported / intel.rows.length) * 100)
    : 0;

  return (
    <AdminShell
      active="insights"
      email={profile.email}
      badges={badges}
      hide={hide}
      title="Insights"
      subtitle="How the platform is growing, and what is inside it"
    >
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>Platform growth</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            Cumulative, by month
          </span>
        </div>
        <div className="panel-body">
          <GrowthChart data={intel.enrolment} />

          {/* The single number worth stating outright. Enrolment on its own
              flatters the platform; this is the share of it that is real. */}
          <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
            <b>{reportingRate}%</b> of enrolled businesses ({everReported} of{' '}
            {intel.rows.length}) have reported at least one month. The chart is
            plotted against the month being reported on, so the newest month
            sits low until its figures fall due. Enrolment counts sign-ups;
            only reporting builds the record a business can borrow against.
          </p>
        </div>
      </div>

      <InsightsExplorer rows={rows} />
    </AdminShell>
  );
}
