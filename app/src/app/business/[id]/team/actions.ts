'use server';

/**
 * The people a business lets in.
 *
 * Every write goes through a SECURITY DEFINER function that checks the caller
 * owns the business, and those functions check `businesses.owner_id` directly
 * rather than through `owns_business`, which now also covers editors and
 * managers. That distinction is the point: a manager who could add members
 * could add themselves, and then the owner no longer owns anything.
 *
 * Errors are returned as values rather than thrown, so a form re-renders with
 * a message instead of showing an error page.
 */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/site-origin';
import { recordEvent } from '@/lib/audit';
import { findTeamCandidates, getMyBusinessAccess } from '@/lib/queries';
import type { BusinessRole } from '@/lib/database.types';

export interface TeamState {
  error?: string;
  message?: string;
}

const ROLES: BusinessRole[] = ['viewer', 'editor', 'manager'];

export interface FoundPerson {
  id: string;
  email: string;
  fullName: string;
}

/**
 * Account lookup for the picker.
 *
 * Guarded on the server as well as hidden in the interface: calling this for a
 * business you do not own returns nothing rather than a list of addresses.
 */
export async function searchPeople(
  businessId: string,
  term: string,
): Promise<FoundPerson[]> {
  const access = await getMyBusinessAccess(businessId);
  if (!access.canManageTeam) return [];

  const profiles = await findTeamCandidates(businessId, term);
  return profiles.map((p) => ({ id: p.id, email: p.email, fullName: p.full_name }));
}

export async function saveTeamMember(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const businessId = String(formData.get('business_id') ?? '');
  const userId = String(formData.get('user_id') ?? '');
  const rawRole = String(formData.get('role') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 300);

  if (!businessId || !userId) return { error: 'Missing business or person.' };
  if (!ROLES.includes(rawRole as BusinessRole)) return { error: 'Choose what they may do.' };
  const role = rawRole as BusinessRole;

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_business_member', {
    target_business_id: businessId,
    target_user: userId,
    new_role: role,
    new_note: note,
  });

  if (error) return { error: error.message };

  /* Who was given access to a business's figures, and by whom. A business's
     numbers are the thing the whole platform exists to protect, so this is
     worth a notice in the trail rather than passing silently. */
  await recordEvent({
    action: 'business.member_changed',
    entityType: 'business',
    entityId: businessId,
    severity: 'notice',
    detail: { user_id: userId, role },
  });

  revalidatePath(`/business/${businessId}/team`);
  return { message: 'Saved.' };
}

export async function removeTeamMember(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const businessId = String(formData.get('business_id') ?? '');
  const userId = String(formData.get('user_id') ?? '');
  if (!businessId || !userId) return { error: 'Missing business or person.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_business_member', {
    target_business_id: businessId,
    target_user: userId,
  });

  if (error) return { error: error.message };

  await recordEvent({
    action: 'business.member_removed',
    entityType: 'business',
    entityId: businessId,
    severity: 'notice',
    detail: { user_id: userId },
  });

  revalidatePath(`/business/${businessId}/team`);
  return { message: 'Access removed.' };
}

/**
 * Invite somebody who has no Proven account yet.
 *
 * Works the way staff invitations do: Supabase sends them a link, they set
 * their own password from it, and the role chosen here is waiting when they
 * arrive. No password is ever set on their behalf, so nobody — the owner
 * included — knows it.
 *
 * The role is applied through the same owner-checked function as every other
 * change, so this path cannot grant access the caller could not grant anyway.
 */
export async function inviteTeamMember(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const businessId = String(formData.get('business_id') ?? '');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const rawRole = String(formData.get('role') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 300);

  if (!businessId) return { error: 'Missing business.' };
  if (!email) return { error: 'Enter an email address.' };
  if (!z.string().email().safeParse(email).success) {
    return { error: 'Enter a valid email address.' };
  }
  if (!ROLES.includes(rawRole as BusinessRole)) return { error: 'Choose what they may do.' };
  const role = rawRole as BusinessRole;

  /* Checked before anything is sent, so somebody who does not own this
     business cannot use it to find out whether an address has an account, nor
     make Proven send mail on their behalf. */
  const access = await getMyBusinessAccess(businessId);
  if (!access.canManageTeam) {
    return { error: 'Only the business owner can invite people.' };
  }

  const admin = createAdminClient();
  const requestHeaders = await headers();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteOrigin(requestHeaders)}/auth/callback?next=/business/${businessId}`,
  });

  if (error) {
    if (/already|exists|registered/i.test(error.message)) {
      return {
        error:
          'That address already has a Proven account. Search for it above and give it a role instead.',
      };
    }
    return { error: `Could not send the invitation: ${error.message}` };
  }

  const invited = data.user;
  if (!invited) return { error: 'The invitation was not created. Try again.' };

  const supabase = await createClient();
  const { error: roleError } = await supabase.rpc('set_business_member', {
    target_business_id: businessId,
    target_user: invited.id,
    new_role: role,
    new_note: note,
  });

  if (roleError) {
    /* They have an account but no access, which is a half-finished state worth
       naming rather than reporting as success. */
    return {
      error: `They were invited, but the role could not be set: ${roleError.message}. Find them above and set it by hand.`,
    };
  }

  await recordEvent({
    action: 'business.member_invited',
    entityType: 'business',
    entityId: businessId,
    severity: 'notice',
    detail: { email, role },
  });

  revalidatePath(`/business/${businessId}/team`);
  return {
    message: `Invitation sent to ${email}. They will set their own password from the link, and arrive as ${role}.`,
  };
}
