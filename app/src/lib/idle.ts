/**
 * Idle session expiry, for the app.
 *
 * The decision itself — how long is too long, and whether a given marker is
 * still good — lives in `@proven/engine`, so the browser-side timer and the
 * server-side guard in `proxy.ts` cannot drift apart. Re-exported here so app
 * code has one obvious import, with the cookie attributes, which are a
 * web concern rather than an engine one, alongside it.
 *
 * Why the cookie exists at all: a Supabase session outlives the tab it was
 * created in. `SessionTimeoutProvider` can only sign an idle user out while
 * the page is open — its timers die with the tab — so closing the browser used
 * to leave a session that resumed days later, handing a shared phone's next
 * user the previous person's business. The marker outlives the page; the proxy
 * checks it on every request.
 *
 * It is NOT the security boundary. Deleting or editing the cookie does not
 * grant access: the proxy reads anything missing or implausible as stale and
 * ends the session. Tampering can only end a session early, never extend one.
 */

export {
  IDLE_LIMIT_MS,
  IDLE_WARNING_MS,
  ACTIVITY_COOKIE,
  readLastSeen,
  isIdleExpired,
} from '@proven/engine';

import { IDLE_LIMIT_MS } from '@proven/engine';

/** Cookie attributes, in one place so every writer agrees on them. */
export function activityCookieOptions() {
  return {
    path: '/',
    maxAge: IDLE_LIMIT_MS / 1000,
    sameSite: 'lax' as const,
    /* Not httpOnly, deliberately: the browser-side idle timer has to write
       this on real user activity, which is the only place activity can be
       observed. It carries only a timestamp, no identity and no privilege. */
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  };
}
