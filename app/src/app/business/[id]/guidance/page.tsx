import { notFound, redirect } from 'next/navigation';
import { getBusinessShell, getMyOrganisations, getScoredBusiness } from '@/lib/queries';
import { EntrepreneurShell } from '../shell';
import { Panel, RecCard } from '@/components/workspace';
import '../../../workspace.css';

export default async function GuidancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [shell, orgs] = await Promise.all([getBusinessShell(id), getMyOrganisations()]);

  if (!shell) notFound();
  if (!shell.periods.length) redirect(`/business/${id}`);

  const scored = await getScoredBusiness(id);

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
