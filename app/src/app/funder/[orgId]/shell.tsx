import Link from 'next/link';
import { getLogoUrl, getMyBusinesses, getMyOrganisations } from '@/lib/queries';
import { signOut } from '@/app/(auth)/actions';

export type FunderTab = 'portfolio' | 'attention' | 'requests' | 'profile';

/**
 * The funder workspace shell.
 *
 * "Needs attention" carries a count that turns red only when there is
 * something flagged: a portfolio where everything is healthy should look
 * settled rather than like an alert nobody has cleared.
 */
export async function FunderShell({
  orgId,
  orgName,
  active,
  title,
  sub,
  attentionCount,
  requestCount,
  children,
}: {
  orgId: string;
  orgName: string;
  active: FunderTab;
  title: string;
  sub?: string;
  attentionCount: number;
  requestCount: number;
  children: React.ReactNode;
}) {
  const [businesses, orgs] = await Promise.all([getMyBusinesses(), getMyOrganisations()]);

  /* Read here rather than passed in, so every funder page shows the mark
     without each one having to remember to fetch it. */
  const orgLogoUrl = await getLogoUrl(
    orgs.find((o) => o.org.id === orgId)?.org.logo_path ?? null,
  );
  /* Only worth offering when the person actually holds another role. */
  const showSwitchRole = businesses.length > 0 || orgs.length > 1;

  const nav: { key: FunderTab; label: string; href: string; count?: number; alarm?: boolean }[] =
    [
      { key: 'portfolio', label: 'Portfolio', href: `/funder/${orgId}` },
      {
        key: 'attention',
        label: 'Needs attention',
        href: `/funder/${orgId}/attention`,
        count: attentionCount,
        alarm: attentionCount > 0,
      },
      {
        key: 'requests',
        label: 'Requests',
        href: `/funder/${orgId}/requests`,
        count: requestCount,
      },
      { key: 'profile', label: 'Organisation profile', href: `/funder/${orgId}/profile` },
    ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
            <img className="mark" src="/assets/logo_only__1_-removebg-preview.png" alt="" />
            <h1>Proven</h1>
          </div>
          <div className="role-badge">Funder view</div>

          {showSwitchRole && (
            <div className="switch-role">
              <Link href="/dashboard" title="Switch between your businesses and portfolios">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                  style={{ width: 13, height: 13, flex: '0 0 auto' }}>
                  <path d="M19 12H5" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>
                Switch role
              </Link>
            </div>
          )}
        </div>

        <div className="biz-picker">
          <label>Viewing</label>
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
            }}
          >
            {/* The funder's own mark, so the workspace reads as theirs. */}
            {orgLogoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element -- signed URL */
              <img
                src={orgLogoUrl}
                alt=""
                style={{
                  width: 26,
                  height: 26,
                  flex: '0 0 26px',
                  objectFit: 'contain',
                  background: '#fff',
                  borderRadius: 6,
                  padding: 2,
                }}
              />
            )}
            <div
              style={{
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 700,
                lineHeight: 1.35,
              }}
            >
              {orgName}
            </div>
          </div>
        </div>

        <nav className="nav">
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`nav-item${active === item.key ? ' active' : ''}`}
            >
              <span>{item.label}</span>
              {item.count ? (
                <span className={`nav-count${item.alarm ? ' alarm' : ''}`}>{item.count}</span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          Proven
          <br />
          Track &middot; Detect &middot; Guide &middot; Prove
          <form action={signOut}>
            <button className="reset-inline" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h2>{title}</h2>
            <div className="sub">{sub}</div>
          </div>
        </div>

        <div className="content">{children}</div>
      </main>
    </div>
  );
}
