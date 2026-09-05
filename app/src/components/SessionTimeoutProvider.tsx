'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from '@/app/(auth)/actions';
import { createClient } from '@/lib/supabase/client';

/* 30 minutes of no clicking, typing, scrolling or touching signs someone out;
   a warning appears 5 minutes before that, so a person mid-thought is not
   simply dumped back to the sign-in page. Both figures are the ones the
   original design called for. */
const WARNING_AFTER_MS = 25 * 60 * 1000;
const SIGN_OUT_AFTER_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

/**
 * Idle sign-out, mounted once in the root layout.
 *
 * Deliberately a client-side concern. A server component can tell you when an
 * account was created or when a token was issued, but "has this person
 * touched the page in the last 30 minutes" is only observable in the browser
 * — there is nothing on the server to check it against. This is also why the
 * timers below are pure browser-side state: no request is sent, and nothing
 * here runs, until there is a real signed-in session to protect.
 *
 * Quietly does nothing on a page nobody is signed in on (/, /platform,
 * /sign-in and friends): the session check below settles to `false` there,
 * so no listener is attached and no warning can ever appear where it would
 * make no sense.
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

    function armTimers() {
      clearTimers();
      setWarning(false);

      warnTimer.current = setTimeout(() => setWarning(true), WARNING_AFTER_MS);

      signOutTimer.current = setTimeout(() => {
        /* A Server Action, called directly rather than through a form: there
           is no click to attach it to, the timer itself is the trigger. */
        void signOut();
      }, SIGN_OUT_AFTER_MS);
    }

    function onActivity() {
      armTimers();
    }

    armTimers();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity));

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [signedIn]);

  function staySignedIn() {
    setWarning(false);
    /* Any of the listened-for events would reset the timer anyway; this
       button press is itself one, but firing the reset directly means the
       warning clears the instant it is pressed rather than waiting on the
       event to bubble. */
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
