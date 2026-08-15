import { notFound } from 'next/navigation';
import { getMyOrganisations, getScoredBusiness } from '@/lib/queries';
import { EntrepreneurShell } from '../shell';
import { Panel, RecCard } from '@/components/workspace';
import '../../../workspace.css';

export default async function GuidancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [scored, orgs] = await Promise.all([getScoredBusiness(id), getMyOrganisations()]);

  if (!scored) notFound();

  const { guidance } = scored;

  return (
    <EntrepreneurShell
      businessId={id}
      active="guidance"
      showSwitchRole={orgs.length > 0}
      guidanceCount={guidance.length}
      guidanceAlarm={guidance.some((g) => g.sev === 'red' || g.sev === 'yellow')}
    >
      <Panel title="What to do next" hint="Based on how your business is doing right now">
        {guidance.map((g, i) => (
          <RecCard key={i} g={g} />
        ))}
      </Panel>

    </EntrepreneurShell>
  );
}
