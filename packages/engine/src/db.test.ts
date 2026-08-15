/**
 * Tests for the database adapters.
 *
 * The seam between Postgres and the engine is where a silent corruption is
 * most likely: a `numeric` arriving as a string, or rows arriving newest-first
 * from an `order by ... desc` query. Neither throws. Both would quietly
 * produce a wrong score, which is the one failure this product cannot have.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { num, toBusinessInput, periodFromRow } from './db.ts';
import type { MilestoneRow, ReportingPeriodRow, TransactionRow } from './db.ts';
import { computeHealth } from './health.ts';
import { getGuidance } from './guidance.ts';

const period = (
  id: string,
  month: string,
  revenue: string,
  expenses: string,
  customers: number,
): ReportingPeriodRow => ({
  id,
  business_id: 'b1',
  period_month: month,
  revenue,
  expenses,
  customers,
  status: 'on-time',
  submitted_at: null,
});

/* Deliberately in newest-first order, the shape a `order by period_month desc`
   query returns. */
const periodsDesc: ReportingPeriodRow[] = [
  period('p6', '2025-06-01', '57800.00', '30700.00', 172),
  period('p5', '2025-05-01', '55700.00', '30000.00', 166),
  period('p4', '2025-04-01', '53700.00', '29400.00', 161),
  period('p3', '2025-03-01', '51700.00', '28700.00', 155),
  period('p2', '2025-02-01', '49800.00', '28100.00', 150),
  period('p1', '2025-01-01', '48000.00', '27500.00', 145),
];

const milestonesShuffled: MilestoneRow[] = [
  { id: 'm3', business_id: 'b1', label: 'Growing the business', status: 'done', sort_order: 3, target_date: null, completed_on: null },
  { id: 'm1', business_id: 'b1', label: 'Getting set up', status: 'done', sort_order: 1, target_date: null, completed_on: null },
  { id: 'm4', business_id: 'b1', label: 'Standing on its own', status: 'current', sort_order: 4, target_date: null, completed_on: null },
  { id: 'm2', business_id: 'b1', label: 'Open and trading', status: 'done', sort_order: 2, target_date: null, completed_on: null },
];

const transactions: TransactionRow[] = [
  { id: 't1', business_id: 'b1', period_id: 'p6', type: 'revenue', description: 'Salon takings for the month', category: 'Sales', amount: '57800.00', occurred_on: '2025-06-28' },
  { id: 't2', business_id: 'b1', period_id: 'p6', type: 'expense', description: 'Hair products and colour stock', category: 'Stock & Inventory', amount: '10440.00', occurred_on: '2025-06-10' },
  { id: 't3', business_id: 'b1', period_id: 'p6', type: 'expense', description: 'Assistant stylist wages', category: 'Wages', amount: '9210.00', occurred_on: '2025-06-25' },
  /* An older month, which must not leak into this month's advice. */
  { id: 't4', business_id: 'b1', period_id: 'p5', type: 'expense', description: 'One-off equipment purchase', category: 'Other', amount: '48000.00', occurred_on: '2025-05-04' },
];

describe('numeric conversion', () => {
  test('parses the strings Postgres sends for numeric columns', () => {
    assert.equal(num('48000.00'), 48000);
    assert.equal(num('0.00'), 0);
    assert.equal(num(1234.56), 1234.56);
  });

  test('null and malformed values become 0, never NaN', () => {
    /* A NaN would propagate silently through every arithmetic step and surface
       as a blank score rather than an error. */
    assert.equal(num(null), 0);
    assert.equal(num(undefined), 0);
    assert.equal(num('not a number'), 0);
  });

  test('a period row converts to the shape the engine expects', () => {
    const p = periodFromRow(periodsDesc[0]!);
    assert.deepEqual(p, {
      date: '2025-06-01',
      revenue: 57800,
      expenses: 30700,
      customers: 172,
      status: 'on-time',
    });
    assert.equal(typeof p.revenue, 'number');
  });
});

describe('assembling engine input from rows', () => {
  const input = toBusinessInput({
    periods: periodsDesc,
    milestones: milestonesShuffled,
    transactions,
  });

  test('periods are reordered oldest-first', () => {
    assert.deepEqual(
      input.history.map((p) => p.date),
      ['2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01', '2025-05-01', '2025-06-01'],
    );
  });

  test('a descending query still scores as growing, not collapsing', () => {
    /* The whole point of the sort. Left newest-first, this same business would
       read as a business in steep decline. */
    const h = computeHealth(input);
    assert.ok(h.revGrowth > 0, 'revenue growth should be positive');
    assert.equal(h.score, 94.2);
    assert.equal(h.tier, 'green');
  });

  test('milestones follow their stage order, not the order rows arrived', () => {
    assert.deepEqual(
      input.milestones.map((m) => m.label),
      ['Getting set up', 'Open and trading', 'Growing the business', 'Standing on its own'],
    );
  });

  test('the ledger holds only the latest month', () => {
    assert.equal(input.ledger.length, 3);
    assert.ok(
      !input.ledger.some((t) => t.desc === 'One-off equipment purchase'),
      "last month's costs must not appear in this month's advice",
    );
  });

  test('guidance names the real largest cost of the current month', () => {
    const g = getGuidance(input);
    assert.equal(g.length, 1);
    assert.equal(g[0]!.sev, 'green');
    /* Had the stale R48 000 entry leaked in, it would have been named here. */
    assert.ok(!g[0]!.rec.includes('equipment'));
  });

  test('a business with no periods yet does not throw', () => {
    const empty = toBusinessInput({ periods: [], milestones: [], transactions });
    assert.deepEqual(empty.history, []);
    assert.deepEqual(empty.ledger, []);
  });
});
