import { notFound } from 'next/navigation';
import { fmtDate, money } from '@proven/engine';
import { getMyOrganisations, getPendingLinkRequests, getPortfolio } from '@/lib/queries';
import { FunderShell } from '../shell';
import { LinkDecision } from '../link-decision';
import '../../../workspace.css';

export default async function RequestsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const orgs = await getMyOrganisations();
  const membership = orgs.find((o) => o.org.id === orgId);
  if (!membership) notFound();

  const [pending, portfolio] = await Promise.all([
    getPendingLinkRequests(orgId),
    getPortfolio(orgId),
  ]);

  const attention = portfolio.filter((b) => b.health.tier !== 'green').length;

  return (
    <FunderShell
      orgId={orgId}
      orgName={membership.org.name}
      active="requests"
      title="Link requests"
      sub={`Businesses asking to be recorded as funded by ${membership.org.name}`}
      attentionCount={attention}
      requestCount={pending.length}
    >
      <div className="panel">
        {pending.length === 0 ? (
          <div className="panel-body">
            <div style={{ textAlign: 'center', padding: '34px 18px', color: 'var(--muted)' }}>
              <div style={{ fontSize: 26, opacity: 0.35, marginBottom: 6 }}>●</div>
              Nothing waiting. When a business names {membership.org.name} as its
              funder, the request appears here for you to confirm.
            </div>
          </div>
        ) : (
          <>
            <div className="panel-body" style={{ paddingBottom: 0 }}>
              <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                Confirming lets this organisation read the business&rsquo;s
                figures. It does not let you change them, and it does not verify
                their evidence. Only confirm businesses you actually fund.
              </p>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Industry</th>
                    <th className="num">Amount claimed</th>
                    <th>Requested</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pending.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.businesses.name}</strong>
                        <div className="tiny muted">{r.businesses.region}</div>
                      </td>
                      <td className="muted">{r.businesses.industry}</td>
                      <td className="num mono">
                        {r.amount ? money(Number(r.amount)) : '—'}
                      </td>
                      <td className="muted tiny">{fmtDate(r.created_at.slice(0, 10))}</td>
                      <td>
                        <LinkDecision linkId={r.id} orgId={orgId} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </FunderShell>
  );
}
