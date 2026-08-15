'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { removeLogo, uploadLogo, type FormState } from './actions';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
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

/**
 * The logo, with its upload and removal.
 *
 * Two separate forms rather than one with two buttons, so each gets its own
 * pending state and a failed upload cannot be confused with a failed removal.
 */
export function LogoCard({
  businessId,
  businessName,
  logoUrl,
}: {
  businessId: string;
  businessName: string;
  logoUrl: string | null;
}) {
  const [upState, upAction] = useActionState<FormState, FormData>(uploadLogo, {});
  const [rmState, rmAction] = useActionState<FormState, FormData>(removeLogo, {});

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h3>Logo</h3>
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
              background: logoUrl ? 'var(--card)' : 'var(--bg)',
              border: '1px solid var(--line)',
              fontWeight: 800,
              fontSize: 22,
              color: 'var(--muted)',
            }}
          >
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- a signed
                 storage URL that changes each load; next/image would try to
                 optimise a link that has already expired by then. */
              <img
                src={logoUrl}
                alt={`${businessName} logo`}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              initials(businessName)
            )}
          </div>

          {/* File picker on its own line, then the two actions together
              beneath it. Replace and Remove act on the same thing, so they
              belong side by side rather than at opposite ends of the card. */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <input
              form="logoUploadForm"
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
              <form id="logoUploadForm" action={upAction}>
                <input type="hidden" name="business_id" value={businessId} />
                <UploadButton hasLogo={!!logoUrl} />
              </form>

              {logoUrl && (
                <form action={rmAction}>
                  <input type="hidden" name="business_id" value={businessId} />
                  <RemoveButton />
                </form>
              )}
            </div>

            <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
              JPG, PNG, WEBP or SVG, up to 2 MB.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
