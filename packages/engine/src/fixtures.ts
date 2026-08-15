/**
 * Test fixtures: three businesses spanning Healthy, Watch and At Risk.
 *
 * These mirror the archetypes in the prototype's `DEFS` (Nandi Beauty Studio,
 * Soweto Sunrise Bakery, Zola Deliveries) but with fixed dates instead of
 * dates generated relative to today, so the expected values never change.
 */

import type { BusinessInput, Milestone, MilestoneStatus } from './types.ts';

const MSTAGES = [
  'Getting set up',
  'Open and trading',
  'Growing the business',
  'Standing on its own',
] as const;

export function milestoneSet(doneCount: number, activeStatus: MilestoneStatus): Milestone[] {
  return MSTAGES.map((label, i) => ({
    label,
    status: i < doneCount ? 'done' : i === doneCount ? activeStatus : 'pending',
  }));
}

/** Growing steadily, costs under control, never a late update. */
export const healthyBusiness: BusinessInput = {
  history: [
    { date: '2025-01-15', revenue: 48000, expenses: 27500, customers: 145, status: 'on-time' },
    { date: '2025-02-15', revenue: 49800, expenses: 28100, customers: 150, status: 'on-time' },
    { date: '2025-03-15', revenue: 51700, expenses: 28700, customers: 155, status: 'on-time' },
    { date: '2025-04-15', revenue: 53700, expenses: 29400, customers: 161, status: 'on-time' },
    { date: '2025-05-15', revenue: 55700, expenses: 30000, customers: 166, status: 'on-time' },
    { date: '2025-06-15', revenue: 57800, expenses: 30700, customers: 172, status: 'on-time' },
  ],
  milestones: milestoneSet(3, 'current'),
  ledger: [
    { type: 'revenue', desc: 'Salon takings for the month', amount: 57800 },
    { type: 'expense', desc: 'Hair products and colour stock', amount: 10440 },
    { type: 'expense', desc: 'Assistant stylist wages', amount: 9210 },
    { type: 'expense', desc: 'Salon rent', amount: 6750 },
    { type: 'expense', desc: 'Electricity and water', amount: 2460 },
    { type: 'expense', desc: 'Instagram promotion', amount: 1840 },
  ],
};

/** Sales growing slowly, costs rising faster, one late update. */
export const watchBusiness: BusinessInput = {
  history: [
    { date: '2025-01-15', revenue: 36000, expenses: 24500, customers: 160, status: 'on-time' },
    { date: '2025-02-15', revenue: 36400, expenses: 25200, customers: 161, status: 'on-time' },
    { date: '2025-03-15', revenue: 36900, expenses: 26000, customers: 163, status: 'on-time' },
    { date: '2025-04-15', revenue: 37300, expenses: 26800, customers: 164, status: 'late' },
    { date: '2025-05-15', revenue: 37800, expenses: 27600, customers: 166, status: 'on-time' },
    { date: '2025-06-15', revenue: 38200, expenses: 28400, customers: 167, status: 'on-time' },
  ],
  milestones: milestoneSet(2, 'current'),
  ledger: [
    { type: 'revenue', desc: 'Bread and cake sales', amount: 38200 },
    { type: 'expense', desc: 'Flour, sugar and yeast', amount: 10790 },
    { type: 'expense', desc: 'Baker and counter staff', amount: 7670 },
    { type: 'expense', desc: 'Shop rent', amount: 5110 },
    { type: 'expense', desc: 'Gas for the ovens', amount: 3120 },
    { type: 'expense', desc: 'Delivery fuel', amount: 1700 },
  ],
};

/** Sales falling, spending more than it earns, a delayed stage and a missed update. */
export const atRiskBusiness: BusinessInput = {
  history: [
    { date: '2025-01-15', revenue: 32000, expenses: 26500, customers: 95, status: 'on-time' },
    { date: '2025-02-15', revenue: 31400, expenses: 27200, customers: 93, status: 'late' },
    { date: '2025-03-15', revenue: 30900, expenses: 27900, customers: 92, status: 'on-time' },
    { date: '2025-04-15', revenue: 30300, expenses: 28600, customers: 91, status: 'on-time' },
    { date: '2025-05-15', revenue: 29800, expenses: 29400, customers: 89, status: 'late' },
    { date: '2025-06-15', revenue: 29200, expenses: 30100, customers: 88, status: 'missed' },
  ],
  milestones: milestoneSet(1, 'delayed'),
  ledger: [
    { type: 'revenue', desc: 'Delivery fees collected', amount: 29200 },
    { type: 'expense', desc: 'Petrol for the bakkie', amount: 10840 },
    { type: 'expense', desc: 'Driver wages', amount: 9030 },
    { type: 'expense', desc: 'Vehicle service and repairs', amount: 5420 },
    { type: 'expense', desc: 'Insurance premium', amount: 3010 },
    { type: 'expense', desc: 'Airtime and data', amount: 1810 },
  ],
};
