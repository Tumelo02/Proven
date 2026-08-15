import { notFound } from 'next/navigation';
import { milestoneProgress } from '@proven/engine';
import {
  getBusinessShell,
  getBusinessLinks,
  getLogoUrls,
  getMyOrganisations,
  getScoredBusiness,
} from '@/lib/queries';
import { EntrepreneurShell } from '../shell';
import { Panel } from '@/components/workspace';
import { MilestoneRow } from './milestone-row';
import type { OrgType } from '@/lib/database.types';
import '../../../workspace.css';

const ORG_TYPE_LABEL: Record<OrgType, string> = {
  funder: 'Funder',
  incubator: 'Incubator',
  accelerator: 'Accelerator',
  government: 'Government',
  other: 'Supporter',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default async function MilestonesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [shell, links, orgs, scored] = await Promise.all([
    getBusinessShell(id),
    getBusinessLinks(id),
    getMyOrganisations(),
    getScoredBusiness(id),
  ]);
  if (!shell) notFound();

  const orgLogos = await getLogoUrls(links.map((l) => l.organisations.logo_path));

  const progress = milestoneProgress(
    shell.milestones.map((m) => ({ label: m.label, status: m.status })),
  );

  return (
    <EntrepreneurShell
      businessId={id}
      active="milestones"
      showSwitchRole={orgs.length > 0}
      {...(scored
        ? {
            guidanceCount: scored.guidance.length,
            guidanceAlarm: scored.guidance.some((g) => g.sev === 'red' || g.sev === 'yellow'),
          }
        : {})}
    >
      <Panel title="Stages" hint={`${progress}% complete`}>
        {shell.milestones.map((m, i) => (
          <MilestoneRow key={m.id} milestone={m} businessId={id} index={i} />
        ))}
      </Panel>

      <div style={{ marginTop: 16 }}>
        <Panel title="Funding" hint="Who funds this business">
          {links.length === 0 ? (
            <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
              This business is not linked to a funder. It tracks and scores
              exactly the same way, and the record it builds is what you can
              take to a funder later.
            </p>
          ) : (
            links.map((l) => (
              <div
                key={l.id}
                className="row between"
                style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}
              >
                {/* The mark and the kind of organisation, not just a name: an
                    entrepreneur sharing their figures should recognise exactly
                    who they are sharing them with. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="org-mark">
                    {l.organisations.logo_path && orgLogos[l.organisations.logo_path] ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- signed URL */
                      <img src={orgLogos[l.organisations.logo_path]} alt="" />
                    ) : (
                      initials(l.organisations.name)
                    )}
                  </div>
                  <div>
                    <strong>{l.organisations.name}</strong>
                    <div className="muted tiny">
                      {ORG_TYPE_LABEL[l.organisations.org_type]}
                      {l.amount
                        ? ` · R${Number(l.amount).toLocaleString('en-ZA')}`
                        : ''}
                    </div>
                  </div>
                </div>
                <span
                  className={`chip ${
                    l.status === 'confirmed'
                      ? 'green'
                      : l.status === 'rejected'
                        ? 'red'
                        : 'yellow'
                  }`}
                >
                  <span className="dot" />
                  {l.status === 'confirmed'
                    ? 'Confirmed'
                    : l.status === 'rejected'
                      ? 'Not confirmed'
                      : 'Waiting for them to confirm'}
                </span>
              </div>
            ))
          )}
        </Panel>
      </div>
    </EntrepreneurShell>
  );
}
