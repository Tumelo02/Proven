/**
 * Supabase clients for server code.
 *
 * Two of them, and the difference matters:
 *
 *   `createClient()`      acts as the signed-in user. Row-level security
 *                         applies. Use this for everything.
 *
 *   `createAdminClient()` uses the service-role key, which BYPASSES every
 *                         security rule. Use it only where a rule deliberately
 *                         withholds a write from clients, and record what
 *                         happened in `audit_log`.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            /* Server Components cannot set cookies. The middleware refreshes
               the session instead, so this is safe to ignore here. */
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Never import this into a Client Component: the key must
 * not reach the browser. It is read from a non-`NEXT_PUBLIC_` variable, so a
 * mistaken import fails at build rather than leaking silently.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. It is required for administrative writes.',
    );
  }

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
