'use client';

/**
 * The catch-all for anything that throws while rendering a page.
 *
 * Without this file, an unhandled error in a Server Component renders nothing
 * at all in production: no message, no navigation, just a white screen with no
 * way out. That is precisely how a returning entrepreneur got stranded — one
 * crash on a page, and the whole platform looked broken and unreachable.
 *
 * So the point of this screen is not to explain the fault, it is to keep the
 * person moving. Every route out of here is a real one: back to their
 * workspace, or signing out and in again.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  /* Next 16 names this `retry`; it was `reset` in earlier versions. */
  retry: () => void;
}) {
  useEffect(() => {
    /* The digest is the only handle on the real error: Server Component
       messages are replaced with a generic string before reaching the browser,
       deliberately, so nothing sensitive leaks. The digest matches it back to
       the server log. */
    console.error('[proven] page failed to render', error.digest ?? '', error);
  }, [error]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <h1>Something went wrong</h1>
        <p className="sub">
          The page could not be loaded. Nothing you have reported has been lost.
        </p>

        <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
          <button className="btn navy block" type="button" onClick={() => retry()}>
            Try again
          </button>
          <Link className="btn ghost block" href="/dashboard">
            Back to your workspace
          </Link>
        </div>

        {error.digest && (
          <p className="tiny muted" style={{ marginTop: 14, textAlign: 'center' }}>
            If you report this, quote reference <code>{error.digest}</code>.
          </p>
        )}

        <div className="auth-foot">
          <Link href="/sign-in">Sign in again</Link>
        </div>
      </div>
    </div>
  );
}
