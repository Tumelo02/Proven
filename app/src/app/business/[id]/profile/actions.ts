'use server';

/**
 * The business profile: identity, the team, and headcount over time.
 *
 * Nothing here checks who the user is. The security rules already limit every
 * write to a business the user owns, and a second check in application code
 * would be a weaker copy of the same rule that can drift out of step with it.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { EmploymentType } from '@/lib/database.types';

export interface FormState {
  error?: string;
  message?: string;
}

const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const EMPLOYMENT_TYPES: EmploymentType[] = [
  'full_time',
  'part_time',
  'casual',
  'volunteer',
  'owner',
];

/** Strip anything that would make a storage path awkward or ambiguous. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function count(formData: FormData, key: string): number {
  const n = Number.parseInt(String(formData.get(key) ?? '0'), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Save the profile fields.
 *
 * Every field is optional by design: a business must be able to enrol and
 * report its first month without filling any of this in, and a form that
 * refuses to save until it is complete is a form nobody completes.
 */
export async function saveProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = text(formData, 'business_id');
  const name = text(formData, 'name');

  if (!businessId) return { error: 'Missing business.' };
  /* The one thing that cannot be blanked: everything else on the platform
     refers to the business by name. */
  if (!name) return { error: 'A business needs a name.' };

  const supabase = await createClient();

  const { error } = await supabase
    .from('businesses')
    .update({
      name,
      tagline: text(formData, 'tagline'),
      description: text(formData, 'description'),
      industry: text(formData, 'industry'),
      region: text(formData, 'region'),
      started_on: text(formData, 'started_on') || null,
      owner_name: text(formData, 'owner_name'),
      owner_role: text(formData, 'owner_role'),
      owner_phone: text(formData, 'owner_phone'),
      owner_email: text(formData, 'owner_email'),
      address_line: text(formData, 'address_line'),
      city: text(formData, 'city'),
      province: text(formData, 'province'),
      postal_code: text(formData, 'postal_code'),
      registration_number: text(formData, 'registration_number'),
      tax_number: text(formData, 'tax_number'),
      vat_number: text(formData, 'vat_number'),
      bbbee_level: text(formData, 'bbbee_level'),
      website: text(formData, 'website'),
      social_handle: text(formData, 'social_handle'),
    })
    .eq('id', businessId);

  if (error) return { error: `Could not save: ${error.message}` };

  revalidatePath(`/business/${businessId}`, 'layout');
  return { message: 'Profile saved.' };
}

/**
 * Upload or replace the logo.
 *
 * Same shape as attaching a receipt: the business id leads the storage path,
 * because the bucket policies read that segment to decide access. The old file
 * is removed after the new row is written, never before, so a failure leaves
 * the business with its previous logo rather than none.
 */
