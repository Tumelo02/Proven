'use client';

import { useFormStatus } from 'react-dom';
import { setOrgAccount } from '../../actions';
import type { AccountStatus } from '@/lib/database.types';

const OPTIONS: { value: AccountStatus; label: string }[] = [
  { value: 'pilot', label: 'Pilot, not yet paying' },
  { value: 'paying', label: 'Paying customer' },
  { value: 'internal', label: 'Internal, ours' },
  { value: 'lapsed', label: 'Lapsed, was paying' },
];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn sm" type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

/**
 * The organisation's commercial standing, staff-side only.
 *
 * Never rendered on the funder's own profile page: a customer should not open
 * their dashboard and read "pilot, expires in three weeks". That is a
 * conversation, not a status line.
 */
export function AccountForm({
  orgId,
  status,
  until,
  note,
}: {
  orgId: string;
  status: AccountStatus;
  until: string | null;
  note: string;
}) {
  return (
    <form action={setOrgAccount}>
      <input type="hidden" name="org_id" value={orgId} />
      <div className="txn-form">
        <div className="f">
          <label htmlFor="account_status">Standing</label>
          <select id="account_status" name="account_status" defaultValue={status}>
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="f">
          <label htmlFor="account_until">Until</label>
          <input
            id="account_until"
            name="account_until"
            type="date"
            defaultValue={until ?? ''}
          />
        </div>
        <div className="f">
          <label htmlFor="account_note">Note</label>
          <input
            id="account_note"
            name="account_note"
            type="text"
            defaultValue={note}
            placeholder="e.g. 3-month pilot agreed with Thandi"
          />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <SaveButton />
      </div>
    </form>
  );
}
