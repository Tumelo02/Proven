import 'server-only';

import { createClient } from '@/lib/supabase/server';

/**
 * A guard for sensitive server actions, not a page-level timeout.
 *
 * An earlier version of this file computed "session age" from the account's
 * `created_at` (when it was first signed up), then redirected the whole app
 * to /sign-in once that account was more than 30 minutes old — forever, for
 * every session, regardless of when the person actually signed in. Wiring
 * that into the root layout would have redirected every visitor away from
 * the public pages proxy.ts deliberately leaves open (/, /platform,
 * /sign-in), because "no session yet" and "expired session" produced the
 * same result.
 *
 * Idle timeout is fixed properly instead as a client-side concern —
 * `SessionTimeoutProvider` tracks real user activity (clicks, keys, scroll)
 * and signs out after 30 minutes of none of that, which is the only place
 * "idle" can actually be observed. What belongs on the server is checking
 * whether the token Supabase issued is still valid before letting a
 * particular sensitive action through, which is what this does.
 */
export async function ensureValidSession(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not signed in.');
  }

  /* `expires_at` is a real Unix timestamp from the token Supabase issued, set
     at sign-in and refreshed while the session is active — unlike the account
     creation date, this actually reflects how stale the token is. */
  const expiresAt = session.expires_at;
  if (expiresAt && expiresAt * 1000 < Date.now()) {
    throw new Error('Session expired. Please sign in again.');
  }
}
