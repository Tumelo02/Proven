'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from '@/app/(auth)/actions';
import { createClient } from '@/lib/supabase/client';
import {
  ACTIVITY_COOKIE,
  IDLE_LIMIT_MS,
  IDLE_WARNING_MS,
  isIdleExpired,
  readLastSeen,
} from '@/lib/idle';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

/** Read one cookie by name from `document.cookie`. */
function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

/**
 * Idle sign-out, mounted once in the root layout.
 *
 * This is the comfortable half of the timeout: it warns before the deadline
 * and keeps the clock fresh while someone is genuinely working, so a person
 * mid-sentence is not simply dumped back at the sign-in page.
 *
 * It is NOT what enforces the timeout. Its timers live in the tab and die with
 * it, which is why closing the browser used to leave a session that resumed
 * days later. Enforcement belongs in `proxy.ts`, which checks the same
 * activity cookie on every request and cannot be skipped by closing a tab.
 * What this component adds on top is the warning, and — importantly — writing
 * the activity marker while a person types into one page for a long stretch
 * without ever navigating.
 *
 * Quietly does nothing where nobody is signed in (/, /platform, /sign-in and
 * friends): the session check settles to `false` there, so no listener is
 * attached and no warning can appear where it would make no sense.
 */
export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [warning, setWarning] = useState(false);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const signOutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* Checked once on mount, from the session Supabase's own client already
     holds — no network request of its own, since the SDK caches this. */
  useEffect(() => {
    let cancelled = false;

    async function checkSignedIn() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled) setSignedIn(!!session);
      } catch {
        if (!cancelled) setSignedIn(false);
      }
    }

    checkSignedIn();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!signedIn) return;

    function clearTimers() {
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (signOutTimer.current) clearTimeout(signOutTimer.current);
    }

    /* Written on real activity so that a long spell of typing inside one page,
       which sends no request and so never reaches the proxy, still counts as
       being present. Same name and lifetime the server uses. */
    function stampActivity() {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie =
        `${ACTIVITY_COOKIE}=${Date.now()}; path=/; max-age=${IDLE_LIMIT_MS / 1000}` +
        `; SameSite=Lax${secure}`;
    }

    function armTimers(from: number) {
      clearTimers();
      setWarning(false);

      /* Timers are set from the moment of last activity, not from now. On a
         tab restored from the background — or reopened after the laptop was
         shut — the elapsed time has already been served, so the warning and
         the sign-out fire at the right moment instead of granting a fresh
         thirty minutes. */
      const elapsed = Date.now() - from;
      warnTimer.current = setTimeout(
        () => setWarning(true),
        Math.max(0, IDLE_WARNING_MS - elapsed),
      );
      signOutTimer.current = setTimeout(
        () => {
          /* A Server Action, called directly rather than through a form: there
             is no click to attach it to, the timer itself is the trigger. */
          void signOut();
        },
        Math.max(0, IDLE_LIMIT_MS - elapsed),
      );
    }

    function onActivity() {
      stampActivity();
      armTimers(Date.now());
    }

    /* Coming back to a backgrounded tab is the case the old in-memory version
       missed entirely: the machine may have been asleep for hours. Re-read the
       marker rather than trusting timers that could not run while suspended,
       and end the session immediately if the window has already passed. */
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      const lastSeen = readLastSeen(readCookie(ACTIVITY_COOKIE));
      if (isIdleExpired(lastSeen)) {
        void signOut();
        return;
      }
      armTimers(lastSeen ?? Date.now());
    }

    /* Start from whatever the server last recorded, so a reloaded page
       continues the existing clock instead of restarting it. */
    const initial = readLastSeen(readCookie(ACTIVITY_COOKIE));
    if (isIdleExpired(initial)) {
      void signOut();
      return;
    }
    armTimers(initial ?? Date.now());

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity));
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [signedIn]);

  function staySignedIn() {
    setWarning(false);
    /* Any of the listened-for events would reset the timer anyway; this button
       press is itself one, but firing the reset directly means the warning
       clears the instant it is pressed rather than waiting on the event to
       bubble. */
    window.dispatchEvent(new Event('mousedown'));
  }

  return (
    <>
      {children}
      {warning && (
        <div
          role="alertdialog"
          aria-live="assertive"
          style={{
            position: 'fixed',
            left: 16,
            right: 16,
            bottom: 16,
            zIndex: 1100,
            maxWidth: 480,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            background: 'var(--yellow-soft, #fdf1dc)',
            border: '1px solid #f0d59b',
            color: 'var(--yellow, #a86a00)',
            borderRadius: 12,
            padding: '13px 16px',
            boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.12))',
            fontSize: 13,
          }}
        >
          <span style={{ flex: '1 1 240px', fontWeight: 700 }}>
            You will be signed out in 5 minutes due to inactivity.
          </span>
          <button
            type="button"
            onClick={staySignedIn}
            className="btn"
            style={{ flex: '0 0 auto', padding: '7px 14px', fontSize: 13 }}
          >
            Stay signed in
          </button>
        </div>
      )}
    </>
  );
}
