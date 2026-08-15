'use server';

/**
 * Authentication actions.
 *
 * Errors are returned as values rather than thrown, so a wrong password
 * re-renders the form with a message instead of showing an error page.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { recordEvent, recordFailedSignIn } from '@/lib/audit';
import { POLICY_VERSION } from '@/lib/policy';

export interface AuthState {
  error?: string;
  message?: string;
}

/** Only allow relative paths, so `?next=` cannot bounce a user to another site. */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : '';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return '/dashboard';
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Enter your email address and password.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    /* A failure is worth more than a success when something is wrong: five in a
       minute against one address is an attack, and it is invisible unless the
       failures are written down. Recorded with the service-role client because
       there is no session to write as, and marked `alert` so it surfaces
       without anyone reading the whole trail.

       The address is recorded as typed. That is the point, it is what was
       tried, and it may well be an account that does not exist. */
    if (error.status === 400 || error.code === 'invalid_credentials') {
      await recordFailedSignIn(email);
      return { error: 'That email address and password do not match an account.' };
    }
    return { error: `Could not sign in: ${error.message}` };
  }

  /* No profile check here, deliberately.
     `signInWithPassword` establishes the session by queueing cookies on the
     response, but this same client cannot read them back within the same
     request. A `profiles` query at this point therefore runs unauthenticated,
     row-level security correctly returns nothing, and any "no profile" test
     reports a failure that does not exist.
     The dashboard checks for the profile on the next request, where the
     session is real, and sends the user somewhere useful if it is missing. */

  /* Recorded before the redirect, which does not return. Sign-ins are where an
     intrusion first shows: one account from two countries in an hour is only
     visible if both are written down. */
  await recordEvent({
    action: 'auth.signed_in',
    entityType: 'profile',
    entityId: data.user?.id ?? null,
  });

  revalidatePath('/', 'layout');
  redirect(safeNext(formData.get('next')));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();
  const agreed = formData.get('agree_terms') === 'on';

  if (!email || !password || !fullName) {
    return { error: 'Fill in your name, email address and a password.' };
  }

  if (password.length < 8) {
    return { error: 'Your password needs to be at least 8 characters long.' };
  }

  /* Checked on the server as well as in the browser. A required attribute is a
     convenience for the person filling the form in, not a control: consent has
     to be genuinely given, so an account cannot be created without it. */
  if (!agreed) {
    return { error: 'Please agree to the terms and privacy notice to continue.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    /* Read by the `handle_new_user` trigger to fill in the profile row. */
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: error.message };
  }

  /* Record the consent that was just given.
     Written with the service-role client rather than the caller's, for the
     same reason the profile is not read back here: this request's session
     cookies are queued on the response and cannot be read by this client, so
     an RLS-guarded insert would be filtered out and silently write nothing.
     `consents` has no UPDATE or DELETE policy, so this row cannot later be
     altered by anyone, including us. */
  if (data.user) {
    try {
      const admin = createAdminClient();
      await admin.from('consents').insert([
        {
          subject_id: data.user.id,
          subject_email: email,
          kind: 'terms',
          granted: true,
          policy_version: POLICY_VERSION,
          source: 'web',
        },
        {
          subject_id: data.user.id,
          subject_email: email,
          kind: 'privacy',
          granted: true,
          policy_version: POLICY_VERSION,
          source: 'web',
        },
      ]);
    } catch {
      /* An account that exists without its consent row is a compliance gap, but
         failing the sign-up here would leave the person with an account they
         cannot use and no way to retry. The gap is recoverable, the orphaned
         account is not, so the account wins and the omission is reported by
         the check in `supabase/SETUP.md`. */
    }
  }

  /* No profile check here either, for the same reason as in `signIn`: the
     session's cookies are queued on the response and cannot be read back by
     this client within the same request, so the query would run
     unauthenticated and always look like a missing profile. */

  /* With email confirmation switched on there is no session yet, so tell the
     user to go and confirm rather than silently landing them nowhere. */
  if (!data.session) {
    return {
      message: 'Check your email for a confirmation link, then sign in.',
    };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/sign-in');
}
