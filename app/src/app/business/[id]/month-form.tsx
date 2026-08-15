'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveMonth, type FormState } from '@/app/businesses/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn block" type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save figures'}
    </button>
  );
}

/** Defaults to last month: the month a business is usually reporting on. */
function lastMonth(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

export function MonthForm({ businessId }: { businessId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveMonth, {});

  return (
    <form action={formAction}>
      {state.error && <div className="notice error">{state.error}</div>}
      {state.message && <div className="notice ok">{state.message}</div>}

      <input type="hidden" name="business_id" value={businessId} />

      <div className="field">
        <label htmlFor="period_month">Which month?</label>
        <input
          id="period_month"
          name="period_month"
          type="month"
          defaultValue={lastMonth()}
          required
        />
        <p className="hint">
          Sending the same month again corrects it, it does not add a second entry.
        </p>
      </div>

      <div className="field">
        <label htmlFor="revenue">Money in</label>
        <input id="revenue" name="revenue" type="number" min={0} step="0.01" required />
        <p className="hint">Everything the business earned that month.</p>
      </div>

      <div className="field">
        <label htmlFor="expenses">Money out</label>
        <input id="expenses" name="expenses" type="number" min={0} step="0.01" required />
        <p className="hint">Everything it spent: stock, wages, rent, transport.</p>
      </div>

      <div className="field">
        <label htmlFor="customers">How many customers?</label>
        <input id="customers" name="customers" type="number" min={0} defaultValue={0} />
      </div>

      <input type="hidden" name="status" value="on-time" />

      <SubmitButton />
    </form>
  );
}
