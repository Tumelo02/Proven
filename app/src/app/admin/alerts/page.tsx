import Link from 'next/link';
import { monthLabel } from '@proven/engine';
import { requireAdmin } from '../guard';
import { AdminShell } from '../admin-shell';
import { PagedRows } from '@/components/Paged';
import '../../workspace.css';
import '../../admin.css';

/**
 * Everything waiting on Proven staff, in one place.
 *
 * This is the page that answers "what do I have to do today", so it is ordered
 * by what a person can actually act on, not by severity in the abstract.
 * Evidence review comes first because it is the only item here that is
 * genuinely ours to clear: the others are people to chase or funders to wait
 * on, and saying so honestly is more useful than dressing them as tasks.
 *
 * Each group states its own emptiness rather than disappearing. A queue that
 * silently vanishes when clear leaves a reader unsure whether it was empty or
 * broken.
 */
export default async function AdminAlertsPage() {
  const { profile, intel, badges, hide } = await requireAdmin();

  const silent = intel.rows.filter((r) => r.months === 0);
  const late = intel.rows.filter((r) => r.months > 0 && r.reportingState === 'overdue');
  const rejected = intel.rows.filter((r) => r.rejectedDocuments > 0);

  /* Reported once, then stopped. Distinct from "never reported": someone who
     started and gave up is a different conversation from someone who never
     began, and the fix is different too. */
  const lapsed = late.filter((r) => r.months >= 2);

  return (
    <AdminShell
      active="alerts"
      email={profile.email}
      badges={badges}
      hide={hide}
      title="Needs attention"
      subtitle="Everything waiting on Proven, and everyone worth chasing"
    >
      {/* ------------------------------------------------------------------
          Ours to clear
          ------------------------------------------------------------------ */}
      <div className="worklist">
        <div className={`workitem ${intel.documentsPending > 0 ? 'todo' : 'clear'}`}>
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
              {intel.documentsPending > 0
                ? `${intel.documentsPending} document${intel.documentsPending === 1 ? '' : 's'} waiting to be checked`
                : 'All evidence has been checked'}
            </div>
            <div className="wsub">
              Proven verifies whether a document matches the entry it is attached
              to. Neither the business nor its funder can.
            </div>
          </div>
          <Link className="btn sm wbtn" href="/admin/review">
            {intel.documentsPending > 0 ? 'Review now' : 'Open review'}
          </Link>
        </div>

        <div className={`workitem ${intel.pendingLinks > 0 ? 'todo' : 'clear'}`}>
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
              {intel.pendingLinks > 0
                ? `${intel.pendingLinks} funding link${intel.pendingLinks === 1 ? '' : 's'} awaiting an organisation`
                : 'No funding links are waiting'}
            </div>
            <div className="wsub">
              A business named a funder who has not confirmed it yet. The funder
              decides, not us, so this is a nudge to make rather than a queue to
              clear.
            </div>
          </div>
          <Link className="btn ghost sm wbtn" href="/admin/organisations">
            See organisations
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          People to chase
          ------------------------------------------------------------------ */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>Enrolled but never reported</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            {silent.length} business{silent.length === 1 ? '' : 'es'}
          </span>
        </div>
        {silent.length === 0 ? (
          <div className="panel-body">
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Every enrolled business has reported at least one month.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Owner</th>
                  <th>Contact</th>
                  <th>Funder</th>
                  <th>Enrolled</th>
                </tr>
              </thead>
              <PagedRows label="businesses" columns={5}>
                {silent.map((r) => (
                  <tr key={r.business.id}>
                    <td>
                      <Link
                        href={`/admin/business/${r.business.id}`}
                        style={{ textDecoration: 'none', color: 'var(--ink)' }}
                      >
                        <strong>{r.business.name}</strong>
                      </Link>
                    </td>
                    <td className="muted">{r.business.owner_name || '—'}</td>
                    {/* The reason this table exists: chasing needs a way to
                        reach someone, so the contact is on the row rather than
                        one click away. */}
                    <td className="tiny muted">
                      {r.business.owner_email || '—'}
                      {r.business.owner_phone && (
                        <>
                          <br />
                          {r.business.owner_phone}
                        </>
                      )}
                    </td>
                    <td className="muted">{r.funderName || <span className="tiny">Not linked</span>}</td>
                    <td className="muted tiny">{r.business.created_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </PagedRows>
            </table>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>Started reporting, then went quiet</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            {lapsed.length} business{lapsed.length === 1 ? '' : 'es'}
          </span>
        </div>
        {lapsed.length === 0 ? (
          <div className="panel-body">
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Nobody who started reporting has fallen behind.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Contact</th>
                  <th className="num">Months sent</th>
                  <th>Last month sent</th>
                  <th>Standing</th>
                </tr>
              </thead>
              <PagedRows label="businesses" columns={5}>
                {lapsed.map((r) => (
                  <tr key={r.business.id}>
                    <td>
                      <Link
                        href={`/admin/business/${r.business.id}`}
                        style={{ textDecoration: 'none', color: 'var(--ink)' }}
                      >
                        <strong>{r.business.name}</strong>
                      </Link>
                    </td>
                    <td className="tiny muted">{r.business.owner_email || '—'}</td>
                    <td className="num mono">{r.months}</td>
                    <td className="muted">
                      {r.lastReported ? monthLabel(r.lastReported) : '—'}
                    </td>
                    <td>
                      <span className={`due-pill ${r.reportingState}`}>{r.reportingLabel}</span>
                    </td>
                  </tr>
                ))}
              </PagedRows>
            </table>
          </div>
        )}
      </div>

      {rejected.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <h3>Evidence turned down and not yet replaced</h3>
            <span className="hint" style={{ marginLeft: 'auto' }}>
              {rejected.length} business{rejected.length === 1 ? '' : 'es'}
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th className="num">Rejected</th>
                  <th className="num">Still pending</th>
                  <th className="num">Documents in total</th>
                </tr>
              </thead>
              <PagedRows label="businesses" columns={4}>
                {rejected.map((r) => (
                  <tr key={r.business.id}>
                    <td>
                      <Link
                        href={`/admin/business/${r.business.id}`}
                        style={{ textDecoration: 'none', color: 'var(--ink)' }}
                      >
                        <strong>{r.business.name}</strong>
                      </Link>
                    </td>
                    <td className="num mono">{r.rejectedDocuments}</td>
                    <td className="num mono">{r.pendingDocuments}</td>
                    <td className="num mono">{r.documents}</td>
                  </tr>
                ))}
              </PagedRows>
            </table>
          </div>
          <div className="panel-body">
            <p className="tiny muted" style={{ margin: 0 }}>
              A rejected document leaves the entry unbacked, so evidence
              coverage drops until a replacement is sent and checked.
            </p>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
