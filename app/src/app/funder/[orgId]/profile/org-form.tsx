'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  removeOrgLogo,
  saveOrgProfile,
  uploadOrgLogo,
  type OrgFormState,
} from '../../actions';
import type { OrgContact, Organisation, OrgType } from '@/lib/database.types';

const ORG_TYPES: { value: OrgType; label: string }[] = [
  { value: 'funder', label: 'Funder' },
  { value: 'incubator', label: 'Incubator' },
  { value: 'accelerator', label: 'Accelerator' },
  { value: 'government', label: 'Government' },
  { value: 'other', label: 'Other' },
];

const PROVINCES = [
  'National',
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save profile'}
    </button>
  );
}

function UploadButton({ hasLogo }: { hasLogo: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn ghost sm" type="submit" disabled={pending}>
      {pending ? 'Uploading…' : hasLogo ? 'Replace' : 'Upload logo'}
    </button>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn ghost sm" type="submit" disabled={pending}>
      {pending ? 'Removing…' : 'Remove'}
    </button>
  );
}

export function OrgProfileForm({
  org,
  contact,
  logoUrl,
  canEdit,
}: {
  org: Organisation;
  contact: OrgContact | null;
  logoUrl: string | null;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState<OrgFormState, FormData>(saveOrgProfile, {});
  const [upState, upAction] = useActionState<OrgFormState, FormData>(uploadOrgLogo, {});
  const [rmState, rmAction] = useActionState<OrgFormState, FormData>(removeOrgLogo, {});

  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>Logo</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            Shown to your businesses and on exported reports
          </span>
        </div>
        <div className="panel-body">
          {upState.error && <div className="notice error">{upState.error}</div>}
          {rmState.error && <div className="notice error">{rmState.error}</div>}

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: 14,
                flex: '0 0 76px',
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                background: logoUrl ? '#fff' : 'var(--bg)',
                border: '1px solid var(--line)',
                fontWeight: 800,
                fontSize: 22,
                color: 'var(--muted)',
              }}
            >
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element -- a signed
                   storage URL that changes each load. */
                <img
                  src={logoUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                initials(org.name)
              )}
            </div>

            {canEdit && (
              <div style={{ flex: 1, minWidth: 220 }}>
                <input
                  form="orgLogoForm"
                  type="file"
                  name="logo"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  style={{ fontSize: 12, maxWidth: 260, display: 'block' }}
                />
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    marginTop: 10,
                  }}
                >
                  <form id="orgLogoForm" action={upAction}>
                    <input type="hidden" name="org_id" value={org.id} />
                    <UploadButton hasLogo={!!logoUrl} />
                  </form>
                  {logoUrl && (
                    <form action={rmAction}>
                      <input type="hidden" name="org_id" value={org.id} />
                      <RemoveButton />
                    </form>
                  )}
                </div>
                <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
                  JPG, PNG, WEBP or SVG, up to 2 MB.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <form action={formAction}>
        <input type="hidden" name="org_id" value={org.id} />

        {state.error && <div className="notice error">{state.error}</div>}
        {state.message && <div className="notice ok">{state.message}</div>}

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <h3>Organisation</h3>
          </div>
          <div className="panel-body">
            <div className="txn-form">
              <div className="f">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  defaultValue={org.name}
                  required
                  disabled={!canEdit}
                />
              </div>
              <div className="f">
                <label htmlFor="org_type">Type</label>
                <select
                  id="org_type"
                  name="org_type"
                  defaultValue={org.org_type}
                  disabled={!canEdit}
                >
                  {ORG_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="f">
                <label htmlFor="province">Where you work</label>
                <select
                  id="province"
                  name="province"
                  defaultValue={org.province}
                  disabled={!canEdit}
                >
                  <option value="">Not stated</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="f">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  type="url"
                  defaultValue={org.website}
                  placeholder="https://"
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="f" style={{ marginTop: 12 }}>
              <label htmlFor="tagline">In one line</label>
              <input
                id="tagline"
                name="tagline"
                type="text"
                defaultValue={org.tagline}
                maxLength={140}
                placeholder="e.g. Funding township businesses across Gauteng"
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <h3>Contact</h3>
            <span className="hint" style={{ marginLeft: 'auto' }}>
              Seen only by businesses you have confirmed
            </span>
          </div>
          <div className="panel-body">
            <div className="txn-form">
              <div className="f">
                <label htmlFor="contact_name">Name</label>
                <input
                  id="contact_name"
                  name="contact_name"
                  type="text"
                  defaultValue={contact?.contact_name ?? ''}
                  disabled={!canEdit}
                />
              </div>
              <div className="f">
                <label htmlFor="contact_role">Role</label>
                <input
                  id="contact_role"
                  name="contact_role"
                  type="text"
                  defaultValue={contact?.contact_role ?? ''}
                  placeholder="e.g. Portfolio Manager"
                  disabled={!canEdit}
                />
              </div>
              <div className="f">
                <label htmlFor="contact_email">Email</label>
                <input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  defaultValue={contact?.contact_email ?? ''}
                  disabled={!canEdit}
                />
              </div>
              <div className="f">
                <label htmlFor="contact_phone">Phone</label>
                <input
                  id="contact_phone"
                  name="contact_phone"
                  type="tel"
                  defaultValue={contact?.contact_phone ?? ''}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>
        </div>

        {canEdit && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
            <SaveButton />
          </div>
        )}
      </form>
    </>
  );
}
