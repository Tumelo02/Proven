import 'server-only';

import { notFound } from 'next/navigation';
import {
  getAdminIntelligence,
  getCurrentProfile,
  getMyStaffAccess,
  getPendingReviewCount,
} from '@/lib/queries';
import type { AdminIntelligence } from '@/lib/queries';
import type { Profile } from '@/lib/database.types';
import type { AdminTab } from './admin-shell';

/* Stands in when a page does not need the platform-wide scoring. The drawer's
   alert badge is then only the evidence queue, which is the part that page can
   still act on; overstating it would be worse than understating it. */
const EMPTY_INTELLIGENCE: AdminIntelligence = {
  rows: [],
  enrolment: [],
  documentsPending: 0,
  documentsVerified: 0,
  documentsRejected: 0,
  pendingLinks: 0,
};

/**
 * The staff check every admin screen starts with, plus the counts the drawer
 * badges need.
 *
 * `notFound()` rather than a redirect or a "forbidden" message, matching the
 * rest of the panel: a stranger should not be able to learn that these routes
 * exist. It is also the second guard, not the only one — row-level security
 * returns nothing to a non-admin regardless of what renders.
 */
export async function requireAdmin(options?: { intelligence?: boolean }): Promise<{
  profile: Profile;
  /**
   * Platform-wide scoring. Only fetched when a page asks for it: it reads
   * five tables whole, so pages that never touch it (organisations, staff,
   * the audit trail) should not pay for it on every load.
   */
  intel: AdminIntelligence;
  badges: { alerts: number; evidence: number; health: number };
  access: Awaited<ReturnType<typeof getMyStaffAccess>>;
  /** Tabs to leave out of the drawer for this account. */
  hide: AdminTab[];
}> {
  const profile = await getCurrentProfile();
  if (!profile?.is_platform_admin) notFound();

  const wantsIntel = options?.intelligence !== false;

  const [intel, pendingReviews, access] = await Promise.all([
    wantsIntel ? getAdminIntelligence() : Promise.resolve(EMPTY_INTELLIGENCE),
    getPendingReviewCount(),
    getMyStaffAccess(),
  ]);

  const silent = intel.rows.filter((r) => r.months === 0).length;
  const late = intel.rows.filter((r) => r.reportingState === 'overdue').length;
  const atRisk = intel.rows.filter((r) => r.tier === 'red').length;

  /* Hiding a tab is a courtesy, not the control. The page behind each of these
     makes its own check, and the database refuses the write regardless — this
     only keeps the menu honest about what this account can actually use. */
  const hide: AdminTab[] = [];
  if (!access.isOwner) hide.push('staff');
  if (!access.can.review_evidence) hide.push('evidence');
  if (!access.can.view_audit) hide.push('audit');
  if (!access.can.manage_organisations) hide.push('organisations');

  return {
    profile,
    intel,
    access,
    hide,
    badges: {
      /* Everything a person would actually have to do something about. */
      alerts: pendingReviews + intel.pendingLinks + silent + late,
      evidence: pendingReviews,
      health: atRisk,
    },
  };
}
