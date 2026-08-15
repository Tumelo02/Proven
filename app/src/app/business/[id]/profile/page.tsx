import { notFound } from 'next/navigation';
import { getBusinessProfile, getMyOrganisations } from '@/lib/queries';
import { EntrepreneurShell } from '../shell';
import { ProfileForm } from './profile-form';
import { LogoCard } from './logo-card';
import { TeamCard } from './team-card';
import { StaffCard } from './staff-card';
import '../../../workspace.css';

export default async function BusinessProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [profile, orgs] = await Promise.all([
    getBusinessProfile(id),
    getMyOrganisations(),
  ]);
  if (!profile) notFound();

  const { business, team, staffCounts, completeness, logoUrl } = profile;

  const tone =
    completeness >= 80 ? 'var(--green)' : completeness >= 45 ? 'var(--yellow)' : 'var(--red)';

  return (
    <EntrepreneurShell businessId={id} active="profile" showSwitchRole={orgs.length > 0}>
      {/* The nudge, not a gate. A profile is filled in over time, so this
          reports progress rather than blocking anything until it is done. */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-body">
          <div className="cov-head">
            <div>
              <div className="cov-title">Profile completeness</div>
              <div className="tiny muted">Shown to your funder</div>
            </div>
            <div className="cov-pct" style={{ color: tone }}>
              {completeness}%
            </div>
          </div>
          <div className="cov-bar">
            <span style={{ width: `${completeness}%`, background: tone }} />
          </div>
          <div className="cov-note">Fill in what applies to you.</div>
        </div>
      </div>

      <LogoCard businessId={id} businessName={business.name} logoUrl={logoUrl} />

      <ProfileForm business={business} />

      <TeamCard businessId={id} team={team} />

      <StaffCard businessId={id} staffCounts={staffCounts} />
    </EntrepreneurShell>
  );
}
