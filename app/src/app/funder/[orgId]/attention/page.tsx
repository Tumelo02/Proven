import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  fundingUtilisation,
  money,
  reportingStatus,
  tierLabel,
} from '@proven/engine';
import { getMyOrganisations, getPendingLinkRequests, getPortfolio } from '@/lib/queries';
import { FunderShell } from '../shell';
import '../../../workspace.css';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Everything flagged right now, with the reason and what the owner was told.
 *
 * Cards rather than table rows, because a funder deciding whether to act needs
 * the score, the reasons and the guidance the entrepreneur received all in one
 * place. A row can carry the score; it cannot carry the argument.
 */
export default async function AttentionPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const orgs = await getMyOrganisations();
  const membership = orgs.find((o) => o.org.id === orgId);
  if (!membership) notFound();

  const [portfolio, pending] = await Promise.all([
    getPortfolio(orgId),
    getPendingLinkRequests(orgId),
  ]);

  /* Lowest score first: the business needing most support is read first. */
  const flagged = portfolio
    .filter((b) => b.health.tier !== 'green')
    .sort((a, b) => a.health.score - b.health.score);

  return (
    <FunderShell
      orgId={orgId}
      orgName={membership.org.name}
      active="attention"
      title="Needs attention"
      sub="Everything flagged right now, with the reason and what the owner was told"
      attentionCount={flagged.length}
      requestCount={pending.length}
    >
      {flagged.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <div style={{ textAlign: 'center', padding: '34px 18px', color: 'var(--muted)' }}>
              <div style={{ fontSize: 26, opacity: 0.35, marginBottom: 6 }}>✓</div>
              Nothing needs attention right now. Every business is in the healthy
              band.
            </div>
          </div>
        </div>
      ) : (
        <div className="att-list">
          {flagged.map((b) => {
            const rep = reportingStatus(b.input);
            const util = fundingUtilisation(b.input.milestones);
            return (
              <div key={b.business.id} className={`att-card ${b.health.tier}`}>
                <div className="att-head">
                  <div className="avatar">{initials(b.business.name)}</div>
                  <div className="att-who">
                    <Link
                      className="nm"
                      href={`/funder/${orgId}/business/${b.business.id}`}
                    >
                      {b.business.name}
                    </Link>
                    <div className="tiny muted">
                      {[b.business.industry, b.business.region].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="att-score">
                    <span className={`scorenum ${b.health.tier}`}>{b.health.score}</span>
                    <span className={`chip ${b.health.tier}`}>
                      <span className="dot" />
                      {tierLabel(b.health.tier)}
                    </span>
                  </div>
                </div>

                {/* The same guidance the entrepreneur is reading, so both sides
                    are working from one account of what is wrong. */}
                <ul className="att-why">
                  {b.guidance.slice(0, 2).map((g, i) => (
                    <li key={i} className={g.sev}>
                      <b>{g.issue}</b>
                      <span>{g.rec}</span>
                    </li>
                  ))}
                </ul>

                <div className="att-foot">
                  <span className={`due-pill ${rep.state}`}>{rep.label}</span>
                  <span className="tiny muted">
                    {b.fundingAmount ? `${money(b.fundingAmount)} granted · ` : ''}
                    {util}% released
                  </span>
                  <span className="spacer" />
                  <Link
                    className="btn ghost sm"
                    href={`/funder/${orgId}/business/${b.business.id}`}
                  >
                    Open record
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </FunderShell>
  );
}
