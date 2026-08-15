import 'server-only';

import {
  evidenceCoverage,
  fundingUtilisation,
  reportingStatus,
  tierLabel,
} from '@proven/engine';
import { getLogoUrl, getMyOrganisations, getPortfolio } from '@/lib/queries';

/**
 * The portfolio report, gathered once and shared by both export formats.
 *
 * Excel and PDF differ only in how they are drawn: if each assembled its own
 * figures they would eventually disagree, and a funder would have two reports
 * of the same portfolio that do not match.
 */

export interface ReportRow {
  name: string;
  owner: string;
  industry: string;
  region: string;
  grant: number | null;
  released: number;
  score: number;
  tier: 'green' | 'yellow' | 'red';
  band: string;
  readiness: string;
  reporting: string;
  reportingLate: boolean;
  coverage: number;
  jobs: number;
  months: number;
}

export interface ReportData {
  orgName: string;
  /** The organisation's own mark, for a report going to their board. */
  orgLogoUrl: string | null;
  generatedOn: string;
  total: number;
  totalFunding: number;
  jobs: number;
  avgScore: number;
  counts: { green: number; yellow: number; red: number };
  needAttention: number;
  rows: ReportRow[];
}

export async function getReportData(orgId: string): Promise<ReportData | null> {
  const orgs = await getMyOrganisations();
  const membership = orgs.find((o) => o.org.id === orgId);
  if (!membership) return null;

  const portfolio = await getPortfolio(orgId);

  const rows: ReportRow[] = portfolio
    /* Lowest score first, the same order as the screen: a report should open
       on what needs attention, not on alphabetical order. */
    .sort((a, b) => a.health.score - b.health.score)
    .map((b) => {
      const documented = new Set(b.documentedTransactionIds);
      const coverage = evidenceCoverage(
        b.transactions.map((t) => ({
          amount: Number(t.amount),
          hasDocument: documented.has(t.id),
        })),
      );
      const rep = reportingStatus(b.input);

      return {
        name: b.business.name,
        owner: b.business.owner_name,
        industry: b.business.industry,
        region: b.business.region,
        grant: b.fundingAmount,
        released: fundingUtilisation(b.input.milestones),
        score: b.health.score,
        tier: b.health.tier,
        band: tierLabel(b.health.tier),
        readiness: b.readiness.status,
        reporting: rep.label,
        reportingLate: rep.state === 'overdue',
        coverage: coverage.pct,
        jobs: b.business.staff_count,
        months: b.input.history.length,
      };
    });

  const counts = {
    green: rows.filter((r) => r.tier === 'green').length,
    yellow: rows.filter((r) => r.tier === 'yellow').length,
    red: rows.filter((r) => r.tier === 'red').length,
  };

  return {
    orgName: membership.org.name,
    orgLogoUrl: await getLogoUrl(membership.org.logo_path),
    generatedOn: new Date().toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    total: rows.length,
    totalFunding: rows.reduce((s, r) => s + (r.grant ?? 0), 0),
    jobs: rows.reduce((s, r) => s + r.jobs, 0),
    avgScore: rows.length
      ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length)
      : 0,
    counts,
    needAttention: counts.red + counts.yellow,
    rows,
  };
}
