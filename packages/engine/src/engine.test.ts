/**
 * Golden-value tests.
 *
 * Every expected number and string here was produced by running the ORIGINAL
 * engine code these rules came from, against these same fixtures. They exist to
 * prove the TypeScript port scores identically to the prototype that has
 * already been demonstrated, so migrating to a database cannot silently move
 * anyone's score.
 *
 * If a change to the scoring rules is intended, these values change with it,
 * deliberately and visibly, in the same commit.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { computeHealth, scoreDelta, trendOf, tierLabel, WEIGHTS } from './health.ts';
import { computeCredit, creditReadiness, decisionFor, CREDIT_WEIGHTS } from './credit.ts';
import { getGuidance } from './guidance.ts';
import { money, moneyShort, pct } from './format.ts';
import { healthyBusiness, watchBusiness, atRiskBusiness } from './fixtures.ts';
import type { BusinessInput } from './types.ts';

/* `en-ZA` groups thousands with a non-breaking space, so `money(27100)` is
   "R27<NBSP>100", not "R27 100". Guidance strings embed it, so the tests must
   use the same character or they compare against something the app never
   produces. */
const NB = ' ';

describe('weights are unchanged', () => {
  test('health weights sum to 1', () => {
    const sum = WEIGHTS.revenue + WEIGHTS.expense + WEIGHTS.consistency + WEIGHTS.customers;
    assert.equal(sum, 1);
    assert.deepEqual(WEIGHTS, {
      revenue: 0.35,
      expense: 0.25,
      consistency: 0.2,
      customers: 0.2,
    });
  });

  test('credit weights sum to 1', () => {
    const sum = CREDIT_WEIGHTS.trend + CREDIT_WEIGHTS.stability + CREDIT_WEIGHTS.discipline;
    assert.equal(sum, 1);
  });
});

describe('formatting', () => {
  test('money uses en-ZA grouping and no cents', () => {
    assert.equal(money(27100), `R27${NB}100`);
    assert.equal(money(900), 'R900');
    assert.equal(money(1234567), `R1${NB}234${NB}567`);
  });

  test('moneyShort abbreviates', () => {
    assert.equal(moneyShort(1200000), 'R1.2m');
    assert.equal(moneyShort(48000), 'R48k');
    assert.equal(moneyShort(950), 'R950');
  });

  test('pct is always signed', () => {
    assert.equal(pct(0.038), '+3.8%');
    assert.equal(pct(-0.018), '-1.8%');
    assert.equal(pct(0), '+0.0%');
  });
});

describe('healthy business (Nandi archetype)', () => {
  const h = computeHealth(healthyBusiness);

  test('scores 94.2 and lands in the green tier', () => {
    assert.equal(h.score, 94.2);
    assert.equal(h.tier, 'green');
    assert.equal(tierLabel(h.tier), 'Healthy');
  });

  test('all six updates arrived on time', () => {
    assert.equal(h.onTime, 6);
    assert.equal(h.late, 0);
    assert.equal(h.missed, 0);
    assert.equal(h.factors.consistency, 100);
  });

  test('trend is up', () => {
    assert.equal(scoreDelta(healthyBusiness), 3.3);
    assert.equal(trendOf(healthyBusiness), 'up');
  });

  test('reaches the top credit band', () => {
    const cr = computeCredit(healthyBusiness);
    assert.equal(cr.score, 97.2);
    const r = creditReadiness(healthyBusiness);
    assert.equal(r.status, 'Credit-Ready Candidate');
    assert.equal(r.plain, 'Ready for a funding conversation');
    assert.equal(r.color, 'green');
    assert.deepEqual(r.reasons, [
      '6 months of numbers on record',
      'Sales growing by about +3.8% a month',
      'Spending has stayed under control',
      '3 of 4 stages finished',
      'Earning more than it spends',
    ]);
  });

  test('funder decision is to release', () => {
    assert.deepEqual(decisionFor(healthyBusiness), {
      kind: 'release',
      action: 'Doing well. Keep going',
      why: 'A score of 94.2 is healthy. Sales and customers are both moving in the right direction.',
    });
  });

  test('guidance reinforces the record rather than staying silent', () => {
    const g = getGuidance(healthyBusiness);
    assert.equal(g.length, 1);
    assert.deepEqual(g[0], {
      sev: 'green',
      issue: `Steady month. You kept R27${NB}100 after costs.`,
      rec: 'You are 3 of 4 stages in with 6 months on record. Keep sending your numbers, this history is what your next funding conversation rests on.',
    });
  });
});

