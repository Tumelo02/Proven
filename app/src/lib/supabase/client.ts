'use client';

/**
 * Supabase client for browser code.
 *
 * Uses the anon key, which is public by design: it is shipped in the bundle
 * and every request it makes is constrained by the row-level security rules in
 * `supabase/migrations/20260811000002_rls_policies.sql`. The security boundary
 * is the database, not this key.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
