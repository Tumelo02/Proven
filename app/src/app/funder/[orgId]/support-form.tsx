'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveSupportTerms, type OrgFormState } from '../actions';
import {
  SUPPORT_KIND_HAS_AMOUNT,
  SUPPORT_KIND_LABEL,
  type FundingLink,
  type SupportKind,
} from '@/lib/database.types';

const KINDS = Object.keys(SUPPORT_KIND_LABEL) as SupportKind[];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn sm" type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

/**
 * What this organisation is providing to this business.
 *
 * The amount already on the link was entered by the entrepreneur when they
 * asked. This is the organisation's own figure, and the two are shown side by
 * side rather than one overwriting the other: a gap between what a business
 * says it got and what a funder says it gave is worth seeing.
 *
 * The rand fields disappear for a mentorship or a programme place, because
 * "R0" is the wrong way to record a twelve-week programme and it makes a
 * portfolio total meaningless.
 */
export function SupportForm({
  link,
  orgId,
  businessId,
}: {
  link: FundingLink;
  orgId: string;
  businessId: string;
}) {
  const [state, formAction] = useActionState<OrgFormState, FormData>(saveSupportTerms, {});
  const [kind, setKind] = useState<SupportKind>(link.support_kind);

  const showAmounts = SUPPORT_KIND_HAS_AMOUNT[kind];
  const claimed = link.amount ? Number(link.amount) : null;
  const committed = link.committed_amount ? Number(link.committed_amount) : null;

  /* Only worth pointing out once both figures exist and actually differ. */
  const mismatch =
    claimed !== null && committed !== null && Math.abs(claimed - committed) > 0.5;

  return (
    <form action={formAction}>
      <input type="hidden" name="link_id" value={link.id} />
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="business_id" value={businessId} />

      {state.error && <div className="notice error">{state.error}</div>}
      {state.message && <div className="notice ok">{state.message}</div>}

      {mismatch && (
        <div className="notice" style={{ marginBottom: 12 }}>
          This business recorded R{claimed.toLocaleString('en-ZA')} when it asked
          to be linked, and you have recorded R{committed.toLocaleString('en-ZA')}.
          Worth a conversation, though nothing here depends on them matching.
        </div>
      )}

      <div className="txn-form">
        <div className="f">
          <label htmlFor="support_kind">What you provide</label>
          <select
            id="support_kind"
            name="support_kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as SupportKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {SUPPORT_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>

        {showAmounts && (
          <>
            <div className="f">
              <label htmlFor="committed_amount">Committed (R)</label>
              <input
                id="committed_amount"
                name="committed_amount"
                type="number"
                min={0}
                step="0.01"
                defaultValue={link.committed_amount ?? ''}
                placeholder="Not recorded"
              />
            </div>
            <div className="f">
              <label htmlFor="released_amount">Released so far (R)</label>
              <input
                id="released_amount"
                name="released_amount"
                type="number"
                min={0}
                step="0.01"
                defaultValue={link.released_amount ?? ''}
                placeholder="Not tracked"
              />
            </div>
          </>
        )}

        <div className="f">
          <label htmlFor="support_starts_on">Starts</label>
          <input
            id="support_starts_on"
            name="support_starts_on"
            type="date"
            defaultValue={link.support_starts_on ?? ''}
          />
        </div>
        <div className="f">
          <label htmlFor="support_ends_on">Ends</label>
          <input
            id="support_ends_on"
            name="support_ends_on"
            type="date"
            defaultValue={link.support_ends_on ?? ''}
          />
        </div>
      </div>

      <div className="f" style={{ marginTop: 12 }}>
        <label htmlFor="terms">Notes</label>
        <input
          id="terms"
          name="terms"
          type="text"
          defaultValue={link.terms}
          placeholder="e.g. Released in three tranches against stages"
        />
      </div>

      {!showAmounts && (
        <p className="hint" style={{ marginTop: 8 }}>
          No rand figure for this kind of support, which is recorded as such
          rather than as zero.
        </p>
      )}

      <div style={{ marginTop: 12 }}>
        <SaveButton />
      </div>
    </form>
  );
}
