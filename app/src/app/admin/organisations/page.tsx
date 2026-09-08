import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrgSummaries } from '@/lib/queries';
import { requireAdmin } from '../guard';
import { AdminShell } from '../admin-shell';
import { NewOrganisation } from '../new-org';
import { PagedRows } from '@/components/Paged';
import type { AccountStatus } from '@/lib/database.types';
import '../../workspace.css';
import '../../admin.css';

const ACCOUNT_LABEL: Record<AccountStatus, string> = {
  pilot: 'Pilot',
  paying: 'Paying',
  internal: 'Internal',
  lapsed: 'Lapsed',
};

/* Paying is the good outcome, lapsed the one to act on, internal is ours and
   should not read as a customer. */
const ACCOUNT_CHIP: Record<AccountStatus, string> = {
  pilot: 'yellow',
  paying: 'green',
  internal: 'grey',
  lapsed: 'red',
};

/**
 * Funders and licensees, and the way to add one.
 *
 * Its own screen rather than a panel on the dashboard: this is where the
 * commercial side of the platform is managed, and it is a different job from
 * checking who is enrolled and reporting.
 */
export default async function AdminOrganisationsPage() {
  const { profile, badges, hide, access } = await requireAdmin({ intelligence: false });
  if (!access.can.manage_organisations) notFound();
  const orgs = await getOrgSummaries();

  const pending = orgs.reduce((s, o) => s + o.pending, 0);
  const confirmed = orgs.reduce((s, o) => s + o.confirmed, 0);
  const members = orgs.reduce((s, o) => s + o.members, 0);
  const paying = orgs.filter((o) => o.org.account_status === 'paying').length;

  return (
    <AdminShell
      active="organisations"
      email={profile.email}
      badges={badges}
      hide={hide}
      title="Organisations"
      subtitle="Funders, incubators and licensees"
    >
      <div className="statstrip">
        <div className="s">
          <div className="l">Organisations</div>
          <div className="v">{orgs.length}</div>
          <div className="f">
            {access.can.view_commercial ? `${paying} paying` : 'Funders and licensees'}
          </div>
        </div>
        <div className="s">
          <div className="l">Staff accounts</div>
          <div className="v">{members}</div>
          <div className="f">Across every organisation</div>
        </div>
        <div className="s">
          <div className="l">Confirmed links</div>
          <div className="v">{confirmed}</div>
          <div className="f">Businesses being supported</div>
        </div>
        <div className="s">
          <div className="l">Requests waiting</div>
          <div className="v" style={pending > 0 ? { color: 'var(--yellow)' } : undefined}>
            {pending}
          </div>
          <div className="f">The funder decides, not us</div>
        </div>
      </div>

      <NewOrganisation />

      <div className="panel">
        <div className="panel-head">
          <h3>Funding organisations</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            Each sees only the businesses it has confirmed
          </span>
        </div>

        {orgs.length === 0 ? (
          <div className="panel-body">
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              No organisations yet.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="fixed-cols">
              {/* Standing is only rendered for a staff account granted it, so
                  its column has to appear and disappear with the header, or the
                  widths would land on the wrong columns for everyone else. */}
              <colgroup>
                <col style={{ width: access.can.view_commercial ? '30%' : '34%' }} />
                {access.can.view_commercial && <col style={{ width: '14%' }} />}
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: access.can.view_commercial ? '8%' : '18%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Organisation</th>
                  {access.can.view_commercial && <th>Standing</th>}
                  <th>Code</th>
                  <th className="num">People</th>
                  <th className="num">Businesses</th>
                  <th className="num">Requests waiting</th>
                </tr>
              </thead>
              <PagedRows label="organisations" columns={access.can.view_commercial ? 6 : 5}>
                {orgs.map(({ org, members: memberCount, confirmed: confirmedCount, pending: pendingCount }) => (
                  <tr key={org.id}>
                    <td>
                      {/* Opens the organisation rather than showing every
                          business on the platform at once: fifty funders and a
                          thousand businesses is unusable flat. */}
                      <Link
                        href={`/admin/org/${org.id}`}
                        style={{ textDecoration: 'none', color: 'var(--ink)' }}
                      >
                        <strong>{org.name}</strong>
                      </Link>
                    </td>
                    {/* Commercial standing, staff-side only, and only for a
                        staff account granted it: whether a funder is paying or
                        lapsed is not something a reviewer brought in to check
                        receipts needs to see. */}
                    {access.can.view_commercial && (
                      <td>
                        <span className={`chip ${ACCOUNT_CHIP[org.account_status]}`}>
                          {ACCOUNT_LABEL[org.account_status]}
                        </span>
                        {org.account_until && (
                          <div className="tiny muted" style={{ marginTop: 2 }}>
                            to {org.account_until}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="muted mono">{org.slug}</td>
                    <td className="num mono">{memberCount}</td>
                    <td className="num mono">{confirmedCount}</td>
                    <td className="num">
                      {pendingCount > 0 ? (
                        <span className="chip yellow">
                          <span className="dot" />
                          {pendingCount}
                        </span>
                      ) : (
                        <span className="muted mono">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </PagedRows>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
