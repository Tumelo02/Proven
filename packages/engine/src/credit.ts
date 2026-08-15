/**
 * Credit readiness: "has this business proven itself over time?"
 *
 * Distinct from the health score, which asks only about right now. This one
 * rewards a sustained record, and is evidence to support a human credit
 * decision, never an automatic approval. Nothing in the product may claim
 * otherwise.
 */

import { clamp, pct, round1 } from './format.ts';
import { computeHealth, statusPoints } from './health.ts';
import type {
  BandColor,
  BusinessInput,
  CreditBand,
  CreditReadinessResult,
  CreditResult,
  Decision,
  HealthResult,
} from './types.ts';

export const CREDIT_WEIGHTS = {
  trend: 0.4,
  stability: 0.35,
  discipline: 0.25,
} as const;

/** The four bands in order, named exactly as the pitch deck defines them. */
export const CR_BANDS: readonly CreditBand[] = [
  'Building Track Record',
  'Developing',
  'Strong Evidence',
  'Credit-Ready Candidate',
];

export function computeCredit(biz: Pick<BusinessInput, 'history'>): CreditResult {
  const h = biz.history;

  /* Month-on-month growth across the whole record, not just the recent window:
     credit readiness is about the long run. */
  const growths: number[] = [];
  for (let i = 1; i < h.length; i++) {
    const p = h[i - 1]!.revenue || 1;
    growths.push((h[i]!.revenue - p) / p);
  }
  const avgG = growths.length ? growths.reduce((a, b) => a + b, 0) / growths.length : 0;
  const trend = clamp(40 + avgG * 1500, 0, 100);

  /* Stability penalises both a high expense ratio and a volatile one: a
     business whose costs swing unpredictably is harder to lend to than one
     whose costs are merely high. */
  const ratios = h.map((x) => x.expenses / (x.revenue || 1));
  const meanR = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const varR = Math.sqrt(
    ratios.reduce((s, r) => s + Math.pow(r - meanR, 2), 0) / ratios.length,
  );
  const stability = clamp(100 - Math.max(0, meanR - 0.6) * 200 - varR * 300, 0, 100);

  const pts = h.reduce((s, x) => s + statusPoints(x.status), 0);
  const discipline = (pts / h.length) * 100;

  const score = round1(
    trend * CREDIT_WEIGHTS.trend +
      stability * CREDIT_WEIGHTS.stability +
      discipline * CREDIT_WEIGHTS.discipline,
  );

  return {
    score,
    factors: { trend, stability, discipline },
    avgGrowth: avgG,
    meanRatio: meanR,
    volatility: varR,
    periods: h.length,
  };
}

export function creditReadiness(
  biz: Pick<BusinessInput, 'history' | 'milestones'>,
): CreditReadinessResult {
  const cr = computeCredit(biz);
  const periods = biz.history.length;
  const done = biz.milestones.filter((m) => m.status === 'done').length;
  const last = biz.history[biz.history.length - 1]!;
  const cashPositive = last.revenue - last.expenses > 0;

  const reasons: string[] = [
    `${periods} month${periods === 1 ? '' : 's'} of numbers on record`,
    cr.avgGrowth > 0.005
      ? `Sales growing by about ${pct(cr.avgGrowth, 1)} a month`
      : 'Sales are not growing steadily yet',
    cr.meanRatio <= 0.75
      ? 'Spending has stayed under control'
      : 'Spending is high compared with what comes in',
    `${done} of ${biz.milestones.length} stages finished`,
    cashPositive ? 'Earning more than it spends' : 'Spending more than it earns right now',
  ];

  /* A short record can never reach the top bands however good it looks: four
     months of good numbers is not yet a track record. */
  let status: CreditBand;
  let plain: string;
  if (periods < 4 || cr.score < 45) {
    status = 'Building Track Record';
    plain = 'Still early, not enough history yet';
  } else if (cr.score < 62) {
    status = 'Developing';
    plain = 'Coming along, with more to prove';
  } else if (cr.score < 80) {
    status = 'Strong Evidence';
    plain = 'A solid record is building up';
  } else {
    status = 'Credit-Ready Candidate';
    plain = 'Ready for a funding conversation';
  }

  const color: BandColor =
    status === 'Building Track Record'
      ? 'grey'
      : status === 'Developing'
        ? 'yellow'
        : status === 'Strong Evidence'
          ? 'blue'
          : 'green';

  return { status, plain, score: cr.score, reasons, color };
}

/** Names the weakest factor, so a low score always points somewhere specific. */
export function weakestFactorPhrase(health: HealthResult): string {
  const names: Record<keyof HealthResult['factors'], string> = {
    revenue: 'Sales are the biggest problem',
    expense: 'Spending is the biggest problem',
    consistency: 'Late or missed updates are the biggest problem',
    customers: 'Losing customers is the biggest problem',
  };
  let worst: keyof HealthResult['factors'] | null = null;
  let worstVal = Infinity;
  for (const k of Object.keys(health.factors) as (keyof HealthResult['factors'])[]) {
    if (health.factors[k] < worstVal) {
      worstVal = health.factors[k];
      worst = k;
    }
  }
  return `${names[worst!]} at ${Math.round(worstVal)}/100.`;
}

/** The funder-facing call to action for a business, derived from its tier. */
export function decisionFor(biz: Pick<BusinessInput, 'history'>): Decision {
  const health = computeHealth(biz);
  if (health.tier === 'green') {
    return {
      kind: 'release',
      action: 'Doing well. Keep going',
      why: `A score of ${health.score} is healthy. Sales and customers are both moving in the right direction.`,
    };
  }
  if (health.tier === 'yellow') {
    return {
      kind: 'hold',
      action: 'Needs a check-in',
      why: `A score of ${health.score} means keep an eye on this one. ${weakestFactorPhrase(health)}`,
    };
  }
  return {
    kind: 'escalate',
    action: 'Needs attention now',
    why: `A score of ${health.score} is low. ${weakestFactorPhrase(health)}`,
  };
}
