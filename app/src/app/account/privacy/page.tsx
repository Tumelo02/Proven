import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { POLICY_VERSION } from '@/lib/policy';

export const metadata = {
  title: 'Your data · Proven',
};

const KIND_LABEL: Record<string, string> = {
  terms: 'Terms of use',
  privacy: 'Privacy notice',
  share_with_funder: 'Sharing figures with a funder',
  whatsapp: 'Monthly check-ins by WhatsApp',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Where a person exercises their POPIA rights: see what they agreed to, take a
 * copy of everything, and find out how to leave.
 *
 * Rights that exist but cannot be found are not rights, so this is a real page
 * rather than a line in the privacy notice.
 */
export default async function AccountPrivacyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  /* Read directly rather than through a helper: this is the only page that
     shows a consent history, and RLS already limits it to the caller's rows. */
  const { data: consents } = await supabase
    .from('consents')
    .select('kind, granted, policy_version, created_at')
    .order('created_at', { ascending: false });

  const rows = consents ?? [];

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 640, textAlign: 'left' }}>
        <h1>Your data</h1>
        <p className="sub">
          What Proven holds about you, and what you can do with it.
        </p>

        <section style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Get a copy</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
            Everything Proven holds about you and your businesses: your profile,
            your figures, your transactions, your documents and your funding
            links. Downloads as a single file.
          </p>
          <a className="btn block" href="/account/privacy/export">
            Download my data
          </a>
        </section>

        <section style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>What you have agreed to</h3>
          {rows.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              No consent records yet.
            </p>
          ) : (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
                  <th style={{ padding: '6px 0' }}>What</th>
                  <th style={{ padding: '6px 0' }}>Status</th>
                  <th style={{ padding: '6px 0' }}>Version</th>
                  <th style={{ padding: '6px 0' }}>When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '7px 0' }}>{KIND_LABEL[c.kind] ?? c.kind}</td>
                    <td style={{ padding: '7px 0' }}>
                      <span className={`pill ${c.granted ? 'green' : 'grey'}`}>
                        {c.granted ? 'Agreed' : 'Withdrawn'}
                      </span>
                    </td>
                    <td style={{ padding: '7px 0', color: 'var(--muted)' }}>
                      {c.policy_version}
                    </td>
                    <td style={{ padding: '7px 0', color: 'var(--muted)' }}>
                      {formatDate(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            This is a history, not a setting. Withdrawing adds a new line rather
            than erasing the old one, so what you agreed to at the time stays
            provable. Current wording: version {POLICY_VERSION}.
          </p>
        </section>

        <section style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Who can see your figures</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Only a funder you asked to link to, and only after they confirmed it.
            You can disconnect a funder from that business&apos;s page at any time.
          </p>
        </section>

        <section style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Leaving Proven</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Email us and we will close your account and erase your personal
            information. Your financial records are kept for seven years after
            your last reported figures, because that is the retention SARS and the
            Companies Act already require of them. Download a copy first.
          </p>
        </section>

        <p className="auth-foot">
          <Link href="/legal/privacy">Privacy notice</Link> ·{' '}
          <Link href="/dashboard">Back</Link>
        </p>
      </div>
    </div>
  );
}
