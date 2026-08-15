'use server';

/**
 * Platform administration: reviewing evidence.
 *
 * Proven staff decide whether a document matches what was logged. Neither the
 * business that uploaded it nor the funder reading it can, and the database
 * enforces that: the only UPDATE policy on `documents` requires
 * `is_platform_admin_uncached()`.
 *
 * Every decision is written to `audit_log`. "Who verified this, and when" is
 * precisely the question a disputed record turns on, and an answer that only
 * exists in someone's memory is not evidence.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordEvent } from '@/lib/audit';
import { REJECT_REASONS, type RejectReason } from '@/lib/database.types';

export async function reviewDocument(formData: FormData): Promise<void> {
  const documentId = String(formData.get('document_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  const reason = String(formData.get('reason') ?? '') as RejectReason | '';

  if (!documentId) return;
  if (decision !== 'verified' && decision !== 'rejected') return;

  /* A rejection must say why. The database enforces this too, but stopping
     here keeps the failure a no-op rather than a constraint error. */
  if (decision === 'rejected' && !(reason in REJECT_REASONS)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: updated } = await supabase
    .from('documents')
    .update({
      review_status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      /* Cleared on verify, so a document that was rejected and later accepted
         does not keep showing the old reason. */
      reject_reason: decision === 'rejected' ? (reason as RejectReason) : null,
      reject_note: decision === 'rejected' ? note : '',
    })
    .eq('id', documentId)
    .select('id, transaction_id, file_name')
    .single();

  /* Nothing came back means the policy refused the write, which is the
     correct outcome for anyone who is not Proven staff. */
  if (!updated) return;

  await recordEvent({
    action: decision === 'verified' ? 'document.verified' : 'document.rejected',
    entityType: 'document',
    entityId: documentId,
    /* A decision on somebody's evidence, which is what a disputed record turns
       on. Worth surfacing above routine traffic. */
    severity: 'notice',
    detail: {
      transaction_id: updated.transaction_id,
      file_name: updated.file_name,
      ...(decision === 'rejected' ? { reason } : {}),
      ...(note ? { note } : {}),
    },
  });

  revalidatePath('/admin/review');
  revalidatePath('/admin');
}
