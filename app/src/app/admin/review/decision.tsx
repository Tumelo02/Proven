'use client';

import { useState } from 'react';
import { reviewDocument } from '../actions';
import { REJECT_REASONS, type RejectReason } from '@/lib/database.types';

/**
 * Verify, or reject with a reason.
 *
 * The reason fields appear only once "Reject" is pressed, so the common case,
 * a document that is simply fine, stays a single click. Rejecting takes two
 * deliberate steps, which is right: it sends the business back to do work.
 */
export function ReviewDecision({ documentId }: { documentId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectReason | ''>('');

  if (!rejecting) {
    return (
      <div className="mactions">
        <form action={reviewDocument}>
          <input type="hidden" name="document_id" value={documentId} />
          <input type="hidden" name="decision" value="verified" />
          <button className="btn sm" type="submit">
            Verify
          </button>
        </form>

        <button className="btn ghost sm" type="button" onClick={() => setRejecting(true)}>
          Reject
        </button>
      </div>
    );
  }

  return (
    <form action={reviewDocument} style={{ display: 'grid', gap: 6, minWidth: 240 }}>
      <input type="hidden" name="document_id" value={documentId} />
      <input type="hidden" name="decision" value="rejected" />

      <select
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value as RejectReason)}
        required
        aria-label="Why is this not accepted?"
        style={{ fontSize: 12.5, padding: '7px 8px' }}
      >
        <option value="">Why not accepted…</option>
        {(Object.keys(REJECT_REASONS) as RejectReason[]).map((key) => (
          <option key={key} value={key}>
            {REJECT_REASONS[key].label}
          </option>
        ))}
      </select>

      {/* The specifics, e.g. which amount was expected. Required for "Something
          else", where the reason alone says nothing useful. */}
      <input
        type="text"
        name="note"
        placeholder={
          reason === 'other' ? 'Say what is wrong (required)' : 'Add detail (optional)'
        }
        required={reason === 'other'}
        style={{ fontSize: 12.5, padding: '7px 8px' }}
      />

      <div className="mactions">
        <button className="btn sm" type="submit" disabled={!reason}>
          Send back
        </button>
        <button
          className="btn ghost sm"
          type="button"
          onClick={() => {
            setRejecting(false);
            setReason('');
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
