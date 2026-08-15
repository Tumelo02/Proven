/**
 * Data shapes the scoring engine operates on.
 *
 * These mirror the rows the database will hold, not the prototype's in-memory
 * objects, so the same engine serves both: the app builds them from
 * `DEFS`, the Next.js app selects them from Postgres.
 */

/** Whether a monthly update arrived, and when. A fifth of the health score. */
export type ReportStatus = 'on-time' | 'late' | 'missed';

/** Health tiers. Colour names are kept because the UI keys off them. */
export type Tier = 'green' | 'yellow' | 'red';

/** `pending` is a stage not started yet. Matches the prototype's vocabulary. */
export type MilestoneStatus = 'done' | 'current' | 'delayed' | 'pending';

export type TransactionType = 'revenue' | 'expense';

/** One reporting month for one business: the unit the whole score is built on. */
export interface Period {
  /** ISO date, `YYYY-MM-DD`. The month this update covers. */
  date: string;
  revenue: number;
  expenses: number;
  customers: number;
  status: ReportStatus;
}

export interface Milestone {
  label: string;
  status: MilestoneStatus;
}

export interface Transaction {
  type: TransactionType;
  /** Human-readable line, quoted back in guidance so advice names a real cost. */
  desc: string;
  amount: number;
}

/**
 * Everything the engine needs about a business. Deliberately narrow: no name,
 * no owner, no funder. Scoring must not be able to depend on who a business is.
 */
export interface BusinessInput {
  history: Period[];
  milestones: Milestone[];
  ledger: Transaction[];
}

export interface HealthFactors {
  revenue: number;
  expense: number;
  consistency: number;
  customers: number;
}

export interface HealthResult {
  score: number;
  tier: Tier;
  factors: HealthFactors;
  revGrowth: number;
  expGrowth: number;
  custGrowth: number;
  /** Expenses divided by revenue over the last three months. */
  ratio: number;
  onTime: number;
  late: number;
  missed: number;
  periods: number;
  avgRevenue: number;
  avgExpenses: number;
}

export interface CreditFactors {
  trend: number;
  stability: number;
  discipline: number;
}

export interface CreditResult {
  score: number;
  factors: CreditFactors;
  avgGrowth: number;
  meanRatio: number;
  volatility: number;
  periods: number;
}

/** The four bands, in order, named exactly as the pitch deck defines them. */
export type CreditBand =
  | 'Building Track Record'
  | 'Developing'
  | 'Strong Evidence'
  | 'Credit-Ready Candidate';

export type BandColor = 'grey' | 'yellow' | 'blue' | 'green';

export interface CreditReadinessResult {
  status: CreditBand;
  /** Plain-English gloss, so the band reads without the deck to hand. */
  plain: string;
  score: number;
  reasons: string[];
  color: BandColor;
}

export type DecisionKind = 'release' | 'hold' | 'escalate';

export interface Decision {
  kind: DecisionKind;
  action: string;
  why: string;
}

export type Severity = 'red' | 'yellow' | 'green';

export interface GuidanceItem {
  sev: Severity;
  issue: string;
  rec: string;
}

export type Trend = 'up' | 'down' | 'flat';
