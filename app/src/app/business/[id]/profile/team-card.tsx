'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  addTeamMember,
  deleteTeamMember,
  endTeamMember,
  type FormState,
} from './actions';
import type { EmploymentType, TeamMember } from '@/lib/database.types';

const TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  casual: 'Casual',
  volunteer: 'Volunteer',
  owner: 'Owner',
};

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn sm" type="submit" disabled={pending}>
      {pending ? 'Adding…' : 'Add person'}
    </button>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The people in the business.
 *
 * "How many jobs does this business support" is the number every development
 * funder reports upward, so it is captured as rows that can be counted rather
 * than as a sentence describing them.
 *
 * Someone leaving is recorded with a date rather than deleted, so headcount
 * stays answerable for past months. Deleting is kept for rows added by mistake.
 */
export function TeamCard({
  businessId,
  team,
}: {
  businessId: string;
  team: TeamMember[];
}) {
  const [addState, addAction] = useActionState<FormState, FormData>(addTeamMember, {});
  const [endState, endAction] = useActionState<FormState, FormData>(endTeamMember, {});
  const [delState, delAction] = useActionState<FormState, FormData>(deleteTeamMember, {});

  const current = team.filter((m) => !m.left_on);
  const past = team.filter((m) => m.left_on);

  const counts = current.reduce<Record<string, number>>((acc, m) => {
    acc[m.employment_type] = (acc[m.employment_type] ?? 0) + 1;
    return acc;
  }, {});

  /* Owners with a stated share. Only warn when shares have actually been
     entered and do not add up: a partnership that never wrote the split down
     is normal, and nagging about it would be inventing a problem. */
  const owners = current.filter((m) => m.is_owner);
  const stated = owners.filter((m) => m.ownership_pct !== null);
  const shareTotal = stated.reduce((s, m) => s + Number(m.ownership_pct), 0);
  const shareMismatch = stated.length > 0 && Math.abs(shareTotal - 100) > 0.01;

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h3>The team</h3>
        <span className="hint" style={{ marginLeft: 'auto' }}>
          {current.length} {current.length === 1 ? 'person' : 'people'} right now
        </span>
      </div>
      <div className="panel-body">
        {addState.error && <div className="notice error">{addState.error}</div>}
        {endState.error && <div className="notice error">{endState.error}</div>}
        {delState.error && <div className="notice error">{delState.error}</div>}

        {current.length > 0 && (
          <p className="hint" style={{ marginTop: 0 }}>
            {Object.entries(counts)
              .map(([t, n]) => `${n} ${TYPE_LABEL[t as EmploymentType].toLowerCase()}`)
              .join(' · ')}
            {owners.length > 1 && ` · ${owners.length} owners`}
          </p>
        )}

        {shareMismatch && (
          <div className="notice" style={{ marginBottom: 12 }}>
            The ownership shares entered add up to {shareTotal}%, not 100%. That
            is worth checking, though it will not stop anything here.
          </div>
        )}

        {team.length === 0 ? (
          <p className="hint" style={{ marginTop: 0 }}>
            Nobody added yet. Include yourself.
          </p>
        ) : (
          <div className="table-wrap" style={{ marginBottom: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Started</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...current, ...past].map((m) => (
                  <tr key={m.id} style={m.left_on ? { opacity: 0.55 } : undefined}>
                    <td>
                      {m.full_name}
                      {m.is_owner && (
                        <span
                          className="pill blue"
                          style={{ marginLeft: 6, fontSize: 10 }}
                          title="An owner of this business"
                        >
                          Owner
                          {m.ownership_pct !== null ? ` ${m.ownership_pct}%` : ''}
                        </span>
                      )}
                    </td>
                    <td className="tiny">{m.role || '—'}</td>
                    <td className="tiny">{TYPE_LABEL[m.employment_type]}</td>
                    <td className="tiny">{fmt(m.started_on)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {m.left_on ? (
                        <span className="tiny muted">Left {fmt(m.left_on)}</span>
                      ) : (
                        <form action={endAction} style={{ display: 'inline' }}>
                          <input type="hidden" name="business_id" value={businessId} />
                          <input type="hidden" name="member_id" value={m.id} />
                          <button className="btn ghost sm" type="submit">
                            Mark as left
                          </button>
                        </form>
                      )}
                      <form action={delAction} style={{ display: 'inline', marginLeft: 6 }}>
                        <input type="hidden" name="business_id" value={businessId} />
                        <input type="hidden" name="member_id" value={m.id} />
                        <button
                          className="btn ghost sm"
                          type="submit"
                          title="Remove a row added by mistake. Use “Mark as left” for someone who actually left."
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form action={addAction}>
          <input type="hidden" name="business_id" value={businessId} />
          <div className="txn-form">
            <div className="f">
              <label htmlFor="full_name">Name</label>
              <input id="full_name" name="full_name" type="text" required />
            </div>
            <div className="f">
              <label htmlFor="role">Role</label>
              <input id="role" name="role" type="text" placeholder="e.g. Baker" />
            </div>
            <div className="f">
              <label htmlFor="employment_type">Type</label>
              <select id="employment_type" name="employment_type" defaultValue="full_time">
                {(Object.keys(TYPE_LABEL) as EmploymentType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="f">
              <label htmlFor="member_started_on">Started</label>
              <input id="member_started_on" name="started_on" type="date" />
            </div>
            {/* A business can have several owners on a split, so ownership is a
                property of a person rather than one field on the business. */}
            <div className="f">
              <label htmlFor="ownership_pct">Share, if an owner</label>
              <input
                id="ownership_pct"
                name="ownership_pct"
                type="number"
                min={0}
                max={100}
                step="0.01"
                placeholder="e.g. 50"
              />
            </div>
          </div>

          <label
            className="row"
            style={{ gap: 8, marginTop: 10, fontWeight: 500, fontSize: 13 }}
          >
            <input type="checkbox" name="is_owner" style={{ width: 'auto' }} />
            This person is an owner of the business
          </label>

          <div style={{ marginTop: 10 }}>
            <AddButton />
          </div>
        </form>
      </div>
    </div>
  );
}
