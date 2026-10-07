'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  saveTeamMember,
  removeTeamMember,
  inviteTeamMember,
  searchPeople,
  type TeamState,
  type FoundPerson,
} from './actions';
import { ROLE_LABEL, ROLE_BLURB, ROLE_ORDER } from './roles';
import type { BusinessRole } from '@/lib/database.types';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn sm" type="submit" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

/** The role picker, with the plain-English line under it. */
function RolePicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: BusinessRole;
  onChange: (r: BusinessRole) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>What they may do</label>
      <select
        id={id}
        name="role"
        value={value}
        onChange={(e) => onChange(e.target.value as BusinessRole)}
      >
        {ROLE_ORDER.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      <p className="hint">{ROLE_BLURB[value]}</p>
    </div>
  );
}

/** Change what an existing member may do. */
export function EditMemberForm({
  businessId,
  userId,
  email,
  currentRole,
  currentNote,
}: {
  businessId: string;
  userId: string;
  email: string;
  currentRole: BusinessRole;
  currentNote: string;
}) {
  const [state, formAction] = useActionState<TeamState, FormData>(saveTeamMember, {});
  const [role, setRole] = useState<BusinessRole>(currentRole);

  return (
    <form action={formAction} className="staff-form">
      {state.error && <div className="notice error">{state.error}</div>}
      {state.message && <div className="notice ok">{state.message}</div>}

      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="user_id" value={userId} />

      <RolePicker id={`role-${userId}`} value={role} onChange={setRole} />

      <div className="field">
        <label htmlFor={`note-${userId}`}>Note (optional)</label>
        <input
          id={`note-${userId}`}
          name="note"
          defaultValue={currentNote}
          placeholder="What they help with"
          maxLength={300}
        />
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Submit label="Save changes" busy="Saving…" />
      </div>

      <div className="staff-row-danger">
        <RemoveMemberForm businessId={businessId} userId={userId} email={email} />
      </div>
    </form>
  );
}

/** Its own form, so removing somebody cannot be a stray click on Save. */
function RemoveMemberForm({
  businessId,
  userId,
  email,
}: {
  businessId: string;
  userId: string;
  email: string;
}) {
  const [state, formAction] = useActionState<TeamState, FormData>(removeTeamMember, {});
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
      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="user_id" value={userId} />
      <span className="tiny">
        Remove <b>{email}</b> from this business?
      </span>
      <Submit label="Yes, remove" busy="Removing…" />
      <button type="button" className="btn ghost sm" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </form>
  );
}

/**
 * Adding somebody.
 *
 * Two ways in, for the same reason the staff screen has two: searching finds a
 * person who already has a Proven account, which is the commoner case; the
 * invitation covers somebody who has never signed up, so adding a colleague
 * does not start with telling them to go and register first.
 */
export function AddTeamMember({ businessId }: { businessId: string }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<FoundPerson[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<FoundPerson | null>(null);
  const [inviting, setInviting] = useState(false);

  async function onSearch(event: React.FormEvent) {
    event.preventDefault();
    if (term.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await searchPeople(businessId, term));
    } finally {
      setSearching(false);
    }
  }

  if (chosen) {
    return (
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>Give {chosen.email} access</h3>
        </div>
        <div className="panel-body">
          <NewMemberForm
            businessId={businessId}
            person={chosen}
            onDone={() => {
              setChosen(null);
              setResults(null);
              setTerm('');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h3>Add someone to this business</h3>
        <span className="hint" style={{ marginLeft: 'auto' }}>
          Search an existing account, or invite by email
        </span>
      </div>
      <div className="panel-body">
        <form onSubmit={onSearch} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search by email address"
            aria-label="Search accounts by email address"
            style={{ flex: '1 1 260px' }}
          />
          <button className="btn sm" type="submit" disabled={searching || term.trim().length < 3}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results !== null && results.length === 0 && (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0, marginTop: 12 }}>
            No account matches that, among people not already on this business.
          </p>
        )}

        {results !== null && results.length > 0 && (
          <div className="staff-results">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="staff-result"
                onClick={() => setChosen(r)}
              >
                <span>
                  <b>{r.email}</b>
                  {r.fullName && <span className="tiny muted"> · {r.fullName}</span>}
                </span>
                <span className="tiny">Choose</span>
              </button>
            ))}
          </div>
        )}

        {inviting ? (
          <InviteForm businessId={businessId} onDone={() => setInviting(false)} />
        ) : (
          <p className="tiny muted" style={{ margin: '10px 0 0' }}>
            Not on Proven yet?{' '}
            <button
              type="button"
              className="reset-inline"
              onClick={() => setInviting(true)}
              style={{ fontWeight: 700 }}
            >
              Invite them by email
            </button>
            .
          </p>
        )}
      </div>
    </div>
  );
}

function NewMemberForm({
  businessId,
  person,
  onDone,
}: {
  businessId: string;
  person: FoundPerson;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<TeamState, FormData>(saveTeamMember, {});
  const [role, setRole] = useState<BusinessRole>('viewer');

  return (
    <form action={formAction} className="staff-form">
      {state.error && <div className="notice error">{state.error}</div>}
      {state.message && <div className="notice ok">{state.message}</div>}

      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="user_id" value={person.id} />

      <RolePicker id="new-role" value={role} onChange={setRole} />

      <div className="field">
        <label htmlFor="new-note">Note (optional)</label>
        <input id="new-note" name="note" placeholder="What they help with" maxLength={300} />
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Submit label="Give access" busy="Saving…" />
        <button type="button" className="btn ghost sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function InviteForm({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const [state, formAction] = useActionState<TeamState, FormData>(inviteTeamMember, {});
  const [role, setRole] = useState<BusinessRole>('viewer');

  return (
    <div className="staff-invite">
      <form action={formAction}>
        {state.error && <div className="notice error">{state.error}</div>}
        {state.message && <div className="notice ok">{state.message}</div>}

        <input type="hidden" name="business_id" value={businessId} />

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

        <RolePicker id="invite-role" value={role} onChange={setRole} />

        <div className="field">
          <label htmlFor="invite-note">Note (optional)</label>
          <input id="invite-note" name="note" placeholder="What they help with" maxLength={300} />
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Submit label="Send invitation" busy="Sending…" />
          <button type="button" className="btn ghost sm" onClick={onDone}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
