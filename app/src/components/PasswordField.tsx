'use client';

import { useMemo, useState } from 'react';

/**
 * A password box with a reveal toggle.
 *
 * People mistype passwords on phones constantly, and a wrong password is
 * indistinguishable from a broken account from the user's side. Letting them
 * see what they typed removes a whole class of support question.
 *
 * The button is `type="button"`, so it can never submit the form by accident,
 * and it carries `aria-pressed` so a screen reader announces the current
 * state rather than just "button".
 */
function getPasswordStrength(password: string) {
  if (!password) {
    return { label: 'No password', tone: 'empty' };
  }

  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return { label: 'Weak', tone: 'weak' };
  }

  if (score <= 4) {
    return { label: 'Medium', tone: 'medium' };
  }

  return { label: 'Strong', tone: 'strong' };
}

export function PasswordField({
  id = 'password',
  name = 'password',
  label = 'Password',
  autoComplete = 'current-password',
  minLength,
  hint,
  value,
  onChange,
  showStrength = false,
}: {
  id?: string;
  name?: string;
  label?: string;
  autoComplete?: string;
  minLength?: number;
  hint?: string;
  /** Optional, for forms that need to fill the field in programmatically. */
  value?: string;
  onChange?: (value: string) => void;
  showStrength?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [internalValue, setInternalValue] = useState(value ?? '');

  const passwordValue = value !== undefined ? value : internalValue;
  const strength = useMemo(() => getPasswordStrength(passwordValue), [passwordValue]);

  const handleChange = (newValue: string) => {
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>

      <div className="password-wrap">
        <input
          id={id}
          name={name}
          type={revealed ? 'text' : 'password'}
          autoComplete={autoComplete}
          {...(minLength !== undefined ? { minLength } : {})}
          value={passwordValue}
          onChange={(e) => handleChange(e.target.value)}
          required
        />

        <button
          type="button"
          className="password-toggle"
          onClick={() => setRevealed((r) => !r)}
          aria-pressed={revealed}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          title={revealed ? 'Hide password' : 'Show password'}
        >
          {revealed ? (
            /* Eye with a line through it: the password is visible, and this
               hides it again. */
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.6-6 10-6c1.9 0 3.5.5 4.9 1.2" />
              <path d="M20.8 9.3c.7.8 1.2 1.6 1.2 1.6s-3.6 6-10 6c-1 0-1.9-.1-2.7-.4" />
              <path d="m3 3 18 18" />
              <path d="M9.9 9.9a2.6 2.6 0 0 0 3.6 3.6" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
              <circle cx="12" cy="12" r="2.6" />
            </svg>
          )}
        </button>
      </div>

      {showStrength && (
        <div className={`password-strength ${strength.tone}`} aria-live="polite">
          Strength: <strong>{strength.label}</strong>
        </div>
      )}

      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
