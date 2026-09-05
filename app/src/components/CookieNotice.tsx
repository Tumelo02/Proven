'use client';

import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'proven-cookie-notice-dismissed';

/**
 * A notice, not a consent gate.
 *
 * Every cookie Proven sets is the Supabase session cookie that keeps you
 * signed in — there is no analytics, advertising or tracking cookie anywhere
 * in this app. Because that cookie is strictly necessary for the service to
 * work at all, POPIA and GDPR alike do not require asking permission for it;
 * what they require is telling people it exists. So this can be dismissed and
 * never shown again, rather than blocking the page until an "Accept" button is
 * clicked for something there was never a choice about.
 *
 * localStorage rather than a cookie to remember the dismissal: using a cookie
 * to remember that someone was told about cookies is its own small joke, and
 * localStorage is one honest step further from that.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(DISMISSED_KEY)) {
        setVisible(true);
      }
    } catch {
      /* Storage blocked (private browsing, locked-down settings). Showing the
         notice every visit is the safe failure, not silently hiding it. */
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* Nothing to do: it will simply show again next visit. */
    }
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 1000,
        maxWidth: 560,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        background: 'var(--accent-soft)',
        border: '1px solid #bfe4ea',
        color: 'var(--accent-ink)',
        borderRadius: 12,
        padding: '13px 16px',
        boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.12))',
        fontSize: 13,
      }}
    >
      <span style={{ flex: '1 1 280px' }}>
        Proven uses one cookie to keep you signed in. We do not use tracking or
        advertising cookies.{' '}
        <a href="/legal/privacy#cookies" style={{ color: 'inherit', textDecoration: 'underline' }}>
          Read more
        </a>
        .
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="btn"
        style={{ flex: '0 0 auto', padding: '7px 14px', fontSize: 13 }}
      >
        Got it
      </button>
    </div>
  );
}
