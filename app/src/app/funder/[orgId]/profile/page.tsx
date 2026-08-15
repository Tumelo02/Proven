import { notFound } from 'next/navigation';
import {
  getMyOrganisations,
  getOrgProfile,
  getPendingLinkRequests,
  getPortfolio,
} from '@/lib/queries';
import { FunderShell } from '../shell';
import { Kpi } from '@/components/workspace';
import { OrgProfileForm } from './org-form';
import '../../../workspace.css';

export default async function OrgProfilePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const orgs = await getMyOrganisations();
  const membership = orgs.find((o) => o.org.id === orgId);
  if (!membership) notFound();

  const [profile, portfolio, pending] = await Promise.all([
    getOrgProfile(orgId),
    getPortfolio(orgId),
    getPendingLinkRequests(orgId),
  ]);
  if (!profile) notFound();

  const attention = portfolio.filter((b) => b.health.tier !== 'green').length;

  /* Read back from the portfolio rather than stored: a count kept in a profile
     row is wrong the moment a business is added. */
  const jobs = portfolio.reduce((s, b) => s + b.business.staff_count, 0);
  const deployed = portfolio.reduce((s, b) => s + (b.fundingAmount ?? 0), 0);

  return (
    <FunderShell
      orgId={orgId}
      orgName={membership.org.name}
      active="profile"
      title="Organisation profile"
      sub={profile.isAdmin ? undefined : 'Read-only, an admin can edit this'}
      attentionCount={attention}
      requestCount={pending.length}
    >
      <div className="kpis">
        <Kpi label="Businesses" value={profile.businessCount} foot="confirmed links" />
        <Kpi label="Jobs supported" value={jobs} foot="across the portfolio" />
        <Kpi
          label="Deployed"
          value={deployed ? `R${Math.round(deployed / 1000)}k` : '—'}
          foot="total funding recorded"
        />
        <Kpi label="Requests waiting" value={pending.length} foot="businesses asking to link" />
      </div>

      <OrgProfileForm
        org={profile.org}
        contact={profile.contact}
        logoUrl={profile.logoUrl}
        canEdit={profile.isAdmin}
      />
    </FunderShell>
  );
}
