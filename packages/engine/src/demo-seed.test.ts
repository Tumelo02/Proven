/**
 * The demo seed must score exactly what the pitch claims.
 *
 * This reads the figures out of `supabase/migrations/..._demo_data.sql` itself
 * and runs them through the real engine. If anyone edits a revenue figure in
 * that file, or changes a scoring weight, this fails rather than letting a
 * presentation show different numbers from the deck.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { computeHealth } from './health.ts';
import { creditReadiness } from './credit.ts';
import { toBusinessInput } from './db.ts';
import type { ReportStatus } from './types.ts';
import type { ReportingPeriodRow } from './db.ts';

const here = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(here, '..', '..', '..', 'supabase', 'migrations', '20260812100004_demo_data.sql');

/** Pulls each business's six reporting periods out of the migration. */
function periodsFromSeed(): ReportingPeriodRow[][] {
  const sql = readFileSync(SEED_PATH, 'utf8');
  const blocks = sql.split('insert into reporting_periods').slice(1);

  return blocks.map((block, b) => {
    const values = block.slice(0, block.indexOf(';'));
    const rows = [...values.matchAll(
      /\(v_biz, '(\d{4}-\d{2}-\d{2})',\s*(\d+),\s*(\d+),\s*(\d+),\s*'([a-z-]+)'/g,
    )];
    return rows.map((m, i) => ({
      id: `b${b}p${i}`,
      business_id: `b${b}`,
      period_month: m[1]!,
      revenue: m[2]!,
      expenses: m[3]!,
      customers: Number(m[4]),
      status: m[5] as ReportStatus,
      submitted_at: null,
    }));
  });
}

describe('demo seed scores match the prototype', () => {
  const all = periodsFromSeed();

  test('the migration contains exactly three businesses', () => {
    assert.equal(all.length, 3);
    for (const periods of all) {
      assert.equal(periods.length, 6, 'each business has six months on record');
    }
  });

  /* The three numbers the pitch is built on: one business per tier, so a judge
     sees Healthy, Watch and At Risk side by side. */
  const cases = [
    { name: 'Nandi Beauty Studio', score: 94.2, tier: 'green', band: 'Credit-Ready Candidate' },
    { name: 'Soweto Sunrise Bakery', score: 72.5, tier: 'yellow', band: 'Strong Evidence' },
    { name: 'Zola Deliveries', score: 41.1, tier: 'red', band: 'Building Track Record' },
  ] as const;

  cases.forEach((expected, i) => {
    test(`${expected.name} scores ${expected.score} and is ${expected.tier}`, () => {
      const periods = all[i]!;
      const input = toBusinessInput({ periods, milestones: [], transactions: [] });
      const health = computeHealth(input);

      assert.equal(health.score, expected.score);
      assert.equal(health.tier, expected.tier);
    });
  });

  test('the three businesses cover all three tiers', () => {
    const tiers = all.map((periods) =>
      computeHealth(toBusinessInput({ periods, milestones: [], transactions: [] })).tier,
    );
    assert.deepEqual(new Set(tiers), new Set(['green', 'yellow', 'red']));
  });

  test('credit bands differ across the three, so the range is visible', () => {
    const bands = all.map((periods) =>
      creditReadiness(
        toBusinessInput({ periods, milestones: [{ label: 'Getting set up', status: 'done' }], transactions: [] }),
      ).status,
    );
    assert.equal(new Set(bands).size, 3, 'each demo business sits in a different band');
  });

  test('the at-risk business has a missed update, which is what makes it at risk', () => {
    const zola = all[2]!;
    assert.ok(
      zola.some((p) => p.status === 'missed'),
      'Zola must have a missed month: reporting is a fifth of the score',
    );
  });
});
