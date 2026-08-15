'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createBusiness, type FormState } from '../actions';
import type { Organisation } from '@/lib/database.types';

const INDUSTRIES = [
  'Beauty & Wellness',
  'Food & Beverage',
  'Retail',
  'Transport',
  'Construction',
  'Education & Training',
  'Agriculture',
  'Technology',
  'Manufacturing',
  'Services',
  'Other',
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn block" type="submit" disabled={pending}>
      {pending ? 'Setting up…' : 'Create business'}
    </button>
  );
}

export function NewBusinessForm({ organisations }: { organisations: Organisation[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(createBusiness, {});
  /* Funding is the one branch in this form, so the funder fields are revealed
     rather than always shown: an unfunded business should not have to read
     past questions that do not apply to it. */
  const [isFunded, setIsFunded] = useState(false);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <h1>Add your business</h1>
        <p className="sub">
          Any business can join Proven, whether it has funding or not.
        </p>

        <form action={formAction}>
          {state.error && <div className="notice error">{state.error}</div>}

          <div className="field">
            <label htmlFor="name">Business name</label>
            <input id="name" name="name" type="text" required />
          </div>

          <div className="field">
            <label htmlFor="industry">What kind of business is it?</label>
            <select id="industry" name="industry" defaultValue="">
              <option value="" disabled>
                Choose one
              </option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="region">Where does it trade?</label>
            <input id="region" name="region" type="text" placeholder="e.g. Soweto, GP" />
          </div>

          <div className="field">
            <label htmlFor="started_on">When did it start trading?</label>
            <input id="started_on" name="started_on" type="date" />
          </div>

          <div className="field">
            <label htmlFor="staff_count">How many people work there?</label>
            <input id="staff_count" name="staff_count" type="number" min={0} defaultValue={0} />
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
            <legend
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 6,
                padding: 0,
              }}
            >
              Has this business received funding?
            </legend>

            <div className="row" style={{ gap: 16 }}>
              <label className="row" style={{ gap: 6, fontWeight: 500 }}>
                <input
                  type="radio"
                  name="is_funded"
                  value="no"
                  defaultChecked
                  onChange={() => setIsFunded(false)}
                  style={{ width: 'auto' }}
                />
                Not funded
              </label>
              <label className="row" style={{ gap: 6, fontWeight: 500 }}>
                <input
                  type="radio"
                  name="is_funded"
                  value="yes"
                  onChange={() => setIsFunded(true)}
                  style={{ width: 'auto' }}
                />
                Yes, funded
              </label>
            </div>

            <p className="hint">
              An unfunded business tracks and scores exactly the same way, and
              builds the same record to take to a funder later.
            </p>
          </fieldset>

          {isFunded && (
            <div
              style={{
                background: 'var(--bg)',
                borderRadius: 10,
                padding: '14px 14px 2px',
                marginBottom: 14,
              }}
            >
              <div className="field">
                <label htmlFor="org_id">Which organisation funded it?</label>
                <select id="org_id" name="org_id" defaultValue="" required={isFunded}>
                  <option value="" disabled>
                    Choose an organisation
                  </option>
                  {organisations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <p className="hint">
                  They will be asked to confirm. Until they do, they cannot see
                  your figures.
                </p>
              </div>

              <div className="field">
                <label htmlFor="amount">How much was it? (optional)</label>
                <input id="amount" name="amount" type="number" min={0} step="0.01" />
              </div>

              <div className="field">
                <label htmlFor="funded_on">When was it received? (optional)</label>
                <input id="funded_on" name="funded_on" type="date" />
              </div>
            </div>
          )}

          <SubmitButton />
        </form>

        <p className="auth-foot">
          <Link href="/dashboard">Back</Link>
        </p>
      </div>
    </div>
  );
}
