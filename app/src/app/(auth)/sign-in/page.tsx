'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn, type AuthState } from '../actions';
import { PasswordField } from '@/components/PasswordField';
import '../../landing.css';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn block" type="submit" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

function SignInForm() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';

  const roleParam = params.get('role');
  const role = roleParam === 'funder' ? 'funder' : roleParam === 'entrepreneur' ? 'entrepreneur' : null;

  const [state, formAction] = useActionState<AuthState, FormData>(signIn, {});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <>
      <form action={formAction}>
        {state.error && <div className="notice error">{state.error}</div>}

        <input type="hidden" name="next" value={next} />

        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <PasswordField value={password} onChange={setPassword} />

        <SubmitButton />
      </form>
    </>
  );
}

function RoleHeading() {
  const params = useSearchParams();
  const role = params.get('role');

  /* Arriving from `/admin` is a staff sign-in, not a walkthrough. Saying so
     avoids a page that offers demo businesses to someone who wants neither. */
  if (params.get('next') === '/admin') {
    return (
      <>
        <h1>Proven staff</h1>
        <p className="sub">Sign in to the administration view.</p>
      </>
    );
  }

  if (role === 'funder') {
    return (
      <>
        <h1>Enter as Funder</h1>
        <p className="sub">See your funded portfolio and how each business is doing.</p>
      </>
    );
  }
  if (role === 'entrepreneur') {
    return (
      <>
        <h1>Enter as Entrepreneur</h1>
        <p className="sub">Track your business health and build a verified record.</p>
      </>
    );
  }
  return (
    <>
      <h1>Sign in</h1>
      <p className="sub">Welcome back to Proven.</p>
    </>
  );
}

export default function SignInPage() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 430 }}>
        {/* The mark sits above the heading and centres the whole card, so the
            page reads as Proven before it reads as a form. */}
        <div className="auth-mark">
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size
              brand mark; next/image would add a loader for no benefit here. */}
          <img src="/assets/logo_only__1_-removebg-preview.png" alt="Proven logo" />
        </div>

        <div className="auth-head">
          <Suspense fallback={<h1>Sign in</h1>}>
            <RoleHeading />
          </Suspense>
        </div>

        <Suspense fallback={<p className="muted">Loading…</p>}>
          <SignInForm />
        </Suspense>

        <p className="auth-foot">
          No account yet? <Link href="/sign-up">Create one</Link>
          <br />
          <Link href="/platform">Back to choosing a view</Link>
        </p>
      </div>
    </div>
  );
}