describe('watch business (Bakery archetype)', () => {
  const h = computeHealth(watchBusiness);

  test('scores 72.5 and lands in the yellow tier', () => {
    assert.equal(h.score, 72.5);
    assert.equal(h.tier, 'yellow');
    assert.equal(tierLabel(h.tier), 'Watch');
  });

  test('one late update costs half a point of consistency', () => {
    assert.equal(h.onTime, 5);
    assert.equal(h.late, 1);
    assert.equal(h.missed, 0);
    assert.equal(h.factors.consistency, (5.5 / 6) * 100);
  });

  test('trend is flat: inside the 1.5-point dead band', () => {
    assert.equal(scoreDelta(watchBusiness), 0.4);
    assert.equal(trendOf(watchBusiness), 'flat');
  });

  test('sits in the Strong Evidence band', () => {
    const cr = computeCredit(watchBusiness);
    assert.equal(cr.score, 71);
    const r = creditReadiness(watchBusiness);
    assert.equal(r.status, 'Strong Evidence');
    assert.equal(r.color, 'blue');
  });

  test('funder decision is to hold for a check-in', () => {
    assert.deepEqual(decisionFor(watchBusiness), {
      kind: 'hold',
      action: 'Needs a check-in',
      why: 'A score of 72.5 means keep an eye on this one. Losing customers is the biggest problem at 63/100.',
    });
  });

  test('guidance names the largest cost by its real description', () => {
    const g = getGuidance(watchBusiness);
    assert.equal(g.length, 1);
    assert.deepEqual(g[0], {
      sev: 'yellow',
      issue: 'Your costs are creeping up faster than your sales.',
      rec: `You keep about R9${NB}800 of every month right now. Check flour, sugar and yeast at R10${NB}790 first: it is your largest cost.`,
    });
  });
});

describe('at-risk business (Zola archetype)', () => {
  const h = computeHealth(atRiskBusiness);

  test('scores 41.1 and lands in the red tier', () => {
    assert.equal(h.score, 41.1);
    assert.equal(h.tier, 'red');
    assert.equal(tierLabel(h.tier), 'At Risk');
  });

  test('counts two late updates and one missed', () => {
    assert.equal(h.onTime, 3);
    assert.equal(h.late, 2);
    assert.equal(h.missed, 1);
  });

  test('the score averages three months, the guidance quotes the latest', () => {
    /* Two different ratios, deliberately. The health score smooths over the
       last three months (0.99, still just under water) while the guidance text
       quotes this month alone (1.03, already under). Conflating them would
       either make the score jumpy or make the advice a month stale. */
    assert.equal(h.ratio.toFixed(4), '0.9866');
    const last = atRiskBusiness.history[atRiskBusiness.history.length - 1]!;
    assert.equal((last.expenses / last.revenue).toFixed(4), '1.0308');
    assert.ok(last.expenses > last.revenue, 'latest month should be cash-negative');
  });

  test('trend is down', () => {
    assert.equal(trendOf(atRiskBusiness), 'down');
    assert.equal(scoreDelta(atRiskBusiness), -6.3);
  });

  test('a poor record cannot reach a high band', () => {
    const cr = computeCredit(atRiskBusiness);
    assert.equal(cr.score, 26.7);
    const r = creditReadiness(atRiskBusiness);
    assert.equal(r.status, 'Building Track Record');
    assert.equal(r.color, 'grey');
    assert.deepEqual(r.reasons, [
      '6 months of numbers on record',
      'Sales are not growing steadily yet',
      'Spending is high compared with what comes in',
      '1 of 4 stages finished',
      'Spending more than it earns right now',
    ]);
  });

  test('funder decision is to escalate', () => {
    assert.deepEqual(decisionFor(atRiskBusiness), {
      kind: 'escalate',
      action: 'Needs attention now',
      why: 'A score of 41.1 is low. Spending is the biggest problem at 23/100.',
    });
  });

  test('every failing rule produces its own specific message', () => {
    const g = getGuidance(atRiskBusiness);
    assert.equal(g.length, 4);
    assert.deepEqual(g.map((x) => x.sev), ['red', 'red', 'yellow', 'yellow']);
    assert.deepEqual(g[0], {
      sev: 'red',
      issue: 'Costs have caught up with your sales: you are spending R1.03 for every R1 you earn.',
      rec: `Your biggest cost this month was petrol for the bakkie at R10${NB}840. That is the first one to bring down.`,
    });
    assert.deepEqual(g[1], {
      sev: 'red',
      issue: 'You spent R900 more than you brought in this month.',
      rec: 'List what still has to be paid and cover only what the business cannot run without until sales recover.',
    });
    assert.equal(g[2]!.issue, 'You are behind on "Open and trading".');
    assert.equal(g[3]!.issue, 'You have missed 1 monthly update.');
  });
});

