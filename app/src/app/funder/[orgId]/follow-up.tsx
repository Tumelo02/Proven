'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { markFollowedUp } from '../actions';
import type { FollowUp } from '@/lib/database.types';

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn ghost sm" type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * "Mark as followed up", and the record of previous ones.
 *
 * The note field is revealed rather than always shown: the common case is
 * simply "I have dealt with this", and a textarea sitting open makes an
 * optional field feel required, which is how a feature stops being used.
 */
export function FollowUpControl({
  businessId,
  orgId,
  score,
  history,
}: {
  businessId: string;
  orgId: string;
  score: number;
  history: FollowUp[];
}) {
  const [open, setOpen] = useState(false);
  const latest = history[0];

  return (
    <div style={{ marginTop: 9 }}>
      {latest && (
        <div className="actioned-note">
          ✔ Followed up on {fmt(latest.created_at)}
          {latest.note ? `: ${latest.note}` : ''}
        </div>
      )}

      {open ? (
        <form action={markFollowedUp} style={{ marginTop: 8 }}>
          <input type="hidden" name="business_id" value={businessId} />
          <input type="hidden" name="org_id" value={orgId} />
          <input type="hidden" name="score_at" value={score} />
          <textarea
            name="note"
            rows={2}
            placeholder="What did you do? e.g. Called her, stock supplier problem, revisit in 3 weeks."
            style={{ fontSize: 12.5 }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <SaveButton label="Save follow-up" />
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="btn ghost sm"
          style={{ marginTop: latest ? 8 : 0 }}
          onClick={() => setOpen(true)}
        >
          {latest ? 'Add another follow-up' : 'Mark as followed up'}
        </button>
      )}

      {history.length > 1 && (
        <details style={{ marginTop: 8 }}>
          <summary className="tiny muted" style={{ cursor: 'pointer' }}>
            {history.length} follow-ups on record
          </summary>
          <ul
            style={{
              margin: '6px 0 0',
              paddingLeft: 16,
              fontSize: 11.5,
              color: 'var(--muted)',
              lineHeight: 1.7,
            }}
          >
            {history.slice(1).map((f) => (
              <li key={f.id}>
                {fmt(f.created_at)}
                {f.note ? `: ${f.note}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
