import type { StaffRole } from '@/lib/database.types';

/**
 * The words the staff screens use for a role, and the capabilities that can be
 * granted alongside one.
 *
 * Their own module, with no directive and no React import, so both sides can
 * read them. They previously lived in `staff-form.tsx`, which is a Client
 * Component: importing a plain constant from it pulled that whole module —
 * `useActionState`, `useFormStatus` and all — into the server graph, where
 * those hooks cannot be evaluated. That is what made the page fail to render.
 */

export const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  reviewer: 'Reviewer',
  analyst: 'Analyst',
};

export const ROLE_BLURB: Record<StaffRole, string> = {
  owner: 'Everything, including adding and removing other staff.',
  manager: 'The day-to-day panel. Cannot manage staff.',
  reviewer: 'Brought in to check evidence, and little else.',
  analyst: 'Reads the numbers, changes nothing.',
};

export const CAPABILITIES: { key: string; label: string; hint: string }[] = [
  {
    key: 'review_evidence',
    label: 'Review evidence',
    hint: 'Decide whether a document matches what was logged.',
  },
  {
    key: 'manage_businesses',
    label: 'Manage businesses',
    hint: 'Disable and restore a business\u2019s access to the platform.',
  },
  {
    key: 'manage_organisations',
    label: 'Manage organisations',
    hint: 'Add funders and change their details.',
  },
  {
    key: 'view_commercial',
    label: 'See commercial standing',
    hint: 'Pilot, paying or lapsed, and renewal dates.',
  },
  {
    key: 'view_audit',
    label: 'See the audit trail',
    hint: 'Every recorded action, platform-wide.',
  },
];
