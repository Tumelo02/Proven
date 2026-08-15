/**
 * The version of the terms and privacy notice currently in force.
 *
 * POPIA asks what a person consented to, not merely that they did, so every
 * row in `consents` records the version that was actually shown to them.
 *
 * Bump this whenever the wording changes materially. Existing consent rows keep
 * pointing at the version they agreed to, which is the point: anyone who has
 * not accepted the current wording can then be asked again.
 *
 * This lives outside `(auth)/actions.ts` deliberately. That file is
 * `'use server'`, and such a module may only export async functions, so a
 * plain constant exported from there fails the build.
 */
export const POLICY_VERSION = '2026-08-15';
