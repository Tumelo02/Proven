/**
 * Proven scoring and guidance engine.
 *
 * Pure functions over a business's reported history: no database, no network,
 * no AI. The same code runs in the browser prototype and on the server, so a
 * score shown to an entrepreneur and the same score shown to their funder can
 * never drift apart.
 */

export * from './types.ts';
export { money, moneyShort, pct, clamp, round1 } from './format.ts';
export {
  WEIGHTS,
  tierOf,
  tierLabel,
  statusPoints,
  windowGrowth,
  revenueFactor,
  expenseFactor,
  consistencyFactor,
  customerFactor,
  computeHealth,
  healthAt,
  scoreDelta,
  trendOf,
} from './health.ts';
export {
  CREDIT_WEIGHTS,
  CR_BANDS,
  computeCredit,
  creditReadiness,
  weakestFactorPhrase,
  decisionFor,
} from './credit.ts';
export { getGuidance } from './guidance.ts';
export {
  monthLabel,
  fmtDate,
  fundingUtilisation,
  milestoneProgress,
  currentMilestone,
  reportingStatus,
  evidenceCoverage,
} from './reporting.ts';
export type { ReportingState, ReportingStatus, EvidenceCoverage } from './reporting.ts';
export {
  num,
  periodFromRow,
  milestoneFromRow,
  transactionFromRow,
  toBusinessInput,
} from './db.ts';
export type {
  BusinessRow,
  ReportingPeriodRow,
  TransactionRow,
  MilestoneRow,
  ScoreSnapshotRow,
  FundingStatus,
  LinkStatus,
  ReviewStatus,
  OrgRole,
} from './db.ts';
