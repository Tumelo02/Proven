'use server';

/**
 * Funder-side actions.
 *
 * Confirming a link is the moment an organisation gains read access to a
 * business's figures, so it is recorded in `audit_log`: who confirmed what,
 * and when. The database trigger stamps `confirmed_by` and `confirmed_at`
 * from the session, so a client cannot claim someone else approved it.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordEvent } from '@/lib/audit';

export async function decideLinkRequest(formData: FormData): Promise<void> {
  const linkId = String(formData.get('link_id') ?? '');
  const orgId = String(formData.get('org_id') ?? '');
  const decision = String(formData.get('decision') ?? '');

  if (!linkId || !orgId) return;
  if (decision !== 'confirmed' && decision !== 'rejected') return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: updated } = await supabase
    .from('funding_links')
    .update({ status: decision })
    .eq('id', linkId)
    .select('business_id')
    .single();

  if (updated) {
    /* Confirming a link is the moment an organisation gains sight of a
       business's figures. If access is ever questioned, this row is the
       answer to "who granted it, and when". */
    await recordEvent({
      action: decision === 'confirmed' ? 'funding_link.confirmed' : 'funding_link.rejected',
      entityType: 'funding_link',
      entityId: linkId,
      orgId,
      severity: 'notice',
      detail: { business_id: updated.business_id },
    });
  }

  revalidatePath(`/funder/${orgId}/requests`);
  revalidatePath(`/funder/${orgId}`);
}

/**
 * Record that this organisation has acted on a flagged business.
 *
 * The funder's own working note, not a judgement added to the business's
 * record: the entrepreneur never sees it, and neither does another funder of
 * the same business. That privacy is what makes it worth writing honestly.
 */
