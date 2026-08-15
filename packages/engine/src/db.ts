/**
 * Database row shapes, and the adapters that turn them into engine inputs.
 *
 * The engine deliberately knows nothing about Postgres: it takes plain arrays
 * of numbers. These functions are the seam between the two, and they are the
 * only place that has to change if a column is renamed.
 *
 * Numeric columns arrive from the Supabase client as strings, because
 * JavaScript's number type cannot hold `numeric(14,2)` faithfully. Converting
 * in one place stops `"48000" + 1` turning into `"480001"` somewhere in a view.
 */

import type {
  BusinessInput,
  Milestone,
  MilestoneStatus,
  Period,
  ReportStatus,
  Transaction,
  TransactionType,
} from './types.ts';

export type FundingStatus = 'unfunded' | 'applicant' | 'funded' | 'exited';
export type LinkStatus = 'pending' | 'confirmed' | 'rejected';
export type ReviewStatus = 'pending' | 'verified' | 'rejected';
export type OrgRole = 'member' | 'admin';

/** Postgres `numeric` columns cross the wire as strings. */
type Numeric = string | number;

export interface BusinessRow {
  id: string;
  owner_id: string;
  name: string;
  industry: string;
  region: string;
  funding_status: FundingStatus;
  started_on: string | null;
  staff_count: number;
  team_roles: string;
  created_at: string;
}

export interface ReportingPeriodRow {
  id: string;
  business_id: string;
  period_month: string;
  revenue: Numeric;
  expenses: Numeric;
  customers: number;
  status: ReportStatus;
  submitted_at: string | null;
}

export interface TransactionRow {
  id: string;
  business_id: string;
  period_id: string | null;
  type: TransactionType;
  description: string;
  category: string;
  amount: Numeric;
  occurred_on: string;
}

export interface MilestoneRow {
  id: string;
  business_id: string;
  label: string;
  status: MilestoneStatus;
  sort_order: number;
  target_date: string | null;
  completed_on: string | null;
}

export interface ScoreSnapshotRow {
  id: string;
  business_id: string;
  computed_at: string;
  health_score: Numeric;
  health_tier: 'green' | 'yellow' | 'red';
  health_factors: Record<string, number>;
  credit_score: Numeric;
  credit_band: string;
  engine_version: string;
}

/** `numeric` as string to a number, with a safe default for null columns. */
export function num(value: Numeric | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function periodFromRow(row: ReportingPeriodRow): Period {
  return {
    date: row.period_month,
    revenue: num(row.revenue),
    expenses: num(row.expenses),
    customers: row.customers,
    status: row.status,
  };
}

export function milestoneFromRow(row: MilestoneRow): Milestone {
  return { label: row.label, status: row.status };
}

export function transactionFromRow(row: TransactionRow): Transaction {
  return {
    type: row.type,
    desc: row.description,
    amount: num(row.amount),
  };
}

/**
 * Assembles the engine's input from database rows.
 *
 * Periods are sorted oldest-first and milestones by their stage order: the
 * engine compares the last three months against the three before, so rows
 * arriving newest-first would invert every growth figure it produces.
 */
export function toBusinessInput(rows: {
  periods: ReportingPeriodRow[];
  milestones: MilestoneRow[];
  transactions: TransactionRow[];
}): BusinessInput {
  const periods = [...rows.periods].sort((a, b) =>
    a.period_month.localeCompare(b.period_month),
  );
  const milestones = [...rows.milestones].sort((a, b) => a.sort_order - b.sort_order);

  /* Guidance names the largest cost of the latest month, so only that month's
     entries belong in the ledger. */
  const latest = periods[periods.length - 1];
  const ledger = latest
    ? rows.transactions.filter(
        (t) => t.period_id === latest.id || t.occurred_on.startsWith(latest.period_month.slice(0, 7)),
      )
    : [];

  return {
    history: periods.map(periodFromRow),
    milestones: milestones.map(milestoneFromRow),
    ledger: ledger.map(transactionFromRow),
  };
}
