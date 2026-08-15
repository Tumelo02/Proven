import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAuditTrail, isPlatformAdmin } from '@/lib/queries';
import type { AuditSeverity } from '@/lib/database.types';
import '../../workspace.css';

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
  'portfolio.exported': 'Exported a portfolio',
  'personal_data.exported': 'Downloaded their own data',
};

const SEVERITY_CHIP: Record<AuditSeverity, string> = {
  info: 'grey',
  notice: 'blue',
  alert: 'red',
};

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string }>;
}) {
  if (!(await isPlatformAdmin())) notFound();

  const { severity } = await searchParams;
  const filter =
    severity === 'notice' || severity === 'alert' || severity === 'info'
      ? (severity as AuditSeverity)
      : undefined;

  const rows = await getAuditTrail({ ...(filter ? { severity: filter } : {}), limit: 300 });

  return (
    <div className="app">
      <main className="main">
        <div className="topbar">
          <div>
            <h2>Audit trail</h2>
            <div className="sub">Who did what, when, and from where</div>
          </div>
        </div>

        <div className="content">
          <Link
            href="/admin"
            className="tiny"
            style={{ display: 'inline-block', marginBottom: 13, textDecoration: 'none' }}
          >
            ← Back to admin
          </Link>

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
                  <tbody>
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
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="tiny muted" style={{ marginTop: 14 }}>
            Showing the most recent {rows.length}. This record cannot be edited or
            deleted by anyone, including Proven staff.
          </p>
        </div>
      </main>
    </div>
  );
}
