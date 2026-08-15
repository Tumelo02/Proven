/**
 * The reporting cycle is date arithmetic, which is easy to get subtly wrong
 * and hard to notice: an off-by-one here shows a business as late when it is
 * not, which is exactly the accusation the product must never make carelessly.
 *
 * `now` is injected throughout, so these assertions do not change with the day
 * the suite happens to run on.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  currentMilestone,
  fmtDate,
  fundingUtilisation,
  milestoneProgress,
  monthLabel,
  reportingStatus,
  evidenceCoverage,
} from './reporting.ts';
import { healthyBusiness, atRiskBusiness, milestoneSet } from './fixtures.ts';
import type { BusinessInput } from './types.ts';

/* The fixtures' last reported month is June 2025, so updates are due 15 July. */
const JULY_10 = new Date('2025-07-10T12:00:00Z');
const JULY_20 = new Date('2025-07-20T12:00:00Z');
const JUNE_20 = new Date('2025-06-20T12:00:00Z');

describe('month and date formatting', () => {
  test('months read as words, never as P1', () => {
    assert.equal(monthLabel('2025-06-01'), 'Jun 2025');
    assert.equal(monthLabel('2025-01-15'), 'Jan 2025');
  });

  test('dates read the way a person writes them', () => {
    assert.equal(fmtDate('2025-07-15'), '15 Jul 2025');
  });
});

describe('progress through the stages', () => {
  test('counts only finished stages', () => {
    assert.equal(milestoneProgress(milestoneSet(3, 'current')), 75);
    assert.equal(milestoneProgress(milestoneSet(0, 'current')), 0);
    assert.equal(milestoneProgress(milestoneSet(4, 'done')), 100);
  });

  test('names the stage being worked on', () => {
    assert.equal(currentMilestone(milestoneSet(3, 'current')), 'Standing on its own');
    assert.equal(currentMilestone(milestoneSet(1, 'delayed')), 'Open and trading');
  });

  test('says so plainly when every stage is finished', () => {
    assert.equal(currentMilestone(milestoneSet(4, 'done')), 'All stages finished');
  });

  test('an empty list does not divide by zero', () => {
    assert.equal(milestoneProgress([]), 0);
    assert.equal(fundingUtilisation([]), 0);
  });
});

describe('funding drawn down', () => {
  /* Tracks stages rather than spending: six months of trading costs would
     exceed any grant and pin every business at 100%. */
  test('a stage in progress counts as half', () => {
    assert.equal(fundingUtilisation(milestoneSet(3, 'current')), 88);
    assert.equal(fundingUtilisation(milestoneSet(2, 'current')), 63);
  });

  test('a delayed stage still counts as started', () => {
    assert.equal(fundingUtilisation(milestoneSet(1, 'delayed')), 38);
  });

  test('never exceeds 100', () => {
    assert.equal(fundingUtilisation(milestoneSet(4, 'done')), 100);
  });
});

describe('evidence coverage', () => {
  test('measures value, not entry count', () => {
    /* Two entries, one evidenced. By count that is 50%; by value it is 10%,
       and value is the honest number: a receipt for R100 does not evidence a
       payment of R900. */
    const c = evidenceCoverage([
      { amount: 100, hasDocument: true },
      { amount: 900, hasDocument: false },
    ]);
    assert.equal(c.pct, 10);
    assert.equal(c.withProof, 1);
    assert.equal(c.count, 2);
    assert.equal(c.backed, 100);
    assert.equal(c.total, 1000);
  });

  test('everything evidenced is 100%', () => {
    const c = evidenceCoverage([
      { amount: 500, hasDocument: true },
      { amount: 250, hasDocument: true },
    ]);
    assert.equal(c.pct, 100);
  });

  test('nothing evidenced is 0%, not an error', () => {
    const c = evidenceCoverage([{ amount: 500, hasDocument: false }]);
    assert.equal(c.pct, 0);
    assert.equal(c.backed, 0);
  });

  test('no entries at all does not divide by zero', () => {
    const c = evidenceCoverage([]);
    assert.equal(c.pct, 0);
    assert.equal(c.total, 0);
    assert.equal(c.count, 0);
  });
});

describe('reporting status', () => {
  /* The deadline follows *today*, not the newest row on file. A business whose
     records stop a year ago is not "365 days late" on a single update; it has
     last month's figures outstanding like anyone else. Anchoring to the last
     period made historical demo data read as a year overdue. */

  test('up to date once the covered month has been sent', () => {
    /* June is on file, so on 10 July nothing is owed. */
    const r = reportingStatus(healthyBusiness, JULY_10);
    assert.equal(r.state, 'ok');
    assert.equal(r.sent, true);
    assert.equal(r.title, 'Everything is up to date');
    assert.equal(r.covers, 'Jun 2025');
  });

  test('warns within a week when the month is not yet sent', () => {
    /* On 10 August, July is what is owed, and the fixtures end in June. */
    const r = reportingStatus(healthyBusiness, new Date('2025-08-10T12:00:00Z'));
    assert.equal(r.state, 'due-soon');
    assert.equal(r.days, 5);
    assert.equal(r.label, 'Due in 5 days');
    assert.equal(r.covers, 'Jul 2025');
  });

  test('reports lateness once the deadline has passed', () => {
    const r = reportingStatus(healthyBusiness, new Date('2025-08-20T12:00:00Z'));
    assert.equal(r.state, 'overdue');
    assert.ok(r.days < 0);
    assert.match(r.label, /days? late/);
    /* Says why it matters, rather than only that it is late. */
    assert.match(r.detail, /20% of your score/);
  });

  test('a business years behind is not reported as years late', () => {
    /* The whole point of the change: a stale record still owes one month. */
    const r = reportingStatus(healthyBusiness, new Date('2026-08-20T12:00:00Z'));
    assert.equal(r.state, 'overdue');
    assert.ok(Math.abs(r.days) < 40, `expected under 40 days, got ${r.days}`);
    assert.equal(r.covers, 'Jul 2026');
  });

  test('a missed month still counts as not sent', () => {
    /* Zola's June update never arrived, so on 10 July June is still owed. */
    const r = reportingStatus(atRiskBusiness, JULY_10);
    assert.equal(r.sent, false);
    assert.equal(r.covers, 'Jun 2025');
  });

  test('a business with no figures is asked for its first month', () => {
    const empty: BusinessInput = { history: [], milestones: [], ledger: [] };
    const r = reportingStatus(empty, JULY_10);
    assert.equal(r.label, 'Not started');
    assert.match(r.title, /first month/);
    /* Must not read as late: nothing has been missed yet. */
    assert.notEqual(r.state, 'overdue');
  });

  test('singular and plural both read correctly', () => {
    const oneDay = reportingStatus(healthyBusiness, new Date('2025-08-14T12:00:00Z'));
    assert.equal(oneDay.label, 'Due in 1 day');

    const today = reportingStatus(healthyBusiness, new Date('2025-08-15T00:00:00Z'));
    assert.equal(today.label, 'Due today');
  });
});
