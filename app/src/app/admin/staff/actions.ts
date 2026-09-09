'use server';

/**
 * Managing Proven's own staff accounts.
 *
 * Every write here goes through a SECURITY DEFINER function in the database
 * that checks the caller is an owner before doing anything. That check is the
 * boundary, not the one in this file: an owner-only screen a limited admin
 * cannot see is a courtesy, while a limited admin calling this action directly
 * is the case that actually has to fail, and it does, in Postgres.
 *
 * Errors are returned as values rather than thrown, so the form re-renders
 * with a message instead of showing an error page.
 */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/site-origin';
import { recordEvent } from '@/lib/audit';
import type { StaffRole } from '@/lib/database.types';

export interface StaffState {
  error?: string;
  message?: string;
}

const ROLES: StaffRole[] = ['owner', 'manager', 'reviewer', 'analyst'];

/**
 * What each role can do by default.
 *
 * A role with nothing ticked is a trap: someone assigns "reviewer" expecting
 * them to be able to review, and the account can do nothing. These fill in
 * when the form does not say otherwise.
 */
const ROLE_DEFAULTS: Record<StaffRole, string[]> = {
  owner: [
    'review_evidence',
    'manage_businesses',
    'manage_organisations',
    'view_commercial',
    'view_audit',
  ],
  manager: ['review_evidence', 'manage_businesses', 'manage_organisations', 'view_audit'],
  reviewer: ['review_evidence'],
  analyst: [],
};

export async function saveStaffRole(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const target = String(formData.get('user_id') ?? '');
  const rawRole = String(formData.get('role') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 300);
  const useDefaults = formData.get('use_defaults') === 'on';

  if (!target) return { error: 'No account was selected.' };
  if (!ROLES.includes(rawRole as StaffRole)) return { error: 'Choose a role.' };

  const role = rawRole as StaffRole;
  const granted = useDefaults
    ? ROLE_DEFAULTS[role]
    : formData.getAll('capability').map(String);

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_staff_role', {
    target,
    new_role: role,
    review_evidence: granted.includes('review_evidence'),
    manage_businesses: granted.includes('manage_businesses'),
    manage_organisations: granted.includes('manage_organisations'),
    view_commercial: granted.includes('view_commercial'),
    view_audit: granted.includes('view_audit'),
    new_note: note,
  });

  if (error) {
    /* The function raises `insufficient_privilege` for the cases worth naming
       (not an owner, changing your own role) with a message written to be read
       by a person, so it is passed through rather than replaced. */
    return { error: error.message };
  }

  /* Who gained access to every organisation on the platform, and who granted
     it, is exactly what the trail exists for. Marked `alert` so it does not
     scroll past among ordinary traffic. */
  await recordEvent({
    action: 'staff.role_changed',
    entityType: 'profile',
    entityId: target,
    severity: 'alert',
    detail: { role, capabilities: granted.join(', ') || 'none' },
  });

  revalidatePath('/admin/staff');
  return { message: 'Saved.' };
}

export async function removeStaff(_prev: StaffState, formData: FormData): Promise<StaffState> {
  const target = String(formData.get('user_id') ?? '');
  if (!target) return { error: 'No account was selected.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_staff_member', { target });

  if (error) return { error: error.message };

  await recordEvent({
    action: 'staff.removed',
    entityType: 'profile',
    entityId: target,
    severity: 'alert',
  });

  revalidatePath('/admin/staff');
  return { message: 'Staff access removed.' };
}

/**
 * Invite somebody who does not have a Proven account yet.
 *
 * The picker above can only promote an account that already exists, which
 * meant telling a new colleague to go and register on their own first, then
 * report back. This closes that gap: Supabase sends them an invitation, they
 * set their own password from the link, and the role chosen here is waiting
 * when they arrive.
 *
 * Two things are deliberately NOT done here.
 *
 * No password is set on their behalf. An invite link the person redeems
 * themselves means nobody, including the owner sending it, ever knows their
 * password — which is the whole point of them having their own account.
 *
 * The role is applied through `set_staff_role` like every other change, rather
 * than by writing `is_platform_admin` directly with the service key. The
 * database check that the caller is an owner therefore still runs, so this
 * path cannot be used to grant access the caller could not grant anyway.
 */
export async function inviteStaff(_prev: StaffState, formData: FormData): Promise<StaffState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const rawRole = String(formData.get('role') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 300);

  if (!email) return { error: 'Enter an email address.' };
  if (!z.string().email().safeParse(email).success) {
    return { error: 'Enter a valid email address.' };
  }
  if (!ROLES.includes(rawRole as StaffRole)) return { error: 'Choose a role.' };
  const role = rawRole as StaffRole;

  /* Checked before the invitation is sent, so a caller who is not an owner
     cannot use this to find out whether an address has an account, nor make
     Proven send mail on their behalf. The database refuses the role change
     below regardless; this refuses the email too. */
  const supabase = await createClient();
  const { data: isOwner } = await supabase.rpc('is_staff_owner');
  if (!isOwner) return { error: 'Only a Proven owner can invite staff.' };

  const admin = createAdminClient();
  const requestHeaders = await headers();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteOrigin(requestHeaders)}/auth/callback?next=/admin`,
  });

  if (error) {
    /* The common case by far: they already have an account, so the picker
       above is the right tool and saying so is more useful than the raw
       message from the auth server. */
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

  /* Through the same guarded function as every other role change. */
  const { error: roleError } = await supabase.rpc('set_staff_role', {
    target: invited.id,
    new_role: role,
    review_evidence: ROLE_DEFAULTS[role].includes('review_evidence'),
    manage_businesses: ROLE_DEFAULTS[role].includes('manage_businesses'),
    manage_organisations: ROLE_DEFAULTS[role].includes('manage_organisations'),
    view_commercial: ROLE_DEFAULTS[role].includes('view_commercial'),
    view_audit: ROLE_DEFAULTS[role].includes('view_audit'),
    new_note: note,
  });

  if (roleError) {
    /* The account exists but holds no role, so it has no staff access. Worth
       saying plainly rather than reporting a success that is only half true. */
    return {
      error: `They were invited, but the role could not be set: ${roleError.message}. Find them in the list and set it by hand.`,
    };
  }

  await recordEvent({
    action: 'staff.invited',
    entityType: 'profile',
    entityId: invited.id,
    severity: 'alert',
    detail: { email, role },
  });

  revalidatePath('/admin/staff');
  return {
    message: `Invitation sent to ${email}. They will set their own password from the link, and land here as ${role}.`,
  };
}
