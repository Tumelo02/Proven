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

/**
 * The staff check every admin screen starts with, plus the counts the drawer
 * badges need.
 *
 * `notFound()` rather than a redirect or a "forbidden" message, matching the
 * rest of the panel: a stranger should not be able to learn that these routes
 * exist. It is also the second guard, not the only one — row-level security
 * returns nothing to a non-admin regardless of what renders.
 */
export async function requireAdmin(): Promise<{
  profile: Profile;
  intel: AdminIntelligence;
  badges: { alerts: number; evidence: number; health: number };
  access: Awaited<ReturnType<typeof getMyStaffAccess>>;
  /** Tabs to leave out of the drawer for this account. */
  hide: AdminTab[];
}> {
  const profile = await getCurrentProfile();
  if (!profile?.is_platform_admin) notFound();

  const [intel, pendingReviews, access] = await Promise.all([
    getAdminIntelligence(),
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
