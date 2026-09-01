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
import { createAdminClient, createClient } from '@/lib/supabase/server';
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

export interface OrgCreateState {
  error?: string;
  message?: string;
}

/**
 * Create a funding organisation.
 *
 * Until now this was an SQL insert, which meant no funder could be onboarded
 * without a database console. That is fine for one demo organisation and
 * impossible during a pilot.
 *
 * Written with the service-role client: `organisations` has no INSERT policy,
 * deliberately, because nobody should be able to create an organisation for
 * themselves and then claim to be its admin. The guard is the platform-admin
 * check below, and the row is recorded in the audit trail.
 */
export async function createOrganisation(
  _prev: OrgCreateState,
  formData: FormData,
): Promise<OrgCreateState> {
  const name = String(formData.get('name') ?? '').trim();
  const rawSlug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const orgType = String(formData.get('org_type') ?? 'funder');

  if (!name) return { error: 'Give the organisation a name.' };

  /* The code a business types to find them. Derived from the name when left
     blank, so this is one field rather than two in the common case. */
  const slug = (rawSlug || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  if (!slug) return { error: 'That name cannot be turned into a code. Enter one yourself.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  /* Checked here rather than left to a policy, because the write below uses
     the service-role client and bypasses policies entirely. */
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_platform_admin) return { error: 'Not permitted.' };

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from('organisations')
    .insert({
      name,
      slug,
      org_type: orgType as 'funder' | 'incubator' | 'accelerator' | 'government' | 'other',
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: `The code "${slug}" is already taken. Enter a different one.` };
    }
    return { error: `Could not create: ${error.message}` };
  }

  await recordEvent({
    action: 'organisation.created',
    entityType: 'organisation',
    entityId: created.id,
    orgId: created.id,
    severity: 'notice',
    detail: { name, slug, type: orgType },
  });

  revalidatePath('/admin');
  return { message: `${name} created. Its code is ${slug}.` };
}

/**
 * Set an organisation's commercial standing.
 *
 * Proven staff only, and written with the service-role client because
 * `organisations` grants UPDATE to the organisation's own admins: without the
 * check below, a funder could quietly mark themselves as paying.
 */
export async function setOrgAccount(formData: FormData): Promise<void> {
  const orgId = String(formData.get('org_id') ?? '');
  const status = String(formData.get('account_status') ?? '');
  const until = String(formData.get('account_until') ?? '').trim();
  const note = String(formData.get('account_note') ?? '').trim();

  const VALID = ['pilot', 'paying', 'internal', 'lapsed'];
  if (!orgId || !VALID.includes(status)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_platform_admin) return;

  const admin = createAdminClient();
  await admin
    .from('organisations')
    .update({
      account_status: status as 'pilot' | 'paying' | 'internal' | 'lapsed',
      account_until: until || null,
      account_note: note,
    })
    .eq('id', orgId);

  await recordEvent({
    action: 'organisation.account_changed',
    entityType: 'organisation',
    entityId: orgId,
    orgId,
    severity: 'notice',
    detail: { status, ...(until ? { until } : {}) },
  });

  revalidatePath('/admin');
  revalidatePath(`/admin/org/${orgId}`);
}

/** Suspend or restore one business owner's platform access. */
export async function setBusinessAccess(formData: FormData): Promise<void> {
  const businessId = String(formData.get('business_id') ?? '').trim();
  const action = String(formData.get('action') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();

  if (!businessId || (action !== 'disable' && action !== 'enable')) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.is_platform_admin) return;

  const admin = createAdminClient();
  const { data: business } = await admin
    .from('businesses')
    .select('id, name, owner_id')
    .eq('id', businessId)
    .maybeSingle();
  if (!business) return;

  const disabled = action === 'disable';
  const { error } = await admin
    .from('businesses')
    .update({ access_disabled: disabled, access_disabled_reason: disabled ? reason : '' })
    .eq('id', businessId);
  if (error) return;

  await recordEvent({
    action: disabled ? 'business.access_disabled' : 'business.access_enabled',
    entityType: 'business',
    entityId: businessId,
    severity: disabled ? 'alert' : 'notice',
    detail: { business_name: business.name, owner_id: business.owner_id, ...(reason ? { reason } : {}) },
  });

  revalidatePath('/admin');
  revalidatePath(`/business/${businessId}`);
}
