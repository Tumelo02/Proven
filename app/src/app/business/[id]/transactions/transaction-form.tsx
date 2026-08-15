'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addTransaction, type FormState } from '@/app/businesses/actions';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf';

/** A fixed list, so exported figures stay comparable across businesses. */
const CATEGORIES = [
  'Sales',
  'Stock & Inventory',
  'Rent',
  'Wages',
  'Transport',
  'Marketing',
  'Utilities',
  'Other',
];

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? 'Adding…' : 'Add'}
    </button>
  );
}

/**
 * One horizontal row.
 *
 * Logging a cost should take a few seconds, so the fields sit on a single line
 * rather than as a column the person has to scroll through.
 */
export function TransactionForm({ businessId }: { businessId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(addTransaction, {});
  const today = new Date().toISOString().slice(0, 10);
  /* Named so the person can see which file they picked before submitting. */
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <>
      {state.error && <div className="notice error">{state.error}</div>}
      {state.message && <div className="notice ok">{state.message}</div>}

      <form action={formAction}>
        <input type="hidden" name="business_id" value={businessId} />
        <input type="hidden" name="occurred_on" value={today} />

        <div className="txn-form">
          <div className="f">
            <label htmlFor="description">Description</label>
            <input
              id="description"
              name="description"
              type="text"
              placeholder="e.g. Weekly stock order"
              required
            />
          </div>

          <div className="f">
            <label htmlFor="type">Type</label>
            <select id="type" name="type" defaultValue="revenue">
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
          </div>

          <div className="f">
            <label htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue="Sales">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="f">
            <label htmlFor="amount">Amount (R)</label>
            <input
              id="amount"
              name="amount"
              type="number"
              min={0.01}
              step="0.01"
              placeholder="0"
              required
            />
          </div>

          <AddButton />
        </div>

        {/* Inside the form, so the file posts with the entry and the two
            arrive together rather than as two separate errands. */}
        <div className="txn-proof">
          <label className={`proof-pick${fileName ? ' ready' : ''}`}>
            <input
              type="file"
              name="file"
              accept={ACCEPT}
              hidden
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4" />
              <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
              <path d="M4 16v3.2h16V16" />
            </svg>
            {fileName ?? 'Attach receipt or invoice'}
          </label>
          <span className="tiny muted">
            Optional, you can also attach it later from the table below.
          </span>
        </div>
      </form>
    </>
  );
}
