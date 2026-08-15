import { notFound } from 'next/navigation';
import {
  evidenceCoverage,
  fmtDate,
  money,
  reportingStatus,
} from '@proven/engine';
import {
  getBusinessShell,
  getMyOrganisations,
  getScoredBusiness,
  getTransactionsWithDocs,
} from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { REJECT_REASONS } from '@/lib/database.types';
import { EntrepreneurShell } from '../shell';
import { Panel } from '@/components/workspace';
import { TransactionForm } from './transaction-form';
import { SubmitMonthForm } from './submit-month';
import { AttachProof } from './attach-proof';
import '../../../workspace.css';

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [shell, orgs, scored, entries] = await Promise.all([
    getBusinessShell(id),
    getMyOrganisations(),
    getScoredBusiness(id),
    getTransactionsWithDocs(id),
  ]);
  if (!shell) notFound();

  const cov = evidenceCoverage(
    entries.map((e) => ({
      amount: Number(e.transaction.amount),
      hasDocument: e.document !== null,
    })),
  );

  const covTone =
    cov.pct >= 70 ? 'var(--green)' : cov.pct >= 40 ? 'var(--yellow)' : 'var(--red)';

  const rep = scored ? reportingStatus(scored.input) : null;

  /* The month this check-in covers: the one the deadline is for, which is last
     month, not whatever the newest row on file happens to be. */
  const now = new Date();
  const coverMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const draftMonth = coverMonth.toISOString().slice(0, 7);

  /* Everything logged in that month but not yet turned into a finished one. */
  const draft = entries
    .filter((e) => e.transaction.occurred_on.slice(0, 7) === draftMonth)
    .reduce(
      (acc, e) => {
        const amt = Number(e.transaction.amount) || 0;
        if (e.transaction.type === 'revenue') acc.revenue += amt;
        else acc.expenses += amt;
        acc.left = acc.revenue - acc.expenses;
        return acc;
      },
      { revenue: 0, expenses: 0, left: 0 },
    );

  const lastCustomers =
    scored?.input.history[scored.input.history.length - 1]?.customers ?? 0;

  /* Short-lived links for whatever is already attached. Signed rather than
     public: a receipt is a private business record, and a public URL would
     stay readable by anyone who ever saw the path. */
  const signed = new Map<string, string>();
  const attached = entries.filter((e) => e.document);
  if (attached.length) {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from('proofs')
      .createSignedUrls(
        attached.map((e) => e.document!.storage_path),
        60 * 5,
      );
    for (const row of data ?? []) {
      if (row.signedUrl && row.path) signed.set(row.path, row.signedUrl);
    }
  }

  const monthShort = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', {
      month: 'short',
      timeZone: 'UTC',
    });

  return (
    <EntrepreneurShell
      businessId={id}
      active="transactions"
      showSwitchRole={orgs.length > 0}
      {...(scored
        ? {
            guidanceCount: scored.guidance.length,
            guidanceAlarm: scored.guidance.some((g) => g.sev === 'red' || g.sev === 'yellow'),
          }
        : {})}
    >
      {/* How much of what has been logged has a document behind it. */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-body">
          <div className="cov-head">
            <div>
              <div className="cov-title">Evidence coverage</div>
              <div className="tiny muted">
                {money(cov.backed)} of {money(cov.total)} backed by a document &middot;{' '}
                {cov.withProof} of {cov.count} entries
              </div>
            </div>
            <div className="cov-pct" style={{ color: covTone }}>
              {cov.pct}%
            </div>
          </div>
          <div className="cov-bar">
            <span style={{ width: `${cov.pct}%`, background: covTone }} />
          </div>
          <div className="cov-note">
            The share of what you log that has a document behind it.
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Panel title="Add a transaction" hint="Builds this month's numbers below">
          <TransactionForm businessId={id} />
        </Panel>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Panel
          title="Send this month's numbers"
          {...(rep ? { hint: `Due ${fmtDate(rep.due)} · ${rep.label}` } : {})}
        >
          {/* Only once there is something in it: three zeros on arrival
              explain nothing and sit in the wrong panel. */}
          {(draft.revenue > 0 || draft.expenses > 0) && (
            <div className="draft-summary">
              {/* Spending money is not a problem, it is how a business runs, so
                  "money out" is not painted red for existing. Only a month that
                  ended short is coloured, because that is the one figure here
                  that asks the owner to do something. */}
              <div className="d">
                <div className="l">Money in this month</div>
                <div className="v">{money(draft.revenue)}</div>
              </div>
              <div className="d">
                <div className="l">Money out this month</div>
                <div className="v">{money(draft.expenses)}</div>
              </div>
              <div className="d">
                <div className="l">Left over</div>
                <div
                  className="v"
                  {...(draft.left < 0 ? { style: { color: 'var(--red)' } } : {})}
                >
                  {draft.left < 0 ? '−' : ''}
                  {money(Math.abs(draft.left))}
                </div>
              </div>
              <div className="draft-hint">
                From the transactions you have added.
              </div>
            </div>
          )}

          <SubmitMonthForm
            businessId={id}
            monthValue={draftMonth}
            customers={lastCustomers}
          />
        </Panel>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Recent transactions</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            Attach a document to any entry
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="panel-body">
            <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
              No entries yet. Add what you earned and spent, so your advice can
              point at real costs.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Proof</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(({ transaction: t, document: doc }) => {
                  return (
                    <tr key={t.id}>
                      <td>
                        {monthShort(t.occurred_on)}
                        <div className="tiny muted">{fmtDate(t.occurred_on)}</div>
                      </td>
                      <td>{t.description}</td>
                      <td className="muted">{t.category || '—'}</td>
                      <td
                        className="mono"
                        style={{ color: t.type === 'revenue' ? 'var(--green)' : 'var(--ink)' }}
                      >
                        {t.type === 'revenue' ? '+' : '−'}
                        {money(Number(t.amount))}
                      </td>
                      <td>
                        <AttachProof
                          transactionId={t.id}
                          businessId={id}
                          document={doc}
                          viewUrl={doc ? (signed.get(doc.storage_path) ?? null) : null}
                        />
                      </td>
                      {/* Review state in its own column: whether a document
                          exists and whether anyone has checked it are two
                          different facts. */}
                      <td>
                        {doc ? (
                          <div>
                            <span
                              className={`rev-pill ${
                                doc.review_status === 'verified'
                                  ? 'ok'
                                  : doc.review_status === 'rejected'
                                    ? 'no'
                                    : 'wait'
                              }`}
                              title={
                                doc.review_status === 'verified'
                                  ? 'Proven has checked this document against the entry'
                                  : doc.review_status === 'rejected'
                                    ? 'Attach a different document to fix this'
                                    : 'Waiting for Proven to check it'
                              }
                            >
                              {doc.review_status === 'verified'
                                ? 'Verified'
                                : doc.review_status === 'rejected'
                                  ? 'Not accepted'
                                  : 'Pending review'}
                            </span>

                            {/* Say what to fix, beside the Replace control that
                                fixes it. A rejection with no reason is a flag,
                                not guidance. */}
                            {doc.review_status === 'rejected' && doc.reject_reason && (
                              <div
                                className="tiny"
                                style={{ marginTop: 5, maxWidth: 260, color: 'var(--red)' }}
                              >
                                {REJECT_REASONS[doc.reject_reason].toBusiness}
                                {doc.reject_note && (
                                  <div style={{ color: 'var(--muted)', marginTop: 3 }}>
                                    Note: {doc.reject_note}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="rev-none">No document</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </EntrepreneurShell>
  );
}
