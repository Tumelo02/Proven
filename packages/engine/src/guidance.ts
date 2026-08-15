/**
 * Guidance engine: turns a bad number into a specific, practical next step.
 *
 * Every message quotes the business's own figures, so two businesses with the
 * same underlying problem never read as the same generic note. That is the
 * difference between a flag and advice.
 */

import { money } from './format.ts';
import { computeHealth } from './health.ts';
import type { BusinessInput, GuidanceItem } from './types.ts';

export function getGuidance(biz: BusinessInput): GuidanceItem[] {
  const h = computeHealth(biz);
  const out: GuidanceItem[] = [];
  const last = biz.history[biz.history.length - 1]!;
  const prev = biz.history[biz.history.length - 2] ?? last;
  const ratio = last.revenue ? last.expenses / last.revenue : 1;

  /* Biggest expense line this month, named so the advice points somewhere. */
  const topCost = biz.ledger
    .filter((t) => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)[0];

  if (h.revGrowth <= -0.15) {
    out.push({
      sev: 'red',
      issue: `Your sales have dropped sharply: down ${Math.abs(Math.round(h.revGrowth * 100))}% on the months before.`,
      rec: `Sales fell from ${money(prev.revenue)} to ${money(last.revenue)}. Look at which customers or products brought in less than usual, and start there.`,
    });
  }

  if (h.expGrowth > h.revGrowth && h.expGrowth > 0.02) {
    /* Same rule, but the wording and urgency follow how tight it actually is. */
    if (ratio >= 0.95) {
      out.push({
        sev: 'red',
        issue: `Costs have caught up with your sales: you are spending R${ratio.toFixed(2)} for every R1 you earn.`,
        rec: topCost
          ? `Your biggest cost this month was ${topCost.desc.toLowerCase()} at ${money(topCost.amount)}. That is the first one to bring down.`
          : 'Bring your largest cost down before it overtakes what you earn.',
      });
    } else {
      out.push({
        sev: 'yellow',
        issue: 'Your costs are creeping up faster than your sales.',
        rec:
          `You keep about ${money(last.revenue - last.expenses)} of every month right now. ` +
          (topCost
            ? `Check ${topCost.desc.toLowerCase()} at ${money(topCost.amount)} first: it is your largest cost.`
            : 'Review your largest costs first.'),
      });
    }
  }

  if (last.revenue - last.expenses < 0) {
    out.push({
      sev: 'red',
      issue: `You spent ${money(Math.abs(last.revenue - last.expenses))} more than you brought in this month.`,
      rec: 'List what still has to be paid and cover only what the business cannot run without until sales recover.',
    });
  }

  const delayedStage = biz.milestones.filter((m) => m.status === 'delayed')[0];
  if (delayedStage) {
    out.push({
      sev: 'yellow',
      issue: `You are behind on "${delayedStage.label}".`,
      rec: 'Work out what is holding this stage up, then set a new date you can realistically meet. Your funder can see it is running late.',
    });
  }

  if (h.missed > 0) {
    out.push({
      sev: 'yellow',
      issue: `You have missed ${h.missed} monthly update${h.missed === 1 ? '' : 's'}.`,
      rec: 'Sending your numbers on time is a fifth of your score. Catching up is the quickest improvement available to you.',
    });
  }

  /* A healthy business still gets a message: silence reads as neglect, and the
     point of the note is to reinforce that the record itself is the asset. */
  if (!out.length && h.tier === 'green') {
    const done = biz.milestones.filter((m) => m.status === 'done').length;
    out.push({
      sev: 'green',
      issue: `Steady month. You kept ${money(last.revenue - last.expenses)} after costs.`,
      rec: `You are ${done} of ${biz.milestones.length} stages in with ${biz.history.length} months on record. Keep sending your numbers, this history is what your next funding conversation rests on.`,
    });
  }

  if (!out.length) {
    out.push({
      sev: 'yellow',
      issue: 'Nothing serious this month, but a few things are worth watching.',
      rec: 'Keep sending your numbers on time so any problem shows up early.',
    });
  }

  return out;
}
