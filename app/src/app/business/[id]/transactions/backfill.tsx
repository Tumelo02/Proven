'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { monthLabel } from '@proven/engine';
import { backfillMonths, type FormState } from '@/app/businesses/actions';

function SaveButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending || count === 0}>
      {pending ? 'Saving…' : `Save ${count} month${count === 1 ? '' : 's'}`}
    </button>
  );
}

/** Every month from `from` to `to`, inclusive, as `YYYY-MM`. */
function monthsBetween(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const out: string[] = [];
  const cursor = new Date(`${from}-01T00:00:00Z`);
  const end = new Date(`${to}-01T00:00:00Z`);
  while (cursor <= end && out.length <= 60) {
    out.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

/**
 * Catching up on months that happened before joining Proven.
 *
 * A business arrives having traded for a year or two, and until now had no way
 * to say so: the figures form took one month at a time, which meant a year of
 * history was twelve separate errands. Most people did none of them, which is
 * why so many records here start at a single month.
 *
 * Pick the range, fill in what you have, save once. Months left blank are
 * skipped rather than stored as zero, because "I have no figures for March" and
 * "March was a month of no trading" are different claims and the record should
 * not confuse them.
 */
export function BackfillHistory({
  businessId,
  existing,
}: {
  businessId: string;
  /** Months already on file, so a row can say it will be overwritten. */
  existing: string[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(backfillMonths, {});
  const [open, setOpen] = useState(false);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const aYearAgo = (() => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 11);
    return d.toISOString().slice(0, 7);
  })();

  const [from, setFrom] = useState(aYearAgo);
  const [to, setTo] = useState(thisMonth);
  /* Which months the person has actually typed into, so the button can say how
     many will be saved rather than promising the whole range. */
  const [filled, setFilled] = useState<Record<string, boolean>>({});

  const months = useMemo(() => monthsBetween(from, to), [from, to]);
  const onFile = useMemo(() => new Set(existing.map((m) => m.slice(0, 7))), [existing]);
  const count = months.filter((m) => filled[m]).length;

  if (!open) {
    return (
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-body backfill-invite">
          <div>
            <b>Traded before joining Proven?</b>
            <div className="tiny muted" style={{ marginTop: 2 }}>
              Add the months you already have. The longer the record, the
              stronger it is — and past months count the same as new ones.
            </div>
          </div>
          <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
            Add past months
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h3>Add past months</h3>
        <span className="hint" style={{ marginLeft: 'auto' }}>
          Fill in what you have; leave the rest blank
        </span>
      </div>

      <form action={formAction}>
        <input type="hidden" name="business_id" value={businessId} />

        <div className="panel-body">
          {state.error && <div className="notice error">{state.error}</div>}
          {state.message && <div className="notice ok">{state.message}</div>}

          <div className="backfill-range">
            <label className="f">
              <span>From</span>
              <input
                name="from_month"
                type="month"
                value={from}
                max={thisMonth}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </label>
            <label className="f">
              <span>To</span>
              <input
                name="to_month"
                type="month"
                value={to}
                max={thisMonth}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </label>
            <span className="tiny muted">
              {months.length} month{months.length === 1 ? '' : 's'} in this range
            </span>
          </div>
        </div>

        {months.length === 0 ? (
          <div className="panel-body">
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              The first month must come before the last.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">Money in (R)</th>
                  <th className="num">Money out (R)</th>
                  <th className="num">Customers</th>
                  <th className="num">In the bank (R)</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m}>
                    <td>
                      <b>{monthLabel(`${m}-01`)}</b>
                      {onFile.has(m) && (
                        <div className="tiny muted">Already on file — this replaces it</div>
                      )}
                    </td>
                    <td className="num">
                      <input
                        name={`revenue_${m}`}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0"
                        className="backfill-input"
                        onChange={(e) =>
                          setFilled((f) => ({ ...f, [m]: e.target.value.trim() !== '' || !!f[m] }))
                        }
                      />
                    </td>
                    <td className="num">
                      <input
                        name={`expenses_${m}`}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0"
                        className="backfill-input"
                        onChange={(e) =>
                          setFilled((f) => ({ ...f, [m]: e.target.value.trim() !== '' || !!f[m] }))
                        }
                      />
                    </td>
                    <td className="num">
                      <input
                        name={`customers_${m}`}
                        type="number"
                        min={0}
                        placeholder="0"
                        className="backfill-input"
                      />
                    </td>
                    {/* Optional, and left blank rather than zeroed when there
                        is no statement to hand: "I do not know" and "the
                        account was empty" are different answers. */}
                    <td className="num">
                      <input
                        name={`balance_${m}`}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="optional"
                        className="backfill-input"
                        onChange={(e) =>
                          setFilled((f) => ({ ...f, [m]: e.target.value.trim() !== '' || !!f[m] }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="panel-body row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <SaveButton count={count} />
          <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <span className="tiny muted">
            Saved as late, because they are being reported after the fact — a
            funder reads that, so it should be honest.
          </span>
        </div>
      </form>
    </div>
  );
}
