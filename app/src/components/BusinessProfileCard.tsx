import { monthLabel } from '@proven/engine';
import type {
  Business,
  EmploymentType,
  StaffCount,
  TeamMember,
} from '@/lib/database.types';

const TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  casual: 'Casual',
  volunteer: 'Volunteer',
  owner: 'Owner',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div>
      <div className="tiny muted">{label}</div>
      <div style={{ fontSize: 13.5 }}>{value}</div>
    </div>
  );
}

/**
 * Who this business actually is, for the funder reading its record.
 *
 * Read-only, like everything else on the funder side. Blank fields are omitted
 * rather than shown empty: an informal business that has no VAT number should
 * not read as a record full of gaps.
 */
export function BusinessProfileCard({
  business,
  team,
  staffCounts,
  logoUrl,
}: {
  business: Business;
  team: TeamMember[];
  staffCounts: StaffCount[];
  logoUrl: string | null;
}) {
  const b = business;
  const current = team.filter((m) => !m.left_on);

  const latest = staffCounts[staffCounts.length - 1];
  const first = staffCounts[0];
  const total = (s: StaffCount) => s.full_time + s.part_time + s.casual;
  const jobsNow = latest ? total(latest) : current.length || b.staff_count;
  const jobsCreated = latest && first ? total(latest) - total(first) : 0;

  /* Owners come from the team, so a business with two or three partners shows
     all of them rather than only whoever is in the single contact field. */
  const owners = current.filter((m) => m.is_owner);
  const ownerLine = owners.length
    ? owners
        .map((m) => m.full_name + (m.ownership_pct !== null ? ` (${m.ownership_pct}%)` : ''))
        .join(', ')
    : [b.owner_name, b.owner_role].filter(Boolean).join(', ');

  const place = [b.address_line, b.city, b.province, b.postal_code]
    .filter((s) => s && s.trim())
    .join(', ');

  const contact = [b.owner_phone, b.owner_email].filter((s) => s && s.trim()).join(' · ');

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-body">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 12,
              flex: '0 0 58px',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              fontWeight: 800,
              color: 'var(--muted)',
            }}
          >
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- a signed
                 storage URL, already short-lived; next/image would cache a
                 link that expires. */
              <img
                src={logoUrl}
                alt={`${b.name} logo`}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              initials(b.name)
            )}
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{b.name}</div>
            {b.tagline && (
              <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 2 }}>
                {b.tagline}
              </div>
            )}
            <div className="tiny muted" style={{ marginTop: 4 }}>
              {[b.industry, b.region].filter(Boolean).join(' · ')}
            </div>
          </div>

          {/* Jobs first: it is the number an incubator or development funder
              reports upward, and the one they most often have to go and ask
              for by email. */}
          <div style={{ textAlign: 'right' }}>
            <div className="tiny muted">Jobs supported</div>
            <div style={{ fontSize: 21, fontWeight: 800 }}>{jobsNow}</div>
            {jobsCreated !== 0 && (
              <div
                className="tiny"
                style={{ color: jobsCreated > 0 ? 'var(--green)' : 'var(--red)' }}
              >
                {jobsCreated > 0 ? '+' : ''}
                {jobsCreated} since joining
              </div>
            )}
          </div>
        </div>

        {b.description && (
          <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 14, marginBottom: 0 }}>
            {b.description}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 12,
            marginTop: 16,
          }}
        >
          <Field label={owners.length > 1 ? 'Owners' : 'Owner'} value={ownerLine} />
          <Field label="Contact" value={contact} />
          <Field label="Address" value={place} />
          <Field label="Trading since" value={b.started_on ? monthLabel(b.started_on) : ''} />
          <Field label="Registration" value={b.registration_number} />
          <Field label="Tax number" value={b.tax_number} />
          <Field label="VAT" value={b.vat_number} />
          <Field label="B-BBEE" value={b.bbbee_level} />
          <Field label="Website" value={b.website} />
          <Field label="Social" value={b.social_handle} />
        </div>

        {current.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="tiny muted" style={{ marginBottom: 7 }}>
              Team ({current.length})
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {current.map((m) => (
                    <tr key={m.id}>
                      <td>
                        {m.full_name}
                        {m.is_owner && (
                          <span className="pill blue" style={{ marginLeft: 6, fontSize: 10 }}>
                            Owner
                            {m.ownership_pct !== null ? ` ${m.ownership_pct}%` : ''}
                          </span>
                        )}
                      </td>
                      <td className="tiny">{m.role || '—'}</td>
                      <td className="tiny">{TYPE_LABEL[m.employment_type]}</td>
                      <td className="tiny">{m.started_on ? monthLabel(m.started_on) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Headcount by month: the figure a development funder reports upward,
            and the one they would otherwise have to ask for by email. */}
        {staffCounts.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="tiny muted" style={{ marginBottom: 7 }}>
              Jobs by month
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Full time</th>
                    <th className="num">Part time</th>
                    <th className="num">Casual</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...staffCounts].reverse().map((s) => (
                    <tr key={s.id}>
                      <td>{monthLabel(s.period_month)}</td>
                      <td className="mono">{s.full_time}</td>
                      <td className="mono">{s.part_time}</td>
                      <td className="mono">{s.casual}</td>
                      <td className="mono">
                        <b>{total(s)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
