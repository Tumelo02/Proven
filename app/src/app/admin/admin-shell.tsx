'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from '@/app/(auth)/actions';

export type AdminTab =
  | 'overview'
  | 'alerts'
  | 'health'
  | 'evidence'
  | 'insights'
  | 'organisations'
  | 'staff'
  | 'audit';

/** One badge count per tab, so the drawer carries the work, not just the names. */
export interface AdminBadges {
  alerts: number;
  evidence: number;
  health: number;
}

const NAV: { key: AdminTab; label: string; href: string; hint: string }[] = [
  { key: 'overview', label: 'Dashboard', href: '/admin', hint: 'Who is enrolled' },
  { key: 'alerts', label: 'Needs attention', href: '/admin/alerts', hint: 'What is waiting on us' },
  { key: 'health', label: 'Portfolio health', href: '/admin/health', hint: 'Doing well, and not' },
  { key: 'evidence', label: 'Evidence', href: '/admin/review', hint: 'Documents to verify' },
  { key: 'insights', label: 'Insights', href: '/admin/insights', hint: 'Growth and breakdowns' },
  {
    key: 'organisations',
    label: 'Organisations',
    href: '/admin/organisations',
    hint: 'Funders and licensees',
  },
  { key: 'audit', label: 'Audit trail', href: '/admin/audit', hint: 'Every recorded action' },
  { key: 'staff', label: 'Staff and access', href: '/admin/staff', hint: 'Who works on Proven' },
];

/**
 * The admin drawer: one navigation for every staff screen.
 *
 * Slides in and out from the left rather than sitting permanently open. The
 * admin panel is read mostly as full-width tables and charts, so a fixed
 * 236px column would cost the content real width on a laptop for a menu only
 * used between tasks. The open state is remembered per browser, so someone who
 * prefers it pinned keeps it pinned.
 *
 * Above roughly 1100px an open drawer pushes the content across instead of
 * covering it: nothing is gained by hiding a table the person is reading.
 * Below that it overlays with a scrim, since there is no room to do both.
 *
 * Everything that used to crowd the topbar lives in here. Only Sign out stays
 * outside, deliberately: it is the one control that should never be behind a
 * menu on a screen showing every organisation on the platform.
 */
export function AdminShell({
  active,
  email,
  badges,
  hide,
  title,
  subtitle,
  actions,
  children,
}: {
  active: AdminTab;
  email: string;
  badges?: Partial<AdminBadges>;
  /** Tabs this staff account may not use, hidden from the menu. */
  hide?: AdminTab[];
  title: string;
  subtitle: string;
  /** Page-specific controls, shown beside Sign out. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  /* Starts closed on the server and on the first paint, then restores the
     remembered choice. Rendering the remembered state directly would mean the
     server HTML and the first client render disagree whenever it was left
     open, which React treats as a hydration error. */
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (window.localStorage.getItem('proven.admin.drawer') === 'open') setOpen(true);
    } catch {
      /* Private browsing, or storage disabled. The drawer simply starts closed,
         which is a preference lost, not a feature lost. */
    }
  }, []);

  function toggle() {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      try {
        window.localStorage.setItem('proven.admin.drawer', next ? 'open' : 'closed');
      } catch {
        /* As above: the drawer still works, it is just not remembered. */
      }
      return next;
    });
  }

  /* Following a link on a narrow screen should not leave the drawer covering
     the page that was just opened. */
  useEffect(() => {
    if (window.matchMedia('(max-width: 1100px)').matches) setOpen(false);
  }, [pathname]);

  /* Escape closes it, which is what a drawer over content is expected to do. */
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function badgeFor(key: AdminTab): number | undefined {
    if (key === 'alerts') return badges?.alerts;
    if (key === 'evidence') return badges?.evidence;
    if (key === 'health') return badges?.health;
    return undefined;
  }

  return (
    <div className={`adm${open ? ' drawer-open' : ''}`}>
      <aside className="adm-drawer" aria-label="Admin sections" aria-hidden={!open}>
        <div className="adm-drawer-head">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
          <img src="/assets/logo_only__1_-removebg-preview.png" alt="" />
          <div>
            <div className="adm-drawer-name">Proven</div>
            <div className="adm-drawer-role">Staff panel</div>
          </div>
        </div>

        <nav className="adm-nav">
          {NAV.filter((item) => !hide?.includes(item.key)).map((item) => {
            const badge = badgeFor(item.key);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`adm-nav-item${active === item.key ? ' active' : ''}`}
                /* Not reachable by tab while closed: a keyboard user should not
                   travel through seven invisible links to reach the page. */
                tabIndex={open ? undefined : -1}
              >
                <span className="adm-nav-text">
                  <span className="adm-nav-label">{item.label}</span>
                  <span className="adm-nav-hint">{item.hint}</span>
                </span>
                {badge ? <span className="adm-nav-count">{badge}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="adm-drawer-foot">
          <Link href="/dashboard" tabIndex={open ? undefined : -1}>
            My dashboard
          </Link>
          <div className="adm-drawer-email">{email}</div>
        </div>
      </aside>

      {/* Only meaningful on narrow screens, where the drawer covers rather than
          pushes; the stylesheet hides it above that width. */}
      {open && (
        <button className="adm-scrim" type="button" aria-label="Close menu" onClick={toggle} />
      )}

      <main className="adm-main">
        <div className="topbar">
          <div className="adm-topbar-left">
            <button
              className="adm-burger"
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {open ? (
                  <>
                    <path d="M6 6l12 12" />
                    <path d="M18 6L6 18" />
                  </>
                ) : (
                  <>
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </>
                )}
              </svg>
            </button>
            <div>
              <h2>{title}</h2>
              <div className="sub">{subtitle}</div>
            </div>
          </div>

          <div className="row">
            {actions}
            {/* The only control left in the topbar, on purpose. */}
            <form action={signOut}>
              <button className="btn ghost sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="content">{children}</div>
      </main>
    </div>
  );
}
