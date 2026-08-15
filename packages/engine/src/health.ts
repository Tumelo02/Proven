/**
 * Health score: "is this business healthy right now?"
 *
 * A plain weighted average of four factors, every one of which can be shown on
 * screen. No machine learning, no hidden logic, deliberately: a funder has to be
 * able to explain a score to the entrepreneur it describes.
 */

import { clamp, round1 } from './format.ts';
import type {
  BusinessInput,
  HealthFactors,
  HealthResult,
  Period,
  ReportStatus,
  Tier,
  Trend,
} from './types.ts';

export const WEIGHTS = {
  revenue: 0.35,
  expense: 0.25,
  consistency: 0.2,
  customers: 0.2,
} as const;

export function tierOf(score: number): Tier {
  return score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';
}

export function tierLabel(t: Tier): string {
  return t === 'green' ? 'Healthy' : t === 'yellow' ? 'Watch' : 'At Risk';
}

/** A late update is worth half an on-time one; a missed update is worth nothing. */
export function statusPoints(s: ReportStatus): number {
  return s === 'on-time' ? 1 : s === 'late' ? 0.5 : 0;
}

/**
 * Growth of the last three months against the three before them. Comparing
 * windows rather than single months stops one unusual month from swinging the
 * score on its own.
 */
export function windowGrowth(history: Period[], key: 'revenue' | 'expenses' | 'customers'): number {
  const n = history.length;
  const recent = history.slice(-3);
  const prior = history.slice(Math.max(0, n - 6), Math.max(0, n - 3));
  if (!prior.length || !recent.length) return 0;
  const avg = (a: Period[]): number => a.reduce((s, x) => s + x[key], 0) / a.length;
  const p = avg(prior);
  return p === 0 ? 0 : (avg(recent) - p) / p;
}

/** Flat growth sits at 55, so a steady business scores as adequate, not failing. */
export function revenueFactor(g: number): number {
  return clamp(55 + g * 300, 0, 100);
}

/** Full marks until expenses pass 60% of revenue, then falls away steeply. */
export function expenseFactor(ratio: number): number {
  return clamp(100 - Math.max(0, ratio - 0.6) * 200, 0, 100);
}

export function consistencyFactor(hist: Period[]): number {
  const w = hist.slice(-6);
  const s = w.reduce((acc, p) => acc + statusPoints(p.status), 0);
  return w.length ? (s / w.length) * 100 : 0;
}

export function customerFactor(g: number): number {
  return clamp(55 + g * 300, 0, 100);
}

export function computeHealth(biz: Pick<BusinessInput, 'history'>): HealthResult {
  const h = biz.history;
  const revGrowth = windowGrowth(h, 'revenue');
  const custGrowth = windowGrowth(h, 'customers');
  const expGrowth = windowGrowth(h, 'expenses');

  const last3 = h.slice(-3);
  let rev = 0;
  let exp = 0;
  for (const p of last3) {
    rev += p.revenue;
    exp += p.expenses;
  }
  rev /= last3.length;
  exp /= last3.length;

  /* No revenue at all is treated as a ratio of 2, i.e. bottomed out, rather
     than dividing by zero. */
  const ratio = rev === 0 ? 2 : exp / rev;

  const f: HealthFactors = {
    revenue: revenueFactor(revGrowth),
    expense: expenseFactor(ratio),
    consistency: consistencyFactor(h),
    customers: customerFactor(custGrowth),
  };

  const score = round1(
    f.revenue * WEIGHTS.revenue +
      f.expense * WEIGHTS.expense +
      f.consistency * WEIGHTS.consistency +
      f.customers * WEIGHTS.customers,
  );

  const w6 = h.slice(-6);
  let onTime = 0;
  let late = 0;
  let missed = 0;
  for (const p of w6) {
    if (p.status === 'on-time') onTime++;
    else if (p.status === 'late') late++;
    else missed++;
  }

  return {
    score,
    tier: tierOf(score),
    factors: f,
    revGrowth,
    expGrowth,
    custGrowth,
    ratio,
    onTime,
    late,
    missed,
    periods: w6.length,
    avgRevenue: rev,
    avgExpenses: exp,
  };
}

/** The score as it stood at a given month, used to draw the history chart. */
export function healthAt(biz: Pick<BusinessInput, 'history'>, endIndex: number): HealthResult {
  return computeHealth({ history: biz.history.slice(0, endIndex + 1) });
}

export function scoreDelta(biz: Pick<BusinessInput, 'history'>): number {
  if (biz.history.length < 2) return 0;
  return round1(computeHealth(biz).score - healthAt(biz, biz.history.length - 2).score);
}

/** A 1.5-point dead band, so ordinary month-to-month noise reads as flat. */
export function trendOf(biz: Pick<BusinessInput, 'history'>): Trend {
  const d = scoreDelta(biz);
  return d > 1.5 ? 'up' : d < -1.5 ? 'down' : 'flat';
}
