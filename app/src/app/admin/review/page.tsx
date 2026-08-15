import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fmtDate, money } from '@proven/engine';
import { getCurrentProfile, getReviewQueue } from '@/lib/queries';
import { ReviewDecision } from './decision';
import { REJECT_REASONS } from '@/lib/database.types';
import { signOut } from '@/app/(auth)/actions';
import '../../workspace.css';

/**
 * The evidence review queue.
 *
 * The question is not "is this a real receipt" but "does this receipt match
 * what was logged", so each row shows the document beside the transaction it
 * claims to evidence: the description, the amount, the date and the business.
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile?.is_platform_admin) notFound();

  const { status } = await searchParams;
  const filter =
    status === 'verified' ? 'verified' : status === 'rejected' ? 'rejected' : 'pending';

  const items = await getReviewQueue(filter);

  return (
    <div className="app">
      <main className="main">
        <div className="topbar">
          <div className="admin-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
            <img src="/assets/logo_only__1_-removebg-preview.png" alt="" />
            <div>
              <Link href="/admin" style={{ fontSize: 12, textDecoration: 'none' }}>
                ← Back to admin
              </Link>
              <h2 style={{ marginTop: 2 }}>Evidence review</h2>
              <div className="sub">
                Proven checks whether a document matches what was logged.
                Neither the business nor its funder can do this.
              </div>
            </div>
          </div>
          <form action={signOut}>
            <button className="btn ghost sm" type="submit">
              Sign out
            </button>
          </form>
        </div>

        <div className="content">
          <div className="toolbar" style={{ marginBottom: 14 }}>
            <div className="seg">
              {(
                [
                  ['pending', 'Waiting'],
                  ['verified', 'Verified'],
                  ['rejected', 'Rejected'],
                ] as const
              ).map(([key, label]) => (
                <Link
                  key={key}
                  href={`/admin/review?status=${key}`}
                  className={filter === key ? 'on' : ''}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 6,
                    fontWeight: 650,
                    fontSize: 12,
                    textDecoration: 'none',
                    background: filter === key ? 'var(--navy)' : 'transparent',
                    color: filter === key ? '#fff' : 'var(--muted)',
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="panel">
              <div className="panel-body">
                <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
                  {filter === 'pending'
                    ? 'Nothing waiting. Every uploaded document has been checked.'
                    : `No ${filter} documents.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-head">
                <h3>
                  {filter === 'pending'
                    ? `${items.length} waiting`
                    : `${items.length} ${filter}`}
                </h3>
                <span className="hint" style={{ marginLeft: 'auto' }}>
                  Oldest first
                </span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>What was logged</th>
                      <th className="num">Amount</th>
                      <th>Date</th>
                      <th>Document</th>
                      {/* Wide enough for both buttons side by side, and for the
                          reason fields once "Reject" is pressed. */}
                      <th style={{ minWidth: 260 }}>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(({ document: doc, transaction: t, business, url }) => (
                      <tr key={doc.id}>
                        <td>
                          <strong>{business.name}</strong>
                          <div className="tiny muted">{business.region || business.industry}</div>
                        </td>
                        <td>
                          {t.description}
                          <div className="tiny muted">{t.category}</div>
                        </td>
                        <td
                          className="num mono"
                          style={{ color: t.type === 'revenue' ? 'var(--green)' : 'var(--ink)' }}
                        >
                          {t.type === 'revenue' ? '+' : '−'}
                          {money(Number(t.amount))}
                        </td>
                        <td className="tiny muted">{fmtDate(t.occurred_on)}</td>
                        <td>
                          {url ? (
                            <a
                              className="proof-chip has"
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={doc.file_name}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v10" />
                                <path d="m7.5 11 4.5 4.5 4.5-4.5" />
                                <path d="M4 18h16" />
                              </svg>
                              Open
                            </a>
                          ) : (
                            <span className="rev-none">Unavailable</span>
                          )}
                          <div className="tiny muted" style={{ marginTop: 3 }}>
                            {(doc.size_bytes / 1024).toFixed(0)} KB
                          </div>
                        </td>
                        <td>
                          {doc.review_status === 'pending' ? (
                            <ReviewDecision documentId={doc.id} />
                          ) : (
                            <div>
                              <span
                                className={`rev-pill ${doc.review_status === 'verified' ? 'ok' : 'no'}`}
                              >
                                {doc.review_status === 'verified' ? 'Verified' : 'Rejected'}
                              </span>
                              {doc.reject_reason && (
                                <div className="tiny muted" style={{ marginTop: 4, maxWidth: 200 }}>
                                  {REJECT_REASONS[doc.reject_reason].label}
                                  {doc.reject_note && <> &middot; {doc.reject_note}</>}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="tiny muted" style={{ marginTop: 16 }}>
            Verifying records that a document exists and matches the entry beside
            it. It is not an audit of the business, and it does not certify that
            the underlying trade took place. Every decision is written to the
            audit log with who made it.
          </p>
        </div>
      </main>
    </div>
  );
}