export async function markFollowedUp(formData: FormData): Promise<void> {
  const businessId = String(formData.get('business_id') ?? '');
  const orgId = String(formData.get('org_id') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  const rawScore = String(formData.get('score_at') ?? '');

  if (!businessId || !orgId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const score = Number.parseFloat(rawScore);

  await supabase.from('follow_ups').insert({
    business_id: businessId,
    org_id: orgId,
    actor_id: user.id,
    note,
    score_at: Number.isFinite(score) ? score : null,
  });

  revalidatePath(`/funder/${orgId}/business/${businessId}`);
  revalidatePath(`/funder/${orgId}/attention`);
}

const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const ORG_TYPES = ['funder', 'incubator', 'accelerator', 'government', 'other'];

export interface OrgFormState {
  error?: string;
  message?: string;
}

function orgText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

/**
 * Save the organisation profile.
 *
 * The row-level rules already limit the write to an admin of this
 * organisation, so there is no second check here: a copy of the same rule in
 * application code would only be one that can drift out of step with it.
 */
export async function saveOrgProfile(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const orgId = orgText(formData, 'org_id');
  const name = orgText(formData, 'name');

  if (!orgId) return { error: 'Missing organisation.' };
  if (!name) return { error: 'An organisation needs a name.' };

  const rawType = orgText(formData, 'org_type');
  const orgType = ORG_TYPES.includes(rawType) ? rawType : 'funder';

  const supabase = await createClient();

  const { error } = await supabase
    .from('organisations')
    .update({
      name,
      org_type: orgType as 'funder' | 'incubator' | 'accelerator' | 'government' | 'other',
      tagline: orgText(formData, 'tagline'),
      website: orgText(formData, 'website'),
      province: orgText(formData, 'province'),
    })
    .eq('id', orgId);

  if (error) return { error: `Could not save: ${error.message}` };

  /* Contact details live in their own table, because `organisations` is
     readable by every signed-in user and a named person's direct line is not
     public information. Upserted, so the first save creates the row. */
  const { error: contactError } = await supabase.from('org_contacts').upsert(
    {
      org_id: orgId,
      contact_name: orgText(formData, 'contact_name'),
      contact_role: orgText(formData, 'contact_role'),
      contact_email: orgText(formData, 'contact_email'),
      contact_phone: orgText(formData, 'contact_phone'),
    },
    { onConflict: 'org_id' },
  );

  if (contactError) {
    return { error: `Profile saved, but the contact details did not: ${contactError.message}` };
  }

  await recordEvent({
    action: 'organisation.updated',
    entityType: 'organisation',
    entityId: orgId,
    orgId,
    severity: 'notice',
    detail: { name },
  });

  revalidatePath(`/funder/${orgId}`, 'layout');
  return { message: 'Profile saved.' };
}

/** Upload or replace the organisation logo. */
export async function uploadOrgLogo(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const orgId = orgText(formData, 'org_id');
  const file = formData.get('logo');

  if (!orgId) return { error: 'Missing organisation.' };
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image to upload.' };
  }
  if (!LOGO_TYPES.includes(file.type)) {
    return { error: 'Use a JPG, PNG, WEBP or SVG image.' };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB.` };
  }

  const supabase = await createClient();

  /* The `org/` prefix is what the storage policies match on, and what keeps
     these objects out of the business-logo namespace. */
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  const path = `org/${orgId}/${crypto.randomUUID()}-${safe}`;

  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: `Could not upload: ${uploadError.message}` };

  const { data: prev } = await supabase
    .from('organisations')
    .select('logo_path')
    .eq('id', orgId)
    .maybeSingle();

  const { error: rowError } = await supabase
    .from('organisations')
    .update({ logo_path: path })
    .eq('id', orgId);

  if (rowError) {
    await supabase.storage.from('logos').remove([path]);
    return { error: `Could not save the logo: ${rowError.message}` };
  }

  if (prev?.logo_path) {
    await supabase.storage.from('logos').remove([prev.logo_path]);
  }

  revalidatePath(`/funder/${orgId}`, 'layout');
  return { message: 'Logo updated.' };
}

export async function removeOrgLogo(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const orgId = orgText(formData, 'org_id');
  if (!orgId) return { error: 'Missing organisation.' };

  const supabase = await createClient();

  const { data: current } = await supabase
    .from('organisations')
    .select('logo_path')
    .eq('id', orgId)
    .maybeSingle();

  const { error } = await supabase
    .from('organisations')
    .update({ logo_path: null })
    .eq('id', orgId);

  if (error) return { error: `Could not remove the logo: ${error.message}` };

  if (current?.logo_path) {
    await supabase.storage.from('logos').remove([current.logo_path]);
  }

  revalidatePath(`/funder/${orgId}`, 'layout');
  return { message: 'Logo removed.' };
}

const SUPPORT_KINDS = [
  'grant',
  'loan',
  'equity',
  'programme',
  'mentorship',
  'in_kind',
  'other',
];

/**
 * Record what this organisation is providing to one business.
 *
 * The amount already on a funding link was entered by the ENTREPRENEUR when
 * they asked to be linked. That is a claim. This is the organisation's own
 * figure, kept separately: a gap between the two is worth seeing rather than
 * quietly overwriting.
 *
 * The row-level rules already limit the write to a member of this
 * organisation, so there is no second check here.
 */
export async function saveSupportTerms(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const linkId = orgText(formData, 'link_id');
  const orgId = orgText(formData, 'org_id');
  const businessId = orgText(formData, 'business_id');
  const rawKind = orgText(formData, 'support_kind');

  if (!linkId || !orgId) return { error: 'Missing funding link.' };

  const kind = SUPPORT_KINDS.includes(rawKind) ? rawKind : 'grant';

  /* Blank means "not recorded", which is different from zero: a mentorship
     programme legitimately has no amount, and a portfolio total should not
     confuse the two. */
  function money(key: string): string | null {
    const raw = orgText(formData, key);
    if (raw === '') return null;
    const n = Number.parseFloat(raw.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) && n >= 0 ? String(n) : null;
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('funding_links')
    .update({
      support_kind: kind as
        | 'grant'
        | 'loan'
        | 'equity'
        | 'programme'
        | 'mentorship'
        | 'in_kind'
        | 'other',
      committed_amount: money('committed_amount'),
      released_amount: money('released_amount'),
      support_starts_on: orgText(formData, 'support_starts_on') || null,
      support_ends_on: orgText(formData, 'support_ends_on') || null,
      terms: orgText(formData, 'terms'),
    })
    .eq('id', linkId);

  if (error) return { error: `Could not save: ${error.message}` };

  await recordEvent({
    action: 'support_terms.updated',
    entityType: 'funding_link',
    entityId: linkId,
    orgId,
    severity: 'notice',
    detail: { business_id: businessId, kind },
  });

  revalidatePath(`/funder/${orgId}/business/${businessId}`);
  revalidatePath(`/funder/${orgId}`);
  return { message: 'Saved.' };
}
