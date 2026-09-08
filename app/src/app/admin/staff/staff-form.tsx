'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveStaffRole, removeStaff, type StaffState } from './actions';
import type { StaffRole } from '@/lib/database.types';
import { ROLE_LABEL, ROLE_BLURB, CAPABILITIES } from './roles';

function Submit({ label, pending: labelPending }: { label: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn sm" type="submit" disabled={pending}>
      {pending ? labelPending : label}
    </button>
  );
}

/**
 * Give an account staff access, or change what an existing one may do.
 *
 * The capability checkboxes start hidden behind "use the role's defaults",
 * because the common case is picking a role and moving on. Unticking that
 * reveals them for the case a role nearly fits.
 *
 * Note there is no checkbox for managing staff. That is the owner role and
 * nothing else, deliberately: it is the one capability that could be used to
 * remove the limits it was granted under, so it is not something a limited
 * admin can be handed piecemeal.
 */
export function StaffRoleForm({
  userId,
  email,
  currentRole,
  currentCapabilities,
  currentNote,
  isSelf,
  onDone,
}: {
  userId: string;
  email: string;
  currentRole?: StaffRole;
  currentCapabilities?: Record<string, boolean>;
  currentNote?: string;
  isSelf?: boolean;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState<StaffState, FormData>(saveStaffRole, {});
  const [role, setRole] = useState<StaffRole>(currentRole ?? 'reviewer');
  const [useDefaults, setUseDefaults] = useState(!currentRole);

  return (
    <form action={formAction} className="staff-form">
      {state.error && <div className="notice error">{state.error}</div>}
      {state.message && <div className="notice ok">{state.message}</div>}

      <input type="hidden" name="user_id" value={userId} />

      <div className="staff-form-who">
        <b>{email}</b>
      </div>

      {isSelf && (
        <div className="notice info">
          This is your own account. Another owner has to change your role, so
          that nobody can lock themselves out or quietly widen their own access.
        </div>
      )}

      <div className="field">
        <label htmlFor={`role-${userId}`}>Role</label>
        <select
          id={`role-${userId}`}
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
          disabled={isSelf}
        >
          {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <p className="hint">{ROLE_BLURB[role]}</p>
      </div>

      <label className="staff-check">
        <input
          type="checkbox"
          name="use_defaults"
          checked={useDefaults}
          onChange={(e) => setUseDefaults(e.target.checked)}
          disabled={isSelf}
        />
        <span>
          Use what this role normally has
          <span className="tiny muted"> — untick to choose each one</span>
        </span>
      </label>

      {!useDefaults && (
        <div className="staff-caps">
          {CAPABILITIES.map((c) => (
            <label key={c.key} className="staff-check">
              <input
                type="checkbox"
                name="capability"
                value={c.key}
                defaultChecked={currentCapabilities?.[c.key] ?? false}
                disabled={isSelf}
              />
              <span>
                {c.label}
                <span className="tiny muted"> — {c.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="field">
        <label htmlFor={`note-${userId}`}>Note (optional)</label>
        <input
          id={`note-${userId}`}
          name="note"
          defaultValue={currentNote ?? ''}
          placeholder="Why this person has access"
          maxLength={300}
          disabled={isSelf}
        />
      </div>

      {!isSelf && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Submit label={currentRole ? 'Save changes' : 'Give staff access'} pending="Saving…" />
          {onDone && (
            <button type="button" className="btn ghost sm" onClick={onDone}>
              Cancel
            </button>
          )}
        </div>
      )}
    </form>
  );
}

/** Removing staff access. Its own form, so it cannot be a stray click on Save. */
export function RemoveStaffForm({ userId, email }: { userId: string; email: string }) {
  const [state, formAction] = useActionState<StaffState, FormData>(removeStaff, {});
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <>
        {state.error && <div className="notice error">{state.error}</div>}
        <button type="button" className="btn ghost sm" onClick={() => setConfirming(true)}>
          Remove access
        </button>
      </>
    );
  }

  return (
    <form action={formAction} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <input type="hidden" name="user_id" value={userId} />
      <span className="tiny">
        Remove staff access for <b>{email}</b>?
      </span>
      <Submit label="Yes, remove" pending="Removing…" />
      <button type="button" className="btn ghost sm" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </form>
  );
}
