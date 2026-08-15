/**
 * The reporting cycle, and progress through the four stages.
 *
 * Ported from the prototype so both sides read the same words. Numbers are due
 * on the 15th of the month after the one being reported, so an entrepreneur
 * and their funder always see the same deadline and the same lateness.
 */

import { clamp } from './format.ts';
import type { BusinessInput, Milestone } from './types.ts';

/** Where a business sits in its reporting cycle. */
export type ReportingState = 'sent' | 'ok' | 'due-soon' | 'overdue';

export interface ReportingStatus {
  /** ISO date the outstanding or next update is due. */
  due: string;
  /** Days until due. Negative when overdue. */
  days: number;
  state: ReportingState;
  sent: boolean;
  title: string;
  detail: string;
  /** Short form for a table cell or a pill. */
  label: string;
  /** The month the outstanding update covers. */
  covers: string;
}

/** `Feb 2026`. Used everywhere a person reads a month, instead of P1/P2. */
export function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** `15 Aug 2026`. */
export function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Share of the funding released so far.
 *
 * Money is drawn down as stages are reached, so this tracks progress through
 * the stages rather than totalling every running cost: six months of trading
 * expenses would exceed any grant and pin every business at 100%.
 */
export function fundingUtilisation(milestones: Milestone[]): number {
  const total = milestones.length;
  if (!total) return 0;
  const done = milestones.filter((m) => m.status === 'done').length;
  const inFlight = milestones.some((m) => m.status === 'current' || m.status === 'delayed')
    ? 0.5
    : 0;
  return clamp(Math.round(((done + inFlight) / total) * 100), 0, 100);
}

export function milestoneProgress(milestones: Milestone[]): number {
  if (!milestones.length) return 0;
  const done = milestones.filter((m) => m.status === 'done').length;
  return Math.round((done / milestones.length) * 100);
}

/** The stage being worked on now, or a closing line when they are all done. */
export function currentMilestone(milestones: Milestone[]): string {
  const m = milestones.find((x) => x.status === 'current' || x.status === 'delayed');
  return m ? m.label : 'All stages finished';
}

export interface EvidenceCoverage {
  /** Share of transaction value backed by a document, 0-100. */
  pct: number;
  backed: number;
  total: number;
  count: number;
  withProof: number;
}

/**
 * How much of what a business logs has a document behind it.
 *
 * Measured by **value**, not by entry count: ten small receipts and one
 * unevidenced payment of the same total are not equally well evidenced, and
 * counting entries would score them the same.
 *
 * Both sides see this number, so it lives in the engine rather than in either
 * interface.
 */
export function evidenceCoverage(
  entries: { amount: number; hasDocument: boolean }[],
): EvidenceCoverage {
  let total = 0;
  let backed = 0;
  let withProof = 0;

  for (const t of entries) {
    total += t.amount;
    if (t.hasDocument) {
      backed += t.amount;
      withProof++;
    }
  }

  return {
    pct: total > 0 ? Math.round((backed / total) * 100) : 0,
    backed,
    total,
    count: entries.length,
    withProof,
  };
}

/**
 * Where a business stands in its reporting cycle.
 *
 * `now` is injectable so tests are not tied to the day they run on.
 */
export function reportingStatus(
  biz: Pick<BusinessInput, 'history'>,
  now: Date = new Date(),
): ReportingStatus {
  const last = biz.history[biz.history.length - 1];

  /* No figures at all: nothing is owed yet, and the first update is what the
     business needs prompting for. */
  if (!last) {
    return {
      due: '',
      days: 0,
      state: 'due-soon',
      sent: false,
      title: 'Send your first month of figures',
      detail: 'Your score starts once you have reported a month.',
      label: 'Not started',
      covers: '',
    };
  }

  /* The deadline is the 15th of the month after the one being reported. Which
     month that is follows *today*, not the last row on file: a business whose
     records stop a year ago is not "365 days late" on one update, it simply
     has last month's figures outstanding like everyone else. Anchoring to the
     newest period would make historical demo data read as a year overdue. */
  const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15));
  const dueIso = due.toISOString().slice(0, 10);
  const days = Math.round((due.getTime() - now.getTime()) / 86400000);

  /* Has the month that this deadline covers, the one before it, been sent? */
  const covers = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const coversIso = covers.toISOString().slice(0, 10);
  const alreadySent = biz.history.some(
    (p) => p.date.slice(0, 7) === coversIso.slice(0, 7) && p.status !== 'missed',
  );

  if (alreadySent) {
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15));
    const nextIso = next.toISOString().slice(0, 10);
    const nextDays = Math.round((next.getTime() - now.getTime()) / 86400000);
    return {
      due: nextIso,
      days: nextDays,
      state: 'ok',
      sent: true,
      title: 'Everything is up to date',
      detail: `Your ${monthLabel(coversIso)} update is in. The next one is due ${fmtDate(nextIso)}.`,
      label: 'Up to date',
      covers: monthLabel(coversIso),
    };
  }

  /* Not sent yet. Either the deadline is still ahead, or it has passed and the
     update is genuinely late. */
  const state: ReportingState = days < 0 ? 'overdue' : days <= 7 ? 'due-soon' : 'ok';
  const over = Math.abs(days);

  return {
    due: dueIso,
    days,
    state,
    sent: false,
    title:
      state === 'overdue'
        ? `Your ${monthLabel(coversIso)} update is late`
        : 'Your next update is due soon',
    detail:
      state === 'overdue'
        ? `It was due ${fmtDate(dueIso)}, that is ${over} day${over === 1 ? '' : 's'} ago. ` +
          'Sending on time counts for 20% of your score.'
        : `Your ${monthLabel(coversIso)} figures are due ${fmtDate(dueIso)}` +
          ` · ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}.`,
    label:
      state === 'overdue'
        ? `${over} day${over === 1 ? '' : 's'} late`
        : days === 0
          ? 'Due today'
          : `Due in ${days} day${days === 1 ? '' : 's'}`,
    covers: monthLabel(coversIso),
  };
}
