import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrgDetail, isPlatformAdmin } from '@/lib/queries';
import { Kpi } from '@/components/workspace';
import { AccountForm } from './account-form';
import type { OrgType } from '@/lib/database.types';
import '../../../workspace.css';

const ORG_TYPE_LABEL: Record<OrgType, string> = {
  funder: 'Funder',
  incubator: 'Incubator',
  accelerator: 'Accelerator',
  government: 'Government',
  other: 'Supporter',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * One organisation, for Proven staff.
 *
 * Read-only, like the rest of the admin panel. It shows who is enrolled and
 * whether they are reporting, never the figures themselves: a business's
 * revenue belongs to that business and to the funder it has confirmed.
 */
export default async function AdminOrgPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  /* Not found rather than forbidden, so nobody who should not have this can
     learn that the page exists. */
  if (!(await isPlatformAdmin())) notFound();

  const detail = await getOrgDetail(orgId);
  if (!detail) notFound();

  const { org, contact, logoUrl, members, businesses, pending } = detail;
  const reporting = businesses.filter((b) => b.months > 0).length;
  const silent = businesses.filter((b) => b.months === 0);

  return (
    <div className="app">
      <main className="main">
        <div className="topbar">
          <div>
            <h2>{org.name}</h2>
            <div className="sub">{ORG_TYPE_LABEL[org.org_type]}</div>
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

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-body">
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="org-mark" style={{ width: 52, height: 52, flex: '0 0 52px' }}>
                  {logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- signed URL */
                    <img src={logoUrl} alt="" />
                  ) : (
                    initials(org.name)
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{org.name}</div>
                  {org.tagline && (
                    <div className="tiny muted" style={{ marginTop: 2 }}>
                      {org.tagline}
                    </div>
                  )}
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    Code <span className="mono">{org.slug}</span>
                    {org.province ? ` · ${org.province}` : ''}
                    {org.website ? ` · ${org.website}` : ''}
                  </div>
                </div>
                {contact?.contact_name && (
                  <div style={{ textAlign: 'right' }}>
                    <div className="tiny muted">Contact</div>
                    <div style={{ fontSize: 13 }}>{contact.contact_name}</div>
                    <div className="tiny muted">
                      {[contact.contact_email, contact.contact_phone]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Staff-side only. Never rendered on the funder's own profile. */}
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <h3>Commercial standing</h3>
              <span className="hint" style={{ marginLeft: 'auto' }}>
                Not shown to the organisation
              </span>
            </div>
            <div className="panel-body">
              <AccountForm
                orgId={org.id}
                status={org.account_status}
                until={org.account_until}
                note={org.account_note}
              />
            </div>
          </div>

          <div className="kpis">
            <Kpi label="Businesses" value={businesses.length} foot="confirmed links" />
            <Kpi label="Reporting" value={reporting} foot="have submitted figures" />
            <Kpi
              label="Never reported"
              value={silent.length}
              foot="enrolled but silent"
              {...(silent.length ? { tone: 'var(--yellow)' } : {})}
            />
            <Kpi label="Requests waiting" value={pending} foot="not yet confirmed" />
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <h3>Businesses</h3>
              <span className="hint" style={{ marginLeft: 'auto' }}>
                Enrolment is not the same as being helped
              </span>
            </div>
            {businesses.length === 0 ? (
              <div className="panel-body">
                <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
                  No confirmed businesses yet.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>Who to contact</th>
                      <th>Industry</th>
                      <th>Region</th>
                      <th className="num">Months reported</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {businesses.map((b) => (
                      <tr key={b.business.id}>
                        <td>
                          <strong>{b.business.name}</strong>
                        </td>
                        {/* The person to call. Without this, following up on a
                            business means going back to the funder to ask who
                            runs it. */}
                        <td className="tiny">
                          {b.business.owner_name || (
                            <span className="muted">Not filled in</span>
                          )}
                          {(b.business.owner_phone || b.business.owner_email) && (
                            <div className="muted">
                              {[b.business.owner_phone, b.business.owner_email]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="tiny">{b.business.industry || '—'}</td>
                        <td className="tiny">{b.business.region || '—'}</td>
                        <td className="num mono">
                          {b.months === 0 ? (
                            <span className="chip yellow">
                              <span className="dot" />0
                            </span>
                          ) : (
                            b.months
                          )}
                        </td>
                        <td className="tiny muted">{fmt(b.business.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>People</h3>
              <span className="hint" style={{ marginLeft: 'auto' }}>
                {members.length} with access
              </span>
            </div>
            {members.length === 0 ? (
              <div className="panel-body">
                <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
                  Nobody has been given access to this organisation yet.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.profile.id}>
                        <td>{m.profile.full_name || '—'}</td>
                        <td className="tiny muted">{m.profile.email}</td>
                        <td>
                          <span className={`chip ${m.role === 'admin' ? 'blue' : 'grey'}`}>
                            {m.role === 'admin' ? 'Admin' : 'Member'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
