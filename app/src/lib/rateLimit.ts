import 'server-only';

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Rate limiting, backed by the `rate_limits` table and `check_rate_limit`
 * function in supabase/migrations/20260905100015_rate_limits.sql.
 *
 * Postgres rather than a separate Redis/Upstash service: the app already has
 * exactly one datastore, this needs no new account or environment variable to
 * work, and the volumes here (auth attempts, not general API traffic) are far
 * below what would make a dedicated cache worth the extra moving part.
 */

export class RateLimitError extends Error {
  constructor(
    public retryAfter: number,
    message = 'Too many attempts. Please try again later.',
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * The caller's address, as far as it can be known behind a proxy.
 *
 * Vercel sets `x-forwarded-for`; the first entry is the client. Treated as a
 * hint, not proof — a header can be forged — which is why every limit below is
 * keyed on IP *and* on the value the caller supplied (email), not IP alone:
 * one still catches an attacker who rotates the other.
 */
export async function getClientIP(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;

    const realIp = h.get('x-real-ip');
    if (realIp) return realIp;

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * True if the call is still within its limit, false if it should be refused.
 *
 * Call once per attempt, including the one that succeeds: the count is what
 * protects the next person, not a gate that stops checking once it has let
 * someone through once.
 *
 * Written with the service-role client deliberately. `check_rate_limit` is
 * SECURITY DEFINER and granted to both anon and authenticated, so this would
 * work with the ordinary client too, but a sign-in attempt has no session at
 * all in the failing case, and using the same client throughout keeps the
 * behaviour identical whether or not one exists yet.
 *
 * Fails OPEN: if the rate-limit check itself errors (a migration not yet run,
 * a transient database issue), the action proceeds. A missing safety net
 * should not become a second way to lock everyone out of sign-in.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key: key,
      p_max_attempts: maxAttempts,
      p_window_seconds: windowSeconds,
    });

    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}

/**
 * The limits actually applied. Kept in one place so the numbers can be read
 * and reasoned about together rather than scattered across each action.
 */
export const RATE_LIMITS = {
  /** Five wrong passwords per email, per 15 minutes. */
  signIn: { max: 5, windowSeconds: 15 * 60 },
  /** Three password-reset requests per email, per hour — these send email. */
  passwordReset: { max: 3, windowSeconds: 60 * 60 },
  /** Three new accounts per IP, per hour. */
  signUp: { max: 3, windowSeconds: 60 * 60 },
} as const;
