'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { inviteStaff, type StaffState } from './actions';
import { ROLE_LABEL, ROLE_BLURB } from './roles';
import type { StaffRole } from '@/lib/database.types';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn sm" type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Send invitation'}
    </button>
  );
}

/**
 * Invite somebody who has no Proven account yet.
 *
 * The picker beside this one can only promote an account that already exists,
 * which meant telling a new colleague to go and register on their own before
 * you could give them anything. This sends them an invitation instead: they
 * set their own password from the link, and the role chosen here is already
 * waiting when they arrive.
 *
 * Folded away until asked for, because promoting an existing account is the
 * commoner case and should stay the obvious one.
 */
export function InviteStaff() {
  const [state, formAction] = useActionState<StaffState, FormData>(inviteStaff, {});
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<StaffRole>('reviewer');

  if (!open) {
    return (
      <p className="tiny muted" style={{ margin: '10px 0 0' }}>
        Not on Proven yet?{' '}
        <button
          type="button"
          className="reset-inline"
          onClick={() => setOpen(true)}
          style={{ fontWeight: 700 }}
        >
          Invite them by email
        </button>
        .
      </p>
    );
  }

  return (
    <div className="staff-invite">
      <form action={formAction}>
        {state.error && <div className="notice error">{state.error}</div>}
        {state.message && <div className="notice ok">{state.message}</div>}

        <div className="field">
          <label htmlFor="invite-email">Their email address</label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="colleague@example.com"
          />
          <p className="hint">
            They will get a link to set their own password. Nobody here ever
            sees it.
          </p>
        </div>

        <div className="field">
          <label htmlFor="invite-role">Role when they arrive</label>
          <select
            id="invite-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
          >
            {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <p className="hint">{ROLE_BLURB[role]}</p>
        </div>

        <div className="field">
          <label htmlFor="invite-note">Note (optional)</label>
          <input
            id="invite-note"
            name="note"
            maxLength={300}
            placeholder="Why this person has access"
          />
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Submit />
          <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