describe('edge cases the database will eventually hand us', () => {
  test('a single reporting month does not divide by zero', () => {
    const oneMonth: BusinessInput = {
      history: [
        { date: '2025-06-15', revenue: 10000, expenses: 6000, customers: 20, status: 'on-time' },
      ],
      milestones: [{ label: 'Getting set up', status: 'current' }],
      ledger: [],
    };
    const h = computeHealth(oneMonth);
    assert.ok(Number.isFinite(h.score));
    /* Too few windows to measure growth, so both growth factors sit at the
       neutral 55 baseline rather than reading as a collapse. */
    assert.equal(h.revGrowth, 0);
    assert.equal(h.factors.revenue, 55);
    assert.equal(scoreDelta(oneMonth), 0);
    assert.equal(trendOf(oneMonth), 'flat');
  });

  test('a brand-new business is always Building Track Record', () => {
    const threeMonths: BusinessInput = {
      history: [
        { date: '2025-04-15', revenue: 10000, expenses: 3000, customers: 20, status: 'on-time' },
        { date: '2025-05-15', revenue: 20000, expenses: 4000, customers: 40, status: 'on-time' },
        { date: '2025-06-15', revenue: 40000, expenses: 5000, customers: 80, status: 'on-time' },
      ],
      milestones: [{ label: 'Getting set up', status: 'done' }],
      ledger: [],
    };
    /* Explosive growth and perfect reporting still cannot buy a top band with
       only three months on record: the floor is time, not performance. */
    assert.ok(computeCredit(threeMonths).score > 80);
    assert.equal(creditReadiness(threeMonths).status, 'Building Track Record');
  });

  test('zero revenue is treated as bottomed out, not as an error', () => {
    const noRevenue: BusinessInput = {
      history: [
        { date: '2025-05-15', revenue: 0, expenses: 5000, customers: 0, status: 'missed' },
        { date: '2025-06-15', revenue: 0, expenses: 5000, customers: 0, status: 'missed' },
      ],
      milestones: [{ label: 'Getting set up', status: 'delayed' }],
      ledger: [],
    };
    const h = computeHealth(noRevenue);
    assert.equal(h.ratio, 2);
    assert.equal(h.factors.expense, 0);
    assert.ok(Number.isFinite(h.score));
    assert.equal(h.tier, 'red');
  });

  test('an empty ledger still produces guidance, without naming a cost', () => {
    const noLedger: BusinessInput = { ...atRiskBusiness, ledger: [] };
    const g = getGuidance(noLedger);
    assert.ok(g.length > 0);
    assert.equal(
      g[0]!.rec,
      'Bring your largest cost down before it overtakes what you earn.',
    );
  });
});