export async function uploadLogo(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = text(formData, 'business_id');
  const file = formData.get('logo');

  if (!businessId) return { error: 'Missing business.' };
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image to upload.' };
  }

  if (!LOGO_TYPES.includes(file.type)) {
    return { error: 'Use a JPG, PNG, WEBP or SVG image.' };
  }

  if (file.size > LOGO_MAX_BYTES) {
    return {
      error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB.`,
    };
  }

  const supabase = await createClient();
  const path = `${businessId}/${crypto.randomUUID()}-${safeName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: `Could not upload: ${uploadError.message}` };

  const { data: prev } = await supabase
    .from('businesses')
    .select('logo_path')
    .eq('id', businessId)
    .maybeSingle();

  const { error: rowError } = await supabase
    .from('businesses')
    .update({ logo_path: path })
    .eq('id', businessId);

  if (rowError) {
    /* The file is up but unreferenced, so take it back out rather than leave
       an object nobody can reach. */
    await supabase.storage.from('logos').remove([path]);
    return { error: `Could not save the logo: ${rowError.message}` };
  }

  if (prev?.logo_path) {
    await supabase.storage.from('logos').remove([prev.logo_path]);
  }

  revalidatePath(`/business/${businessId}`, 'layout');
  return { message: 'Logo updated.' };
}

export async function removeLogo(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = text(formData, 'business_id');
  if (!businessId) return { error: 'Missing business.' };

  const supabase = await createClient();

  const { data: current } = await supabase
    .from('businesses')
    .select('logo_path')
    .eq('id', businessId)
    .maybeSingle();

  const { error } = await supabase
    .from('businesses')
    .update({ logo_path: null })
    .eq('id', businessId);

  if (error) return { error: `Could not remove the logo: ${error.message}` };

  if (current?.logo_path) {
    await supabase.storage.from('logos').remove([current.logo_path]);
  }

  revalidatePath(`/business/${businessId}`, 'layout');
  return { message: 'Logo removed.' };
}

/** Add someone to the team. */
export async function addTeamMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = text(formData, 'business_id');
  const fullName = text(formData, 'full_name');
  const rawType = text(formData, 'employment_type');

  if (!businessId) return { error: 'Missing business.' };
  if (!fullName) return { error: 'Enter the person’s name.' };

  const isOwner = formData.get('is_owner') === 'on';

  /* An owner is an owner whatever else they do, so ticking the box implies the
     employment type rather than asking for it twice. */
  const employmentType = isOwner
    ? 'owner'
    : (EMPLOYMENT_TYPES as string[]).includes(rawType)
      ? (rawType as EmploymentType)
      : 'full_time';

  /* Blank means "an owner, share not stated", which is the common case. Only a
     number actually entered is stored, so nothing is invented. */
  const rawPct = text(formData, 'ownership_pct');
  const pct = rawPct === '' ? null : Number.parseFloat(rawPct);
  const ownershipPct =
    pct !== null && Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : null;

  const supabase = await createClient();

  const { error } = await supabase.from('team_members').insert({
    business_id: businessId,
    full_name: fullName,
    role: text(formData, 'role'),
    employment_type: employmentType,
    started_on: text(formData, 'started_on') || null,
    left_on: null,
    is_owner: isOwner,
    ownership_pct: isOwner ? ownershipPct : null,
  });

  if (error) return { error: `Could not add: ${error.message}` };

  revalidatePath(`/business/${businessId}`, 'layout');
  return { message: `${fullName} added.` };
}

/**
 * Mark someone as having left, or delete the row outright.
 *
 * Leaving is recorded rather than deleted by default: headcount for a past
 * month is only answerable if departures are dated, and a funder reading job
 * numbers from six months ago needs that to be true.
 */
export async function endTeamMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = text(formData, 'business_id');
  const memberId = text(formData, 'member_id');
  const leftOn = text(formData, 'left_on');

  if (!businessId || !memberId) return { error: 'Missing person.' };

  const supabase = await createClient();

  const { error } = await supabase
    .from('team_members')
    .update({ left_on: leftOn || new Date().toISOString().slice(0, 10) })
    .eq('id', memberId);

  if (error) return { error: `Could not update: ${error.message}` };

  revalidatePath(`/business/${businessId}`, 'layout');
  return { message: 'Recorded as having left.' };
}

/** Remove a row added by mistake. Use `endTeamMember` for a real departure. */
export async function deleteTeamMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = text(formData, 'business_id');
  const memberId = text(formData, 'member_id');

  if (!businessId || !memberId) return { error: 'Missing person.' };

  const supabase = await createClient();
  const { error } = await supabase.from('team_members').delete().eq('id', memberId);

  if (error) return { error: `Could not remove: ${error.message}` };

  revalidatePath(`/business/${businessId}`, 'layout');
  return { message: 'Removed.' };
}

/**
 * Record headcount for a month.
 *
 * Upserted on (business_id, period_month), so correcting a month overwrites it
 * rather than adding a second conflicting row for the same period.
 */
export async function saveStaffCount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = text(formData, 'business_id');
  const month = text(formData, 'period_month');

  if (!businessId) return { error: 'Missing business.' };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: 'Choose a month.' };

  const supabase = await createClient();

  const { error } = await supabase.from('staff_counts').upsert(
    {
      business_id: businessId,
      period_month: `${month}-01`,
      full_time: count(formData, 'full_time'),
      part_time: count(formData, 'part_time'),
      casual: count(formData, 'casual'),
    },
    { onConflict: 'business_id,period_month' },
  );

  if (error) return { error: `Could not save: ${error.message}` };

  revalidatePath(`/business/${businessId}`, 'layout');
  return { message: 'Headcount saved.' };
}
