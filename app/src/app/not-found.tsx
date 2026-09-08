import Link from 'next/link';

/**
 * Shown when a page calls `notFound()`, which several business screens do when
 * a record cannot be read.
 *
 * Worth having a real screen for, because the honest cause is usually not "no
 * such business". Row-level security returns nothing for a business the signed
 * in user may not see, and an expired session reads exactly the same way from
 * here. So this offers signing in again alongside the way back, rather than
 * insisting the thing does not exist.
 */
export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <h1>We could not find that page</h1>
        <p className="sub">
          It may have moved, or you may not have access to it. If you have been
          away for a while, signing in again usually fixes it.
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          <Link className="btn navy block" href="/dashboard">
            Back to your workspace
          </Link>
          <Link className="btn ghost block" href="/sign-in">
            Sign in again
          </Link>
        </div>

        <div className="auth-foot">
          <Link href="/">Return to the home page</Link>
        </div>
      </div>
    </div>
  );
}
