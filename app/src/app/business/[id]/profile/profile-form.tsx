'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveProfile, type FormState } from './actions';
import type { Business } from '@/lib/database.types';

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

/* The nine provinces, so a funder filtering by area gets one spelling of each
   rather than eleven variations of "KZN". */
const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
];

/* Levels as the B-BBEE codes define them. Left blank by default: most small
   businesses are exempt rather than unrated, and "EME" says that properly. */
const BBBEE_LEVELS = [
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
  'Level 5',
  'Level 6',
  'Level 7',
  'Level 8',
  'Non-compliant',
  'EME (exempt)',
  'Not rated',
];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save profile'}
    </button>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h3>{title}</h3>
        {hint && (
          <span className="hint" style={{ marginLeft: 'auto' }}>
            {hint}
          </span>
        )}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

/**
 * The profile form.
 *
 * Everything except the name is optional, and the form says so rather than
 * marking fields required and refusing to save. A business that has no
 * registration number is not an incomplete business, it is an informal one,
 * and the form should not imply otherwise.
 */
export function ProfileForm({ business }: { business: Business }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveProfile, {});
  const b = business;

  return (
    <form action={formAction}>
      <input type="hidden" name="business_id" value={b.id} />

      {state.error && <div className="notice error">{state.error}</div>}
      {state.message && <div className="notice ok">{state.message}</div>}

      <Section title="The business" hint="What a funder sees first">
        <div className="txn-form">
          <div className="f">
            <label htmlFor="name">Business name</label>
            <input id="name" name="name" type="text" defaultValue={b.name} required />
          </div>
          <div className="f">
            <label htmlFor="tagline">In one line</label>
            <input
              id="tagline"
              name="tagline"
              type="text"
              defaultValue={b.tagline}
              placeholder="e.g. Fresh bread and cakes for Soweto families"
              maxLength={120}
            />
          </div>
          <div className="f">
            <label htmlFor="industry">Industry</label>
            <select id="industry" name="industry" defaultValue={b.industry}>
              <option value="">Choose one</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
          <div className="f">
            <label htmlFor="started_on">Trading since</label>
            <input
              id="started_on"
              name="started_on"
              type="date"
              defaultValue={b.started_on ?? ''}
            />
          </div>
        </div>

        <div className="f" style={{ marginTop: 12 }}>
          <label htmlFor="description">What the business does</label>
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={b.description}
            placeholder="What you sell, who buys it, and what makes people come back. A few sentences is plenty."
          />
        </div>
      </Section>

      <Section title="Main contact" hint="One person a funder can call">
        <div className="txn-form">
          <div className="f">
            <label htmlFor="owner_name">Owner’s full name</label>
            <input id="owner_name" name="owner_name" type="text" defaultValue={b.owner_name} />
          </div>
          <div className="f">
            <label htmlFor="owner_role">Their role</label>
            <input
              id="owner_role"
              name="owner_role"
              type="text"
              defaultValue={b.owner_role}
              placeholder="e.g. Founder, Managing member"
            />
          </div>
          <div className="f">
            <label htmlFor="owner_phone">Phone</label>
            <input
              id="owner_phone"
              name="owner_phone"
              type="tel"
              defaultValue={b.owner_phone}
              placeholder="e.g. 082 123 4567"
            />
          </div>
          <div className="f">
            <label htmlFor="owner_email">Email</label>
            <input id="owner_email" name="owner_email" type="email" defaultValue={b.owner_email} />
          </div>
        </div>
      </Section>

      <Section title="Where it trades">
        <div className="txn-form">
          <div className="f">
            <label htmlFor="address_line">Street address</label>
            <input
              id="address_line"
              name="address_line"
              type="text"
              defaultValue={b.address_line}
            />
          </div>
          <div className="f">
            <label htmlFor="city">Town or city</label>
            <input id="city" name="city" type="text" defaultValue={b.city} />
          </div>
          <div className="f">
            <label htmlFor="province">Province</label>
            <select id="province" name="province" defaultValue={b.province}>
              <option value="">Choose one</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="f">
            <label htmlFor="postal_code">Postal code</label>
            <input id="postal_code" name="postal_code" type="text" defaultValue={b.postal_code} />
          </div>
          <div className="f">
            <label htmlFor="region">Area label</label>
            <input
              id="region"
              name="region"
              type="text"
              defaultValue={b.region}
              placeholder="e.g. Soweto, GP"
            />
          </div>
        </div>
      </Section>

      <Section
        title="Registration"
        hint="Leave blank if it does not apply"
      >
        <div className="txn-form">
          <div className="f">
            <label htmlFor="registration_number">Company registration number</label>
            <input
              id="registration_number"
              name="registration_number"
              type="text"
              defaultValue={b.registration_number}
              placeholder="e.g. 2021/123456/07"
            />
          </div>
          <div className="f">
            <label htmlFor="tax_number">Tax number</label>
            <input id="tax_number" name="tax_number" type="text" defaultValue={b.tax_number} />
          </div>
          <div className="f">
            <label htmlFor="vat_number">VAT number</label>
            <input id="vat_number" name="vat_number" type="text" defaultValue={b.vat_number} />
          </div>
          <div className="f">
            <label htmlFor="bbbee_level">B-BBEE level</label>
            <select id="bbbee_level" name="bbbee_level" defaultValue={b.bbbee_level}>
              <option value="">Not stated</option>
              {BBBEE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Find us online" hint="Optional">
        <div className="txn-form">
          <div className="f">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="url"
              defaultValue={b.website}
              placeholder="https://"
            />
          </div>
          <div className="f">
            <label htmlFor="social_handle">Social media</label>
            <input
              id="social_handle"
              name="social_handle"
              type="text"
              defaultValue={b.social_handle}
              placeholder="e.g. @yourbusiness"
            />
          </div>
        </div>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <SaveButton />
      </div>
    </form>
  );
}
