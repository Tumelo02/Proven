'use server';

/**
 * Authentication actions.
 *
 * Errors are returned as values rather than thrown, so a wrong password
 * re-renders the form with a message instead of showing an error page.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { recordEvent, recordFailedSignIn } from '@/lib/audit';
import { POLICY_VERSION } from '@/lib/policy';
import { validatePasswordStrength } from '@/lib/password';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rateLimit';
import { emailSchema } from '@/lib/validation';
import { z } from 'zod';

export interface AuthState {
  error?: string;
  message?: string;
}

function siteOrigin(requestHeaders: Headers): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (configuredOrigin) return configuredOrigin;

  const forwardedHost = requestHeaders.get('x-forwarded-host');
  const host = forwardedHost ?? requestHeaders.get('host');
  const forwardedProto = requestHeaders.get('x-forwarded-proto');
  const protocol = forwardedProto?.split(',')[0]?.trim() || 'http';
  return host ? `${protocol}://${host}` : 'http://localhost:3000';
}

/** Only allow relative paths, so `?next=` cannot bounce a user to another site. */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : '';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return '/dashboard';
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const rawEmail = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!rawEmail || !password) {
    return { error: 'Enter your email address and password.' };
  }

  /* Format only, checked with plain z.string().email() rather than the full
     emailSchema: that schema also blocks disposable domains, which is right
     for creating a new account but wrong here — a wrong password against an
     existing account made with a disposable address is still a legitimate
     sign-in attempt, and this path must not reject people out of an account
     they already have. */
  if (!z.string().email().safeParse(rawEmail).success) {
    return { error: 'Enter a valid email address.' };
  }
  const email = rawEmail.toLowerCase();

  /* Keyed on the email being tried, not the caller's IP: an attacker spread
     across many addresses is still limited per account, which is the thing
     actually at risk. Checked before Supabase is asked anything, so a limited
     caller cannot even spend an auth attempt once refused. */
  const withinLimit = await checkRateLimit(
    `signin:${email.toLowerCase()}`,
    RATE_LIMITS.signIn.max,
    RATE_LIMITS.signIn.windowSeconds,
  );
  if (!withinLimit) {
    await recordFailedSignIn(email);
    return { error: 'Too many attempts. Please wait 15 minutes and try again.' };
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
     visible if both are written down.

     A Proven staff sign-in is raised to `alert`. That account can see every
     organisation on the platform, so it is the single highest-value target
     here, and it should never scroll past unnoticed among ordinary traffic.
     Read with the service-role client because this request's session cookies
     are queued on the response and cannot be read back yet. */
  let staffSignIn = false;
  if (data.user) {
    try {
      const admin = createAdminClient();
      const { data: p } = await admin
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', data.user.id)
        .maybeSingle();
      staffSignIn = p?.is_platform_admin === true;
    } catch {
      /* Unknown means recorded as ordinary. A missing severity is better than
         a failed sign-in. */
    }
  }

  await recordEvent({
    action: staffSignIn ? 'auth.staff_signed_in' : 'auth.signed_in',
    entityType: 'profile',
    entityId: data.user?.id ?? null,
    severity: staffSignIn ? 'alert' : 'info',
  });

  revalidatePath('/', 'layout');
  redirect(safeNext(formData.get('next')));
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    return { error: 'Enter your email address.' };
  }

  /* This sends real email through Supabase's mailer, so an unlimited version
     of this action is a way to flood one inbox, or run up the project's email
     quota by repeating it against many addresses. Keyed on the email, so it
     limits the target being reset, not just the caller. */
  const withinLimit = await checkRateLimit(
    `reset:${email.toLowerCase()}`,
    RATE_LIMITS.passwordReset.max,
    RATE_LIMITS.passwordReset.windowSeconds,
  );
  if (!withinLimit) {
    /* Same message as success, deliberately: telling a limited caller "too
       many requests for that address" would confirm the address has an
       account, which is exactly what the vague success message below is
       written to avoid. */
    return {
      message: 'If an account exists for that email, we sent a password reset link.',
    };
  }

  const requestHeaders = await headers();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteOrigin(requestHeaders)}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: `Could not send a reset email: ${error.message}` };
  }

  return {
    message: 'If an account exists for that email, we sent a password reset link.',
  };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');

  if (!password || !confirmPassword) {
    return { error: 'Enter and confirm your new password.' };
  }

  if (password !== confirmPassword) {
    return { error: 'The passwords do not match.' };
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return { error: passwordError };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: `Could not update your password: ${error.message}` };
  }

  revalidatePath('/', 'layout');
  redirect('/sign-in?password=updated');
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const rawEmail = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();
  const agreed = formData.get('agree_terms') === 'on';

  if (!rawEmail || !password || !confirmPassword || !fullName) {
    return { error: 'Fill in your name, email address, password and confirmation.' };
  }

  /* The full schema here, disposable-domain block included: this is the one
     path where it belongs, since it decides whether a NEW account gets
     created, not whether an existing one may sign in. */
  const emailCheck = emailSchema.safeParse(rawEmail);
  if (!emailCheck.success) {
    return { error: emailCheck.error.issues[0]?.message ?? 'Enter a valid email address.' };
  }
  const email = emailCheck.data;

  if (password !== confirmPassword) {
    return { error: 'The passwords do not match.' };
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return { error: passwordError };
  }

  /* Checked on the server as well as in the browser. A required attribute is a
     convenience for the person filling the form in, not a control: consent has
     to be genuinely given, so an account cannot be created without it. */
  if (!agreed) {
    return { error: 'Please agree to the terms and privacy notice to continue.' };
  }

  /* Keyed on IP rather than email: the account being created is new by
     definition, so there is no existing identity to key against. This limits
     how many accounts one source can create, which is the actual risk. */
  const ip = await getClientIP();
  const withinLimit = await checkRateLimit(
    `signup:${ip}`,
    RATE_LIMITS.signUp.max,
    RATE_LIMITS.signUp.windowSeconds,
  );
  if (!withinLimit) {
    return { error: 'Too many accounts created from this connection. Please try again later.' };
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
