import type { BusinessRole } from '@/lib/database.types';

/**
 * What each role is called and what it means, in the business's own words.
 *
 * Its own module with no directive, so the server page and the client forms can
 * both read it: importing a constant from a Client Component would pull that
 * whole module, hooks included, into the server graph.
 */
export const ROLE_LABEL: Record<BusinessRole, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  manager: 'Manager',
};

export const ROLE_BLURB: Record<BusinessRole, string> = {
  viewer: 'Can see the figures and the report. Changes nothing.',
  editor: 'Can log transactions and report months. The day-to-day.',
  manager: 'Everything an editor can do, plus the business profile and funding.',
};

/** Ordered least to most, so the list reads as a ladder. */
export const ROLE_ORDER: BusinessRole[] = ['viewer', 'editor', 'manager'];
