import Link from 'next/link';
import { getLogoUrls, getPlatformStats } from '@/lib/queries';
import { requireAdmin } from './guard';
import { AdminShell } from './admin-shell';
import { TrackingTable } from './tracking-table';
import '../workspace.css';
import '../admin.css';

/**
 * Proven's own view across every organisation.
 *
 * Deliberately narrow. This page answers one question — who is enrolled, and
 * are they reporting — and everything that is not that has moved into the
 * drawer beside it: what needs doing to Needs attention, who is doing well to
 * Portfolio health, the numbers to Insights, funders to Organisations.
 *
 * The panel used to open on a work queue, which made the front door a to-do
 * list and buried the platform's actual shape underneath it. The work is still
 * one click away and now carries a badge, so nothing is hidden; it is simply
 * no longer the first thing between staff and the roll.
 *
 * Guarded twice over: `requireAdmin` stops the page rendering, and the
 * security rules underneath return nothing to a non-admin anyway.
 */
export default async function AdminPage() {
  const { profile, intel, badges } = await requireAdmin();

  const stats = await getPlatformStats();

  /* Only the businesses NOT reachable through an organisation. Funded ones
     live under their funder, one click from Organisations; repeating them here
     would make this page the flat list it is meant to replace.

     Taken from the rows `requireAdmin` already fetched rather than asking for
     every business a second time: the intelligence query returns the same
     businesses with their funder and month counts already worked out. */
  const unlinked = intel.rows.filter((r) => !r.funderName);
  const unlinkedLogos = await getLogoUrls(unlinked.map((b) => b.business.logo_path));

  const silent = intel.rows.filter((r) => r.months === 0).length;

  return (
    <AdminShell
      active="overview"
      email={profile.email}
      badges={badges}
      title="Proven admin"
      subtitle="Everything across every organisation"
    >
      <div className="statstrip">
        <div className="s">
          <div className="l">People enrolled</div>
          <div className="v">{stats.users}</div>
          <div className="f">Entrepreneurs and funder staff</div>
        </div>

        <div className="s">
          <div className="l">Businesses enrolled</div>
          <div className="v">{stats.businesses}</div>
          <div className="f">
            <b>{stats.funded}</b> funded &middot; <b>{stats.unfunded}</b> tracking alone
            {stats.applicants > 0 && (
              <>
                {' '}
                &middot; <b>{stats.applicants}</b> awaiting
              </>
            )}
          </div>
        </div>

        <div className="s">
          <div className="l">Reporting</div>
          <div className="v">
            {stats.reporting}
            <span style={{ fontSize: 15, color: 'var(--faint)', fontWeight: 700 }}>
              {' '}
              / {stats.businesses}
            </span>
          </div>
          <div className="f">
            Have sent at least one month &middot; {stats.periods} months in total
          </div>
        </div>

        <div className="s">
          <div className="l">Organisations</div>
          <div className="v">{stats.organisations}</div>
          <div className="f">
            Funders and licensees &middot;{' '}
            <Link href="/admin/organisations">manage</Link>
          </div>
        </div>
      </div>

      {/* One line, not a work queue. It states the single fact that changes how
          the roll below should be read — enrolment is not the same as being
          helped — and points at the screen that can act on it. */}
      {silent > 0 && (
        <p className="adm-note">
          <b>
            {silent} business{silent === 1 ? '' : 'es'} enrolled but never reported.
          </b>{' '}
          Signed up and then went quiet, so nothing is helping them yet.{' '}
          <Link href="/admin/alerts">See who, with contact details</Link>.
        </p>
      )}

      <TrackingTable businesses={unlinked} logoUrls={unlinkedLogos} />

      <p className="tiny muted" style={{ marginTop: 16 }}>
        This view is read-only apart from evidence review. It shows who is
        enrolled and whether they are reporting, never the figures themselves: a
        business&rsquo;s numbers belong to the business and to the funder it has
        confirmed.
      </p>
    </AdminShell>
  );
}
