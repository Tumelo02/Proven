import 'server-only';

import {
  computeHealth,
  creditReadiness,
  evidenceCoverage,
  money,
  monthLabel,
  type Period,
} from '@proven/engine';
import { getBusinessShell, getTransactionsWithDocs } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export interface ReportLine {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  customers: number;
  /** What could actually be spent: lower when something has not cleared. */
  availableBalance: number | null;
}

export interface BusinessReport {
  businessName: string;
  from: string;
  to: string;
  lines: ReportLine[];
  totals: {
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
    customers: number;
    months: number;
    bestMonth: ReportLine | null;
    worstMonth: ReportLine | null;
    averageRevenue: number;
    averageExpenses: number;
    profitableMonths: number;
    lossMonths: number;
  };
  /** Where the money went, largest first, with each month broken out so the
      statement can show a category as a line across the year. */
  spending: {
    category: string;
    total: number;
    share: number;
    byMonth: Record<string, number>;
  }[];
  /** The latest reported cash position in the range. */
  latestBalance: { month: string; available: number } | null;
  score: number | null;
  readiness: string | null;
  evidencePct: number;
  generatedOn: string;
}

/** The calendar year, which is what a report means by default. */
export function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  return { from: `${year}-01`, to: now.toISOString().slice(0, 7) };
}

/**
 * A business's own financial report, for a date range.
 *
 * Built from the months the business reported, not from a separate store, so
 * the report and the dashboard can never disagree — and so a figure here can
 * always be traced back to a month the owner entered themselves.
 *
 * The range defaults to this calendar year, which is what someone means by
 * "this year's figures" when a bank or a funder asks.
 */
export async function getBusinessReport(
  businessId: string,
  from: string,
  to: string,
): Promise<BusinessReport | null> {
  const shell = await getBusinessShell(businessId);
  if (!shell) return null;

  const inRange = shell.periods.filter((p) => {
    const key = p.period_month.slice(0, 7);
    return key >= from && key <= to;
  });

  const lines: ReportLine[] = inRange.map((p) => {
    const revenue = Number(p.revenue) || 0;
    const expenses = Number(p.expenses) || 0;
    const profit = revenue - expenses;
    return {
      month: p.period_month,
      label: monthLabel(p.period_month),
      revenue,
      expenses,
      profit,
      /* Share of every rand earned that the business kept. Zero revenue has no
         margin rather than a misleading 0%. */
      margin: revenue > 0 ? profit / revenue : 0,
      customers: p.customers ?? 0,
      /* `== null` catches undefined as well as null, deliberately: before the
         balance migration runs the column is absent rather than null, and
         `Number(undefined)` is NaN — which would render as "NaN" where a bank
         balance should be. */
      availableBalance:
        p.available_balance == null ? null : Number(p.available_balance),
    };
  });

  const revenue = lines.reduce((s, l) => s + l.revenue, 0);
  const expenses = lines.reduce((s, l) => s + l.expenses, 0);
  const customers = lines.reduce((s, l) => s + l.customers, 0);

  const sorted = [...lines].sort((a, b) => b.profit - a.profit);

  /* Where the money actually went, from the entries themselves rather than the
     monthly totals: a total cannot say which cost is the one to act on. */
  const supabase = await createClient();
  const { data: txns } = await supabase
    .from('transactions')
    .select('category, amount, type, occurred_on')
    .eq('business_id', businessId)
    .eq('type', 'expense')
    .gte('occurred_on', `${from}-01`)
    .lte('occurred_on', `${to}-31`);

  const byCategory = new Map<string, { total: number; byMonth: Record<string, number> }>();
  for (const t of txns ?? []) {
    const key = (t.category || 'Uncategorised').trim() || 'Uncategorised';
    const amount = Number(t.amount) || 0;
    const month = t.occurred_on.slice(0, 7);
    const entry = byCategory.get(key) ?? { total: 0, byMonth: {} };
    entry.total += amount;
    entry.byMonth[month] = (entry.byMonth[month] ?? 0) + amount;
    byCategory.set(key, entry);
  }
  const spendTotal = [...byCategory.values()].reduce((s, v) => s + v.total, 0);
  const spending = [...byCategory.entries()]
    .map(([category, v]) => ({
      category,
      total: v.total,
      share: spendTotal > 0 ? v.total / spendTotal : 0,
      byMonth: v.byMonth,
    }))
    .sort((a, b) => b.total - a.total);

  /* The newest month in the range that reported a balance. A business that has
     not given one for the latest month should still see the last it did. */
  const withBalance = [...lines].reverse().find((l) => l.availableBalance !== null);
  const latestBalance = withBalance
    ? { month: withBalance.month, available: withBalance.availableBalance! }
    : null;

  /* Scored on the range being reported, so a report for last year is scored on
     last year rather than on today. */
  const history: Period[] = lines.map((l) => ({
    date: l.month,
    revenue: l.revenue,
    expenses: l.expenses,
    customers: l.customers,
    status: 'on-time',
  }));

  const entries = await getTransactionsWithDocs(businessId, 500);
  const coverage = evidenceCoverage(
    entries
      .filter((e) => {
        const key = e.transaction.occurred_on.slice(0, 7);
        return key >= from && key <= to;
      })
      .map((e) => ({
        amount: Number(e.transaction.amount),
        hasDocument: e.document !== null,
      })),
  );

  return {
    businessName: shell.business.name,
    from,
    to,
    lines,
    totals: {
      revenue,
      expenses,
      profit: revenue - expenses,
      margin: revenue > 0 ? (revenue - expenses) / revenue : 0,
      customers,
      months: lines.length,
      bestMonth: sorted[0] ?? null,
      worstMonth: sorted.length > 1 ? sorted[sorted.length - 1]! : null,
      averageRevenue: lines.length ? revenue / lines.length : 0,
      averageExpenses: lines.length ? expenses / lines.length : 0,
      profitableMonths: lines.filter((l) => l.profit > 0).length,
      lossMonths: lines.filter((l) => l.profit < 0).length,
    },
    spending,
    latestBalance,
    score: history.length ? computeHealth({ history }).score : null,
    readiness: history.length
      ? creditReadiness({
          history,
          milestones: shell.milestones.map((m) => ({ label: m.label, status: m.status })),
        }).status
      : null,
    evidencePct: coverage.pct,
    generatedOn: new Date().toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Africa/Johannesburg',
    }),
  };
}

/** Shared by the screen and the download, so both say the same thing. */
export function rangeLabel(from: string, to: string): string {
  return from === to
    ? monthLabel(`${from}-01`)
    : `${monthLabel(`${from}-01`)} to ${monthLabel(`${to}-01`)}`;
}

export { money };
