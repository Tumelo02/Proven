'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitMonth, type FormState } from '@/app/businesses/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Submit update'}
    </button>
  );
}

/**
 * The monthly check-in.
 *
 * Deliberately does NOT ask for revenue and expenses: those are the sum of the
 * transactions already logged, shown in the draft summary above. Asking a
 * person to total their own entries invites a figure that disagrees with them.
 */
export function SubmitMonthForm({
  businessId,
  monthValue,
  customers,
}: {
  businessId: string;
  /** `YYYY-MM`, the month this check-in covers. */
  monthValue: string;
  /** Last known customer count, as a starting point rather than a blank box. */
  customers: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(submitMonth, {});

  return (
    <>
      {state.error && <div className="notice error">{state.error}</div>}
      {state.message && <div className="notice ok">{state.message}</div>}

      <form action={formAction}>
        <input type="hidden" name="business_id" value={businessId} />
        <input type="hidden" name="period_month" value={monthValue} />

        <div className="txn-form" style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }}>
          <div className="f">
            <label htmlFor="customers">Customers this period</label>
            <input
              id="customers"
              name="customers"
              type="number"
              min={0}
              defaultValue={customers}
            />
          </div>

          <div className="f">
            <label htmlFor="stage_update">Stage update</label>
            <select id="stage_update" name="stage_update" defaultValue="unchanged">
              <option value="unchanged">No change</option>
              <option value="complete">Finished this stage</option>
              <option value="delayed">Running late on this stage</option>
            </select>
          </div>

          <div className="f">
            <label htmlFor="note">Short status update</label>
            <input
              id="note"
              name="note"
              type="text"
              placeholder="What happened this month?"
            />
          </div>

          <SubmitButton />
        </div>
      </form>

      {/* The deck describes WhatsApp as the entrepreneur's real check-in
          channel. Naming it here keeps the product honest about what this
          form stands in for. */}
      <div className="wa-note">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.4-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.6 0a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.2a.4.4 0 0 0 0-.4c0-.1-.6-1.4-.8-1.9s-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.1.7a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z" />
        </svg>
        <span>
          Sending on time counts for a fifth of your score.
        </span>
      </div>
    </>
  );
}
