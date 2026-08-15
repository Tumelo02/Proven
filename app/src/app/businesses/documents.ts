'use server';

/**
 * Receipts and invoices: uploading them, and opening them again.
 *
 * Files go to the private `proofs` bucket, keyed `<business_id>/<uuid>-<name>`.
 * That first path segment is not decoration: the storage policies read it to
 * decide who may write and who may read, so a file cannot be uploaded into
 * another business's folder even by a crafted request.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface UploadState {
  error?: string;
  message?: string;
}

/** What the bucket accepts, mirrored here so the failure is a sentence. */
const ACCEPTED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
];

const MAX_BYTES = 10 * 1024 * 1024;

/** Strips anything that could confuse a storage path or a download header. */
function safeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'receipt';
}

export async function attachDocument(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const transactionId = String(formData.get('transaction_id') ?? '');
  const businessId = String(formData.get('business_id') ?? '');
  const file = formData.get('file');

  if (!transactionId || !businessId) return { error: 'Missing transaction.' };
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a file to attach.' };
  }

  if (!ACCEPTED.includes(file.type)) {
    return {
      error: 'That file type is not accepted. Attach a photo (JPG, PNG, WEBP, HEIC) or a PDF.',
    };
  }

  if (file.size > MAX_BYTES) {
    return {
      error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB, so a photo rather than a scan.`,
    };
  }

  const supabase = await createClient();

  /* The business id leads the path, because the storage policies read it to
     decide access. */
  const path = `${businessId}/${crypto.randomUUID()}-${safeName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from('proofs')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: `Could not upload: ${uploadError.message}` };
  }

  /* Replace any earlier document on this entry, so one transaction shows one
     receipt rather than a pile of them. The old file is removed too, rather
     than left orphaned in the bucket. */
  const { data: existing } = await supabase
    .from('documents')
    .select('id, storage_path')
    .eq('transaction_id', transactionId);

  const { error: rowError } = await supabase.from('documents').insert({
    transaction_id: transactionId,
    storage_path: path,
    file_name: safeName(file.name),
    mime_type: file.type,
    size_bytes: file.size,
    /* `pending` always: Proven records that evidence exists, it does not
       certify it. Only a reviewer can move this on. */
    review_status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    reject_reason: null,
    reject_note: '',
  });

  if (rowError) {
    /* The file is up but unreferenced, so take it back out rather than leave
       a document nobody can find. */
    await supabase.storage.from('proofs').remove([path]);
    return { error: `Could not record the document: ${rowError.message}` };
  }

  for (const old of existing ?? []) {
    await supabase.storage.from('proofs').remove([old.storage_path]);
    await supabase.from('documents').delete().eq('id', old.id);
  }

  revalidatePath(`/business/${businessId}`, 'layout');
  return { message: `${safeName(file.name)} attached.` };
}

/**
 * A short-lived link to a stored file.
 *
 * Signed rather than public: a receipt is a private business record, and a
 * public URL would be readable by anyone who ever saw the path.
 */
export async function getDocumentUrl(documentId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId)
    .maybeSingle();

  if (!doc) return null;

  const { data } = await supabase.storage
    .from('proofs')
    .createSignedUrl(doc.storage_path, 60 * 5);

  return data?.signedUrl ?? null;
}

/** Remove a receipt. Only the owner can, enforced by the storage policies. */
export async function removeDocument(formData: FormData): Promise<void> {
  const documentId = String(formData.get('document_id') ?? '');
  const businessId = String(formData.get('business_id') ?? '');
  if (!documentId || !businessId) return;

  const supabase = await createClient();

  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId)
    .maybeSingle();

  if (doc) {
    await supabase.storage.from('proofs').remove([doc.storage_path]);
    await supabase.from('documents').delete().eq('id', documentId);
  }

  revalidatePath(`/business/${businessId}`, 'layout');
}
