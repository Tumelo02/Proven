'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn, type AuthState } from '../actions';
import { PasswordField } from '@/components/PasswordField';
import '../../landing.css';

/**
 * Demo accounts, seeded by `..._demo_data.sql`.
 *
 * Offered as a picker so a judge can be signed in with two clicks, without
 * anyone reading an email address out loud. They exist only if that migration
 * has been run; on a real deployment it is not, which is why the control is
 * clearly labelled as demo data.
 */
const DEMO_PASSWORD = 'proven2026';

const DEMO_ACCOUNTS = {
  entrepreneur: [
    { who: 'Nandi Beauty Studio', note: 'Healthy', email: 'nandi-beauty@demo.proven.co.za' },
    { who: 'Soweto Sunrise Bakery', note: 'On watch', email: 'soweto-bakery@demo.proven.co.za' },
    { who: 'Zola Deliveries', note: 'At risk', email: 'zola-deliveries@demo.proven.co.za' },
  ],
  funder: [
    {
      who: 'Absa Youth Entrepreneurship Fund',
      note: 'All three businesses',
      email: 'funder@demo.proven.co.za',
    },
  ],
} as const;

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

  /* The demo picker appears only when a role was actually chosen on the
     landing screen. Arriving from anywhere else, notably `/admin`, means this
     is not a walkthrough: Proven staff signing in should not be handed a list
     of demo business logins, and neither should anyone who reached the form
     by a direct link. */
  const roleParam = params.get('role');
  const role = roleParam === 'funder' ? 'funder' : roleParam === 'entrepreneur' ? 'entrepreneur' : null;

  const [state, formAction] = useActionState<AuthState, FormData>(signIn, {});

  /* Controlled, so choosing a demo account can fill the form in. Typing still
     works exactly as normal. */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const accounts = role ? DEMO_ACCOUNTS[role] : [];

  function chooseDemo(value: string) {
    if (!value) return;
    setEmail(value);
    setPassword(DEMO_PASSWORD);
  }

  return (
    <>
      {role && (
        <div className="field demo-picker">
          <label htmlFor="demo">Demo account</label>
          <select
            id="demo"
            value={accounts.some((a) => a.email === email) ? email : ''}
            onChange={(e) => chooseDemo(e.target.value)}
          >
            <option value="">Choose one to fill this in…</option>
            {accounts.map((a) => (
              <option key={a.email} value={a.email}>
                {a.who} &middot; {a.note}
              </option>
            ))}
          </select>
          <p className="hint">
            For a walkthrough. Fills in the email and password below.
          </p>
        </div>
      )}

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
