import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAllBusinesses,
  getCurrentProfile,
  getOrgSummaries,
  getPendingReviewCount,
  getPlatformStats,
} from '@/lib/queries';
import { signOut } from '@/app/(auth)/actions';
import { NewOrganisation } from './new-org';
import '../workspace.css';

/**
 * Proven's own view across every organisation.
 *
 * Ordered as a work queue rather than a status board: what needs checking sits
 * above the totals, because that is why this page gets opened. The counts are
 * context for the work, so they read as one quiet strip rather than a row of
 * cards competing with each other.
 *
 * Guarded twice over. The check below stops the page rendering, and the
 * security rules underneath return nothing to a non-admin anyway.
 *
 * `notFound()` rather than a redirect or a "forbidden" message: a stranger
 * should not be able to learn that this route exists.
 */
export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile?.is_platform_admin) notFound();

  const [stats, orgs, businesses, pendingReviews] = await Promise.all([
    getPlatformStats(),
    getOrgSummaries(),
    getAllBusinesses(),
    getPendingReviewCount(),
  ]);

  const linked = businesses.filter((b) => b.funderName);
  const unlinked = businesses.filter((b) => !b.funderName);
  const silent = businesses.filter((b) => b.months === 0);
  const pendingLinks = orgs.reduce((s, o) => s + o.pending, 0);

  return (
    <div className="app">
      <main className="main">
        <div className="topbar">
          {/* These pages have no sidebar, so the mark sits here: the screen
              should read as Proven before it reads as a table of numbers. */}
          <div className="admin-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
            <img src="/assets/logo_only__1_-removebg-preview.png" alt="" />
            <div>
              <h2>Proven admin</h2>
              <div className="sub">Everything across every organisation</div>
            </div>
          </div>
          <div className="row">
            <span className="tiny muted">{profile.email}</span>
            <Link className="btn ghost sm" href="/admin/audit">
              Audit trail
            </Link>
            <Link className="btn ghost sm" href="/dashboard">
              My dashboard
            </Link>
            <form action={signOut}>
              <button className="btn ghost sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="content">
          {/* ---------------------------------------------------------------
              What needs us. First, because it is the reason to open this page.
              --------------------------------------------------------------- */}
          <div className="worklist">
            <div className={`workitem ${pendingReviews > 0 ? 'todo' : 'clear'}`}>
              <span className="wicon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3.5h9L19 7.5v13H6v-17Z" />
                  <path d="M14.6 3.6v4.2h4.2" />
                  <path d="m9.2 14 2.1 2.1 4-4" />
                </svg>
              </span>
              <div>
                <div className="wtitle">
                  {pendingReviews > 0
                    ? `${pendingReviews} document${pendingReviews === 1 ? '' : 's'} waiting to be checked`
                    : 'All evidence has been checked'}
                </div>
                <div className="wsub">
                  Proven verifies whether a document matches the entry it is
                  attached to. Neither the business nor its funder can.
                </div>
              </div>
              <Link className="btn sm wbtn" href="/admin/review">
                {pendingReviews > 0 ? 'Review now' : 'Open review'}
              </Link>
            </div>

            {/* Enrolment is not the same as being helped. A business that
                signed up and never reported is the number worth watching. */}
            {silent.length > 0 && (
              <div className="workitem">
                <span className="wicon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 8v5" />
                    <path d="M12 16.5h.01" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </span>
                <div>
                  <div className="wtitle">
                    {silent.length} business{silent.length === 1 ? '' : 'es'} enrolled but
                    never reported
                  </div>
                  <div className="wsub">
                    Signed up and then went quiet. Nothing is helping them yet.
                  </div>
                </div>
              </div>
            )}

            {pendingLinks > 0 && (
              <div className="workitem">
                <span className="wicon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.5 14.5 14.5 9.5" />
                    <path d="M7 12 4.8 14.2a3.1 3.1 0 0 0 4.4 4.4L11.4 16.4" />
                    <path d="M17 12l2.2-2.2a3.1 3.1 0 0 0-4.4-4.4L12.6 7.6" />
                  </svg>
                </span>
                <div>
                  <div className="wtitle">
                    {pendingLinks} funding link{pendingLinks === 1 ? '' : 's'} awaiting an
                    organisation
                  </div>
                  <div className="wsub">
                    A business named a funder who has not confirmed it yet. The
                    funder decides, not us.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ---------------------------------------------------------------
              Context. Four figures, not seven: the funding states are parts of
              the business count, so they belong underneath it.
              --------------------------------------------------------------- */}
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
              <div className="f">Funders and licensees</div>
            </div>
          </div>

          {/* ---------------------------------------------------------------
              The detail
              --------------------------------------------------------------- */}
          <NewOrganisation />

          <div className="panel" style={{ marginBottom: 16 }}>
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
                <table>
                  <thead>
                    <tr>
                      <th>Organisation</th>
                      <th>Code</th>
                      <th className="num">People</th>
                      <th className="num">Businesses</th>
                      <th className="num">Requests waiting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map(({ org, members, confirmed, pending }) => (
                      <tr key={org.id}>
                        <td>
                          {/* Opens the organisation rather than showing every
                              business on the platform at once: fifty funders
                              and a thousand businesses is unusable flat. */}
                          <Link
                            href={`/admin/org/${org.id}`}
                            style={{ textDecoration: 'none', color: 'var(--ink)' }}
                          >
                            <strong>{org.name}</strong>
                          </Link>
                        </td>
                        <td className="muted mono">{org.slug}</td>
                        <td className="num mono">{members}</td>
                        <td className="num mono">{confirmed}</td>
                        <td className="num">
                          {pending > 0 ? (
                            <span className="chip yellow">
                              <span className="dot" />
                              {pending}
                            </span>
                          ) : (
                            <span className="muted mono">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Only the businesses NOT reachable through an organisation.
              Funded ones live under their funder, one click from the table
              above; repeating them here would make this page the flat list it
              is meant to replace. */}
          <div className="panel">
            <div className="panel-head">
              <h3>Tracking independently</h3>
              <span className="hint" style={{ marginLeft: 'auto' }}>
                {unlinked.length} of {businesses.length} businesses have no funder
              </span>
            </div>

            {unlinked.length === 0 ? (
              <div className="panel-body">
                <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
                  Every business is attached to an organisation.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>Industry</th>
                      <th>Region</th>
                      <th className="num">Months</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unlinked.map(({ business, linkStatus, months }) => (
                      <tr key={business.id}>
                        <td>
                          <strong>{business.name}</strong>
                          {linkStatus === 'pending' && (
                            <span className="chip yellow" style={{ marginLeft: 6 }}>
                              <span className="dot" />
                              Awaiting confirmation
                            </span>
                          )}
                        </td>
                        <td className="muted">{business.industry || '—'}</td>
                        <td className="muted">{business.region || '—'}</td>
                        <td className="num mono">
                          {months === 0 ? <span className="muted">None</span> : months}
                        </td>
                        <td className="muted tiny">{business.created_at.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="tiny muted" style={{ marginTop: 16 }}>
            This view is read-only apart from evidence review. It shows who is
            enrolled and whether they are reporting, never the figures
            themselves: a business&rsquo;s numbers belong to the business and to
            the funder it has confirmed.
          </p>
        </div>
      </main>
    </div>
  );
}
