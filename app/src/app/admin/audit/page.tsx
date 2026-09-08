import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAuditTrail } from '@/lib/queries';
import { requireAdmin } from '../guard';
import { AdminShell } from '../admin-shell';
import { PagedRows } from '@/components/Paged';
import type { AuditSeverity } from '@/lib/database.types';
import '../../workspace.css';
import '../../admin.css';

/**
 * What has happened on the platform, newest first.
 *
 * The trail answers questions after the fact: which account read that
 * portfolio, when, and from where. It prevents nothing. It is evidence, and it
 * is only worth keeping because it cannot be rewritten: `audit_log` has no
 * UPDATE and no DELETE policy, so not even Proven staff can alter it.
 */

/** Plain wording, so a row reads without knowing the action codes. */
const ACTION_LABEL: Record<string, string> = {
  'auth.signed_in': 'Signed in',
  'auth.staff_signed_in': 'Proven staff signed in',
  'auth.sign_in_failed': 'Failed sign-in',
  'organisation.created': 'Created an organisation',
  'organisation.account_changed': 'Changed a commercial standing',
  'document.verified': 'Marked a document verified',
  'document.rejected': 'Turned a document down',
  'funding_link.confirmed': 'Confirmed a funding link',
  'funding_link.rejected': 'Declined a funding link',
  'organisation.updated': 'Changed an organisation profile',
  'support_terms.updated': 'Changed what they provide',
  'portfolio.exported': 'Exported a portfolio',
  'personal_data.exported': 'Downloaded their own data',
};

const SEVERITY_CHIP: Record<AuditSeverity, string> = {
  info: 'grey',
  notice: 'blue',
  alert: 'red',
};

/**
 * Timestamps are stored as UTC and read here in South African time.
 *
 * The zone has to be named. Without it the formatter uses whatever zone the
 * machine is set to, and this renders on the server — which on Vercel is UTC,
 * so every entry read two hours behind the clock on the wall. Naming the zone
 * also means the trail says the same thing whoever opens it and wherever it is
 * deployed, which matters for a record whose whole purpose is answering "when
 * did this happen".
 */
function when(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  });
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string }>;
}) {
  const { profile, badges, hide, access } = await requireAdmin({ intelligence: false });
  if (!access.can.view_audit) notFound();

  const { severity } = await searchParams;
  const filter =
    severity === 'notice' || severity === 'alert' || severity === 'info'
      ? (severity as AuditSeverity)
      : undefined;

  const rows = await getAuditTrail({ ...(filter ? { severity: filter } : {}), limit: 300 });

  return (
    <AdminShell
      active="audit"
      email={profile.email}
      badges={badges}
      hide={hide}
      title="Audit trail"
      subtitle="Who did what, when, and from where"
    >
          <div className="toolbar" style={{ marginBottom: 16 }}>
            <div className="seg">
              {/* Ordered by how often they are wanted. Successful sign-ins are
                  the bulk of the traffic and rarely the thing being looked
                  for, so "Everything" is available but not the default place
                  the eye lands. */}
              {(
                [
                  ['alert', 'Needs attention'],
                  ['notice', 'Worth knowing'],
                  ['', 'Everything'],
                ] as const
              ).map(([value, label]) => (
                <Link
                  key={value || 'all'}
                  href={value ? `/admin/audit?severity=${value}` : '/admin/audit'}
                  className={(filter ?? '') === value ? 'on' : ''}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="panel">
            {rows.length === 0 ? (
              <div className="panel-body">
                <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
                  Nothing recorded yet.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Who</th>
                      <th>What</th>
                      <th>Organisation</th>
                      <th>From</th>
                    </tr>
                  </thead>
                  <PagedRows label="entries" columns={5}>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
                          {when(r.created_at)}
                        </td>
                        <td>
                          {r.actor_name}
                          <div className="tiny muted">{r.actor_email}</div>
                        </td>
                        <td>
                          <span className={`chip ${SEVERITY_CHIP[r.severity]}`}>
                            {ACTION_LABEL[r.action] ?? r.action}
                          </span>
                          {Object.keys(r.detail).length > 0 && (
                            <div className="tiny muted" style={{ marginTop: 3, maxWidth: 320 }}>
                              {Object.entries(r.detail)
                                .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`)
                                .join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="tiny">{r.org_name ?? '—'}</td>
                        <td className="tiny muted mono">{r.ip_address || '—'}</td>
                      </tr>
                    ))}
                  </PagedRows>
                </table>
              </div>
            )}
          </div>

      <p className="tiny muted" style={{ marginTop: 14 }}>
        Showing the most recent {rows.length}. This record cannot be edited or
        deleted by anyone, including Proven staff.
      </p>
    </AdminShell>
  );
}
