import Link from 'next/link';
import { getMyBusinesses } from '@/lib/queries';
import { signOut } from '@/app/(auth)/actions';
import { BusinessPicker } from './business-picker';

export type EntTab =
  | 'overview'
  | 'transactions'
  | 'milestones'
  | 'guidance'
  | 'history'
  | 'profile';

/**
 * The entrepreneur workspace shell.
 *
 * Nav labels are deliberately plain: "Stages" rather than "Milestones", "What
 * to do next" rather than "Recommendations". The point of the product is that
 * a person running a spaza shop can read it.
 */
export async function EntrepreneurShell({
  businessId,
  active,
  showSwitchRole,
  guidanceCount,
  guidanceAlarm,
  children,
}: {
  businessId: string;
  active: EntTab;
  showSwitchRole: boolean;
  guidanceCount?: number;
  guidanceAlarm?: boolean;
  children: React.ReactNode;
}) {
  const businesses = await getMyBusinesses();
  const current = businesses.find((b) => b.id === businessId);

  const nav: { key: EntTab; label: string; href: string }[] = [
    { key: 'overview', label: 'Overview', href: `/business/${businessId}` },
    { key: 'transactions', label: 'Transactions', href: `/business/${businessId}/transactions` },
    { key: 'milestones', label: 'Stages', href: `/business/${businessId}/milestones` },
    { key: 'guidance', label: 'What to do next', href: `/business/${businessId}/guidance` },
    { key: 'history', label: 'Month by month', href: `/business/${businessId}/history` },
    { key: 'profile', label: 'Business profile', href: `/business/${businessId}/profile` },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand mark */}
            {/* Sized and haloed by `.brand .mark` in globals.css, so the glow
                is not lost to an inline style overriding it. */}
            <img className="mark" src="/assets/logo_only__1_-removebg-preview.png" alt="" />
            <h1>Proven</h1>
          </div>
          <div className="role-badge">Entrepreneur view</div>

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

        {/* Which business is being viewed. Only shown when there is a choice
            to make: a single business does not need a picker. */}
        {businesses.length > 1 && (
          <BusinessPicker businesses={businesses} currentId={businessId} />
        )}

        <nav className="nav">
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`nav-item${active === item.key ? ' active' : ''}`}
            >
              <span>{item.label}</span>
              {/* Only flag red when there is a real problem to act on: a
                  healthy business still gets one "keep going" note, which
                  should not look like an alert. */}
              {item.key === 'guidance' && guidanceCount ? (
                <span className={`nav-count${guidanceAlarm ? ' alarm' : ''}`}>
                  {guidanceCount}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          Proven
          <br />
          Track &middot; Detect &middot; Guide &middot; Prove
          {/* Most entrepreneurs are redirected straight here and never see the
              dashboard, so the POPIA rights have to be reachable from inside
              the workspace as well. */}
          <Link className="reset-inline" href="/account/privacy">
            Your data and privacy
          </Link>
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
            <h2>{current?.name ?? 'Business'}</h2>
            <div className="sub">
              {[current?.industry, current?.region].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>

        <div className="content">{children}</div>
      </main>
    </div>
  );
}
