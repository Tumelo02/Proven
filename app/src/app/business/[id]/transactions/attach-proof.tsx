'use client';

import { useActionState, useRef, useState } from 'react';
import { attachDocument, type UploadState } from '@/app/businesses/documents';
import type { Document } from '@/lib/database.types';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf';

/**
 * The proof cell on a transaction row.
 *
 * A hidden file input behind a chip, submitting as soon as a file is chosen:
 * picking the receipt is the whole intent, so a second "upload" click would
 * be a step for its own sake.
 */
export function AttachProof({
  transactionId,
  businessId,
  document: doc,
  viewUrl,
}: {
  transactionId: string;
  businessId: string;
  document: Document | null;
  /** Signed link, minted on the server; null while none exists. */
  viewUrl: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<UploadState, FormData>(attachDocument, {});
  const [busy, setBusy] = useState(false);

  if (doc) {
    /* Sent is sent. A document under review cannot be swapped out from
       underneath the reviewer, so the only state that offers the upload
       control again is one that was turned down. */
    const rejected = doc.review_status === 'rejected';

    return (
      /* `justifyItems: start` so the chip is its own width. A plain grid
         stretches its children to the full column, which made "Attached" run
         the width of the Proof cell. */
      <div style={{ display: 'grid', gap: 4, justifyItems: 'start' }}>
        <a
          className="proof-chip has"
          href={viewUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${doc.file_name}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
          Attached
        </a>

        {rejected && (
          <form ref={formRef} action={formAction}>
            <input type="hidden" name="transaction_id" value={transactionId} />
            <input type="hidden" name="business_id" value={businessId} />
            <label
              className="proof-chip redo"
              title="This document was not accepted, send a new one"
            >
              <input
                type="file"
                name="file"
                accept={ACCEPT}
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) {
                    setBusy(true);
                    formRef.current?.requestSubmit();
                  }
                }}
              />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 3v6h-6" />
              </svg>
              {busy ? 'Sending…' : 'Re-attach'}
            </label>
          </form>
        )}

        {state.error && (
          <div className="tiny" style={{ color: 'var(--red)', maxWidth: 180 }}>
            {state.error}
          </div>
        )}
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="transaction_id" value={transactionId} />
      <input type="hidden" name="business_id" value={businessId} />

      <label className="proof-chip add" title="Attach a photo or PDF of the receipt">
        <input
          type="file"
          name="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            if (e.target.files?.length) {
              setBusy(true);
              formRef.current?.requestSubmit();
            }
          }}
        />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {busy ? 'Uploading…' : 'Attach'}
      </label>

      {state.error && (
        <div className="tiny" style={{ color: 'var(--red)', marginTop: 4, maxWidth: 180 }}>
          {state.error}
        </div>
      )}
    </form>
  );
}
