/**
 * Idle session expiry: how long a signed-in session may sit untouched.
 *
 * Here in the engine rather than in the app because it is exactly what this
 * package is for — a pure decision over inputs, with no database and no
 * network, so the browser-side timer and the server-side guard reach the same
 * verdict from the same code and cannot drift apart. That symmetry matters:
 * the browser decides when to warn, the server decides who gets in, and a
 * disagreement between the two is either a lock-out or a hole.
 *
 * The problem being solved: signing in leaves a refresh token in a cookie that
 * stays valid for weeks and renews itself. Someone who signs in on a shared or
 * borrowed phone, does their work and simply closes the tab is otherwise still
 * signed in when the next person opens the same link.
 *
 * A moment of last activity is stored, not a countdown, so the reckoning stays
 * correct across a browser restart: the gap is measured on arrival, no matter
 * how long the machine was switched off.
 */

/** How long a session may sit untouched before it is over. */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;

/** Warn the user five minutes before that. */
export const IDLE_WARNING_MS = 25 * 60 * 1000;

/**
 * Name of the cookie carrying the moment of last activity.
 *
 * Readable by browser script on purpose: the client-side timer refreshes it on
 * real activity, which is the only place activity can be observed. It carries
 * no identity and no privilege, only a timestamp.
 */
export const ACTIVITY_COOKIE = 'proven_last_seen';

/**
 * Parse the marker, rejecting anything that is not a plausible timestamp.
 *
 * Every rejection returns null, which callers treat as expired. That direction
 * is deliberate: tampering with this value can only ever end a session early,
 * never extend one, so the cookie is not load-bearing for security.
 */
export function readLastSeen(raw: string | undefined | null, now: number = Date.now()): number | null {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  /* A timestamp in the future is either clock skew or a forged value. Either
     way it must not postpone expiry, so it is refused. One minute of tolerance
     absorbs ordinary skew between a phone's clock and the server's. */
  if (value > now + 60_000) return null;
  return value;
}

/** Has this session been idle longer than the limit allows? */
export function isIdleExpired(lastSeen: number | null, now: number = Date.now()): boolean {
  /* No usable value means expired: the safe direction, where the worst case is
     that someone is asked to sign in again. */
  if (lastSeen === null) return true;
  return now - lastSeen >= IDLE_LIMIT_MS;
}
