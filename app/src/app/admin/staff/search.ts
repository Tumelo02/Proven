'use server';

/**
 * Account lookup for the add-staff picker.
 *
 * A Server Action rather than a preloaded list: the platform's whole user
 * table has no business being shipped to the browser so that a search box can
 * filter it. Only matches are returned, only for a term of at least three
 * characters, and only for accounts that are not already staff.
 *
 * Guarded on the server as well. `getMyStaffAccess` decides whether the caller
 * is an owner, so calling this from a limited admin's session returns nothing
 * rather than a list of addresses.
 */

import { findProfilesByEmail, getMyStaffAccess } from '@/lib/queries';

export interface FoundAccount {
  id: string;
  email: string;
  fullName: string;
}

export async function searchAccounts(term: string): Promise<FoundAccount[]> {
  const { isOwner } = await getMyStaffAccess();
  if (!isOwner) return [];

  const profiles = await findProfilesByEmail(term);
  return profiles.map((p) => ({ id: p.id, email: p.email, fullName: p.full_name }));
}
