'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updatePassword, type AuthState } from '../actions';
import { PasswordField } from '@/components/PasswordField';
import '../../landing.css';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn block" type="submit" disabled={pending}>
      {pending ? 'Updating password…' : 'Update password'}
    </button>
  );
}

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(updatePassword, {});
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-mark">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand mark. */}
          <img src="/assets/logo_only__1_-removebg-preview.png" alt="Proven logo" />
        </div>

        <div className="auth-head">
          <h1>Choose a new password</h1>
          <p className="sub">Make it unique to Proven and easy for you to keep secure.</p>
        </div>

        <form action={formAction}>
          {state.error && <div className="notice error">{state.error}</div>}

          <PasswordField
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={12}
            hint="At least 12 characters, including uppercase, lowercase, a number and a symbol."
            showStrength
          />

          <PasswordField
            id="confirm_password"
            name="confirm_password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            minLength={12}
          />

          <SubmitButton />
        </form>

        <p className="auth-foot">
          Need a new reset link? <Link href="/forgot-password">Start again</Link>
        </p>
      </div>
    </div>
  );
}
