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
import { createClient } from '@/lib/supabase/server';
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
