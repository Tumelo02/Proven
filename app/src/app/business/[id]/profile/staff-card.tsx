'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveStaffCount, type FormState } from './actions';
import type { StaffCount } from '@/lib/database.types';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn sm" type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save headcount'}
    </button>
  );
}

function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Headcount month by month.
 *
 * A single staff number captured at enrolment can only say how many people
 * work there today. Job creation is a difference between two dates, which is
 * the number a development funder reports upward, so it is recorded per month
 * and lines up with the reporting periods.
 */
export function StaffCard({
  businessId,
  staffCounts,
}: {
  businessId: string;
  staffCounts: StaffCount[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveStaffCount, {});

  const rows = [...staffCounts].reverse();
  const latest = staffCounts[staffCounts.length - 1];
  const first = staffCounts[0];

  const total = (s: StaffCount) => s.full_time + s.part_time + s.casual;
  const created = latest && first ? total(latest) - total(first) : 0;

  const thisMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h3>Jobs, month by month</h3>
        {staffCounts.length > 1 && (
          <span className="hint" style={{ marginLeft: 'auto' }}>
            {created > 0 ? `+${created}` : created} since {monthLabel(first!.period_month)}
          </span>
        )}
      </div>
      <div className="panel-body">
        {state.error && <div className="notice error">{state.error}</div>}
        {state.message && <div className="notice ok">{state.message}</div>}


        {rows.length > 0 && (
          <div className="table-wrap" style={{ marginBottom: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Full time</th>
                  <th>Part time</th>
                  <th>Casual</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>{monthLabel(s.period_month)}</td>
                    <td className="mono">{s.full_time}</td>
                    <td className="mono">{s.part_time}</td>
                    <td className="mono">{s.casual}</td>
                    <td className="mono">
                      <b>{total(s)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form action={formAction}>
          <input type="hidden" name="business_id" value={businessId} />
          <div className="txn-form">
            <div className="f">
              <label htmlFor="period_month">Month</label>
              <input
                id="period_month"
                name="period_month"
                type="month"
                defaultValue={thisMonth}
                required
              />
            </div>
            <div className="f">
              <label htmlFor="full_time">Full time</label>
              <input
                id="full_time"
                name="full_time"
                type="number"
                min={0}
                defaultValue={latest?.full_time ?? 0}
              />
            </div>
            <div className="f">
              <label htmlFor="part_time">Part time</label>
              <input
                id="part_time"
                name="part_time"
                type="number"
                min={0}
                defaultValue={latest?.part_time ?? 0}
              />
            </div>
            <div className="f">
              <label htmlFor="casual">Casual</label>
              <input
                id="casual"
                name="casual"
                type="number"
                min={0}
                defaultValue={latest?.casual ?? 0}
              />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <SaveButton />
          </div>
        </form>
      </div>
    </div>
  );
}
