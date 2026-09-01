// app/src/lib/session.ts
import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const SESSION_MAX_AGE = 30 * 60 * 1000; // 30 minutes in milliseconds
const SESSION_WARNING_TIME = 5 * 60 * 1000; // 5 minutes before expiry

export interface SessionStatus {
  valid: boolean;
  expired: boolean;
  expiringSoon: boolean;
  timeRemaining: number; // milliseconds
}

/**
 * Check if the current session is valid and not expired
 */
export async function checkSessionValidity(): Promise<SessionStatus> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return {
        valid: false,
        expired: true,
        expiringSoon: false,
        timeRemaining: 0,
      };
    }

    // Get user to check if session was created recently
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.created_at) {
      return {
        valid: false,
        expired: true,
        expiringSoon: false,
        timeRemaining: 0,
      };
    }

    const sessionAge = Date.now() - new Date(user.created_at).getTime();

    return {
      valid: sessionAge < SESSION_MAX_AGE,
      expired: sessionAge >= SESSION_MAX_AGE,
      expiringSoon: sessionAge >= SESSION_MAX_AGE - SESSION_WARNING_TIME,
      timeRemaining: Math.max(0, SESSION_MAX_AGE - sessionAge),
    };
  } catch {
    return {
      valid: false,
      expired: true,
      expiringSoon: false,
      timeRemaining: 0,
    };
  }
}

/**
 * Enforce session timeout - redirects to sign-in if session is expired
 */
export async function enforceSessionTimeout(): Promise<boolean> {
  const { valid, expired } = await checkSessionValidity();

  if (expired) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/sign-in?reason=session-expired');
  }

  return valid;
}

/**
 * Enforce session timeout for sensitive operations
 * Should be called before document reviews, org creation, etc.
 */
export async function ensureValidSession(): Promise<void> {
  const { valid, expired } = await checkSessionValidity();

  if (expired) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!valid) {
    throw new Error('Invalid session. Please sign in again.');
  }
}
