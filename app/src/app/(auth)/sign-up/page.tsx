'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signUp, type AuthState } from '../actions';
import { PasswordField } from '@/components/PasswordField';
import '../../landing.css';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn block" type="submit" disabled={pending}>
      {pending ? 'Creating your account…' : 'Create account'}
    </button>
  );
}

export default function SignUpPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(signUp, {});

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-mark">
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size
              brand mark; next/image would add a loader for no benefit here. */}
          <img src="/assets/logo_only__1_-removebg-preview.png" alt="Proven logo" />
        </div>

        <div className="auth-head">
          <h1>Create an account</h1>
          <p className="sub">Any business can join, funded or not.</p>
        </div>

        <form action={formAction}>
          {state.error && <div className="notice error">{state.error}</div>}
          {state.message && <div className="notice ok">{state.message}</div>}

          <div className="field">
            <label htmlFor="full_name">Your name</label>
            <input id="full_name" name="full_name" type="text" autoComplete="name" required />
          </div>

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <PasswordField
            autoComplete="new-password"
            minLength={12}
            hint="At least 12 characters, including uppercase, lowercase, a number and a symbol."
            showStrength
          />

          <PasswordField
            id="confirm_password"
            name="confirm_password"
            label="Confirm password"
            autoComplete="new-password"
            minLength={12}
            hint="Re-enter the same password to confirm it."
          />

          {/* Consent is recorded against the wording shown here, so this text
              and POLICY_VERSION in ../actions.ts change together. Unticked by
              default: a pre-ticked box is not consent under POPIA. */}
          <div className="field">
            <label className="row" style={{ gap: 8, alignItems: 'flex-start', fontWeight: 500 }}>
              <input
                type="checkbox"
                name="agree_terms"
                required
                style={{ width: 'auto', marginTop: 3 }}
              />
              <span style={{ fontSize: 13, lineHeight: 1.5 }}>
                I agree to the <Link href="/legal/terms">terms of use</Link> and the{' '}
                <Link href="/legal/privacy">privacy notice</Link>, and I understand
                my figures are shown to a funder only after I ask and they confirm.
              </span>
            </label>
          </div>

          <SubmitButton />
        </form>

        <p className="auth-foot">
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
