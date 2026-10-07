'use client';

import { useMemo, useState } from 'react';
import { money, monthLabel, pct } from '@proven/engine';

export interface StatementRow {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  customers: number;
  closingBalance: number | null;
  availableBalance: number | null;
}

/**
 * The report as a ledger, not as another month-by-month table.
 *
 * This reads the way a spreadsheet does, because that is what a bank, a funder
 * and an accountant are expecting when they ask for financials: months across
 * the top, the lines of the account down the side, and totals in the last
 * column. The previous version was the Month-by-month screen again with a
 * different heading, which gave a reader nothing new.
 *
 * Reading across a row answers "how has rent moved all year". Reading down a
 * column answers "what happened in June". A table of one row per month can
 * only do the second.
 *
 * Months are columns and the whole thing scrolls sideways rather than down, so
 * a year fits on one screen instead of becoming a page the reader has to swipe
 * through.
 */
export function StatementTable({
  rows,
  spending,
}: {
  rows: StatementRow[];
  /** Expense categories, each with its total per month. */
  spending: { category: string; byMonth: Record<string, number>; total: number }[];
}) {
  const [showAll, setShowAll] = useState(false);

  /* A long run of months is unreadable at full width, so the newest twelve are
     shown and the rest are one click away. */
  const visible = useMemo(
    () => (showAll || rows.length <= 12 ? rows : rows.slice(-12)),
    [rows, showAll],
  );

  const total = (pick: (r: StatementRow) => number) =>
    visible.reduce((s, r) => s + pick(r), 0);

  const revenue = total((r) => r.revenue);
  const expenses = total((r) => r.expenses);
  const profit = revenue - expenses;
  const customers = total((r) => r.customers);

  /* The newest month that actually reported a balance: a business that has not
     given one for the latest month should still see the last it did give,
     rather than a dash where its cash position ought to be. */
  const latestBalance = [...visible].reverse().find((r) => r.availableBalance !== null);

  return (
    <div className="panel stmt-panel">
      <div className="panel-head">
        <h3>Statement of income and costs</h3>
        {rows.length > 12 && (
          <button
            type="button"
            className="btn ghost sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? 'Show last 12 months' : `Show all ${rows.length} months`}
          </button>
        )}
      </div>

      <div className="stmt-scroll">
        <table className="stmt">
          <thead>
            <tr>
              <th className="stmt-line">Line</th>
              {visible.map((r) => (
                <th key={r.month} className="num">
                  {monthLabel(r.month)}
                </th>
              ))}
              <th className="num stmt-total-col">Total</th>
            </tr>
          </thead>

          <tbody>
            <tr className="stmt-group">
              <td className="stmt-line">Income</td>
              {visible.map((r) => (
                <td key={r.month} />
              ))}
              <td />
            </tr>
            <tr>
              <td className="stmt-line stmt-indent">Money in</td>
              {visible.map((r) => (
                <td key={r.month} className="num mono">
                  {money(r.revenue)}
                </td>
              ))}
              <td className="num mono stmt-total-col">
                <b>{money(revenue)}</b>
              </td>
            </tr>

            <tr className="stmt-group">
              <td className="stmt-line">Costs</td>
              {visible.map((r) => (
                <td key={r.month} />
              ))}
              <td />
            </tr>
            {spending.map((s) => (
              <tr key={s.category}>
                <td className="stmt-line stmt-indent">{s.category}</td>
                {visible.map((r) => {
                  const v = s.byMonth[r.month.slice(0, 7)] ?? 0;
                  return (
                    <td key={r.month} className="num mono">
                      {v > 0 ? money(v) : <span className="stmt-nil">–</span>}
                    </td>
                  );
                })}
                <td className="num mono stmt-total-col">{money(s.total)}</td>
              </tr>
            ))}
            <tr className="stmt-subtotal">
              <td className="stmt-line">Total costs</td>
              {visible.map((r) => (
                <td key={r.month} className="num mono">
                  {money(r.expenses)}
                </td>
              ))}
              <td className="num mono stmt-total-col">
                <b>{money(expenses)}</b>
              </td>
            </tr>

            <tr className="stmt-result">
              <td className="stmt-line">Left over</td>
              {visible.map((r) => (
                <td
                  key={r.month}
                  className="num mono"
                  style={{ color: r.profit >= 0 ? 'var(--green)' : 'var(--red)' }}
                >
                  {r.profit < 0 && '−'}
                  {money(Math.abs(r.profit))}
                </td>
              ))}
              <td
                className="num mono stmt-total-col"
                style={{ color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}
              >
                <b>
                  {profit < 0 && '−'}
                  {money(Math.abs(profit))}
                </b>
              </td>
            </tr>
            <tr>
              <td className="stmt-line stmt-indent">Margin</td>
              {visible.map((r) => (
                <td key={r.month} className="num mono">
                  {r.revenue > 0 ? pct(r.margin) : <span className="stmt-nil">–</span>}
                </td>
              ))}
              <td className="num mono stmt-total-col">
                {revenue > 0 ? pct(profit / revenue) : '–'}
              </td>
            </tr>

            {/* The cash position. Profit says how the month went; this says
                what is actually in the account, and the two come apart the
                moment a loan or a big purchase lands. */}
            <tr className="stmt-group">
              <td className="stmt-line">In the bank</td>
              {visible.map((r) => (
                <td key={r.month} />
              ))}
              <td />
            </tr>
            {/* Only the available balance. The closing balance was shown
                beside it and the two are the same in all but the occasional
                month, so the second row was a near-duplicate that pushed the
                real figure down the table. Available is also the more honest
                of the two: it is what the business could actually spend. */}
            <tr>
              <td className="stmt-line stmt-indent">Available balance</td>
              {visible.map((r) => (
                <td key={r.month} className="num mono">
                  {r.availableBalance === null ? (
                    <span className="stmt-nil">–</span>
                  ) : (
                    money(r.availableBalance)
                  )}
                </td>
              ))}
              <td className="num mono stmt-total-col">
                {latestBalance?.availableBalance != null ? (
                  <b>{money(latestBalance.availableBalance)}</b>
                ) : (
                  '–'
                )}
              </td>
            </tr>

            <tr>
              <td className="stmt-line stmt-indent">Customers</td>
              {visible.map((r) => (
                <td key={r.month} className="num mono">
                  {r.customers || <span className="stmt-nil">–</span>}
                </td>
              ))}
              <td className="num mono stmt-total-col">{customers}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
