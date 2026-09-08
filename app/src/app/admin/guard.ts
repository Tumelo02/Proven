import 'server-only';

import { notFound } from 'next/navigation';
import { getAdminIntelligence, getCurrentProfile, getPendingReviewCount } from '@/lib/queries';
import type { AdminIntelligence } from '@/lib/queries';
import type { Profile } from '@/lib/database.types';

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
}> {
  const profile = await getCurrentProfile();
  if (!profile?.is_platform_admin) notFound();

  const [intel, pendingReviews] = await Promise.all([
    getAdminIntelligence(),
    getPendingReviewCount(),
  ]);

  const silent = intel.rows.filter((r) => r.months === 0).length;
  const late = intel.rows.filter((r) => r.reportingState === 'overdue').length;
  const atRisk = intel.rows.filter((r) => r.tier === 'red').length;

  return {
    profile,
    intel,
    badges: {
      /* Everything a person would actually have to do something about. */
      alerts: pendingReviews + intel.pendingLinks + silent + late,
      evidence: pendingReviews,
      health: atRisk,
    },
  };
}
