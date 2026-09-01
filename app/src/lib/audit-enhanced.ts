// app/src/lib/audit-enhanced.ts
import 'server-only';

import { headers } from 'next/headers';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export type Severity = 'info' | 'notice' | 'alert';

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string | null;
  orgId?: string | null;
  severity?: Severity;
  detail?: Record<string, unknown>;
  correlationId?: string;
  resourceId?: string;
}

/**
 * Hash IP address for privacy - keep only first two octets
 * Example: 192.168.1.100 → 192.168.*.*
 */
function hashIPAddress(ip: string): string {
  if (!ip || ip === 'unknown') return '';
  const parts = ip.split('.');
  if (parts.length !== 4) return 'invalid';
  return `${parts[0]}.${parts[1]}.*.*`;
}

/**
 * Truncate user agent for privacy
 * Keeps only essential info: browser name and major version
 * Example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
 *          → "Chrome 91"
 */
function truncateUserAgent(agent: string): string {
  if (!agent) return '';

  const knownBrowsers = [
    { name: 'Chrome', regex: /Chrome\/(\d+)/ },
    { name: 'Firefox', regex: /Firefox\/(\d+)/ },
    { name: 'Safari', regex: /Safari\/(\d+)/ },
    { name: 'Edge', regex: /Edg\/(\d+)/ },
    { name: 'Opera', regex: /Opera\/(\d+)/ },
  ] as const;

  for (const browser of knownBrowsers) {
    const match = agent.match(browser.regex);
    if (match) {
      return `${browser.name} ${match[1]}`;
    }
  }

  return 'unknown';
}

/**
 * Get request origin with privacy-preserving IP hashing
 */
async function requestOrigin(): Promise<{ ip: string; agent: string }> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    const realIp = h.get('x-real-ip') || '';
    const ip = forwarded || realIp;

    return {
      ip: hashIPAddress(ip),
      agent: truncateUserAgent(h.get('user-agent') ?? ''),
    };
  } catch {
    return { ip: '', agent: '' };
  }
}

/**
 * Write one event to audit log
 * Never throws. An audit write that fails must not take the user's action down
 * with it: losing a row is bad, losing the work someone just did is worse.
 */
export async function recordEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { ip, agent } = await requestOrigin();
    const correlationId = event.correlationId || crypto.randomUUID();
    const detail = {
      ...(event.detail ?? {}),
      ...(event.correlationId ? { correlation_id: event.correlationId } : {}),
      ...(event.resourceId ? { resource_id: event.resourceId } : {}),
    };

    await supabase.from('audit_log').insert({
      actor_id: user.id,
      actor_email: user.email ?? '',
      org_id: event.orgId ?? null,
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId ?? null,
      severity: event.severity ?? 'info',
      detail,
      ip_address: ip, // Now hashed
      user_agent: agent, // Now truncated
    });
  } catch {
    // Deliberately silent - audit should never break user operations
  }
}

/**
 * Record a sign-in that failed
 * Uses service-role client because there is no session
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
      detail: { attempted_email: email.slice(0, 200) },
      ip_address: ip, // Hashed
      user_agent: agent, // Truncated
    });
  } catch {
    // Deliberately silent
  }
}

/**
 * Track bulk operations with correlation ID
 */
export async function recordBulkOperation(
  action: string,
  entityType: string,
  count: number,
  details?: Record<string, unknown>
): Promise<void> {
  const correlationId = crypto.randomUUID();

  await recordEvent({
    action,
    entityType,
    severity: count > 10 ? 'notice' : 'info',
    detail: { ...details, count, correlationId },
    correlationId,
  });
}
