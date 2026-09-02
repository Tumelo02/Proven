'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestPasswordReset, type AuthState } from '../actions';
import '../../landing.css';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn block" type="submit" disabled={pending}>
      {pending ? 'Sending link…' : 'Send reset link'}
    </button>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-mark">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand mark. */}
          <img src="/assets/logo_only__1_-removebg-preview.png" alt="Proven logo" />
        </div>

        <div className="auth-head">
          <h1>Reset your password</h1>
          <p className="sub">Enter your account email and we’ll send you a secure reset link.</p>
        </div>

        <form action={formAction}>
          {state.error && <div className="notice error">{state.error}</div>}
          {state.message && <div className="notice ok">{state.message}</div>}

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <SubmitButton />
        </form>

        <p className="auth-foot">
          Remember your password? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
