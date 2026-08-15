import 'server-only';

import { headers } from 'next/headers';
import { createAdminClient, createClient } from '@/lib/supabase/server';

/**
 * Recording what happened.
 *
 * One helper rather than an insert written out at each call site: a trail is
 * only useful if every event has the same shape, and repeated boilerplate is
 * how fields quietly stop being filled in.
 *
 * WHAT TO RECORD. Anything that touches another party's data, changes who can
 * see what, or would matter in a dispute. Not ordinary reads of your own
 * records: a trail that logs everything is one nobody reads.
 */

export type Severity = 'info' | 'notice' | 'alert';

export interface AuditEvent {
  /** Dotted and past tense: `document.verified`, `portfolio.exported`. */
  action: string;
  entityType: string;
  entityId?: string | null;
  /** The organisation this concerns, when there is one. */
  orgId?: string | null;
  /**
   * info    routine, kept for completeness
   * notice  worth knowing: an export, a link confirmed
   * alert   worth acting on today: a failed permission, a deletion
   */
  severity?: Severity;
  /** Anything that helps answer "what exactly happened", as plain JSON. */
  detail?: Record<string, unknown>;
}

/**
 * The caller's address, as far as it can be known behind a proxy.
 *
 * Vercel sets `x-forwarded-for`; the first entry is the client. Treated as a
 * hint rather than proof: a header can be forged, and the trail should say what
 * was claimed rather than pretend to certainty.
 */
async function requestOrigin(): Promise<{ ip: string; agent: string }> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for') ?? '';
    const ip = forwarded.split(',')[0]?.trim() || h.get('x-real-ip') || '';
    return { ip, agent: (h.get('user-agent') ?? '').slice(0, 300) };
  } catch {
    /* Outside a request context, a scheduled job for instance. */
    return { ip: '', agent: '' };
  }
}

/**
 * Write one event.
 *
 * Never throws. An audit write that fails must not take the user's action down
 * with it: losing a row is bad, losing the work someone just did is worse. A
 * gap in the trail is visible; a failed save is not recoverable.
 */
export async function recordEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    /* No session means no actor, and the insert policy requires one. Nothing
       to record. */
    if (!user) return;

    const { ip, agent } = await requestOrigin();

    await supabase.from('audit_log').insert({
      actor_id: user.id,
      actor_email: user.email ?? '',
      org_id: event.orgId ?? null,
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId ?? null,
      severity: event.severity ?? 'info',
      detail: event.detail ?? {},
      ip_address: ip,
      user_agent: agent,
    });
  } catch {
    /* Deliberately silent. See above. */
  }
}

/**
 * Record a sign-in that failed.
 *
 * Written with the service-role client because there is, by definition, no
 * session to write as: the insert policy requires `actor_id = auth.uid()`, and
 * a failed attempt has neither. This is the one event that legitimately has no
 * actor, which is exactly why it needs recording.
 *
 * The email is stored as typed. It may name no account at all, and that is
 * useful: someone guessing addresses looks different from someone with one
 * wrong password.
 *
 * Never throws, for the same reason as `recordEvent`: a failed audit write must
 * not turn a wrong password into a broken page.
 */
export async function recordFailedSignIn(email: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { ip, agent } = await requestOrigin();

    await admin.from('audit_log').insert({
      actor_id: null,
      actor_email: email.slice(0, 200),
      org_id: null,
      action: 'auth.sign_in_failed',
      entity_type: 'profile',
      entity_id: null,
      severity: 'alert',
      detail: {},
      ip_address: ip,
      user_agent: agent,
    });
  } catch {
    /* Deliberately silent. */
  }
}
