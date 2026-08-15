'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createOrganisation, type OrgCreateState } from './actions';

const TYPES = [
  { value: 'funder', label: 'Funder' },
  { value: 'incubator', label: 'Incubator' },
  { value: 'accelerator', label: 'Accelerator' },
  { value: 'government', label: 'Government' },
  { value: 'other', label: 'Other' },
];

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn sm" type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create organisation'}
    </button>
  );
}

/**
 * Onboard a funder without a database console.
 *
 * Collapsed by default: this is the rarest action on the page, and an open
 * form would sit above the work queue that is the reason to open it.
 */
export function NewOrganisation() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<OrgCreateState, FormData>(
    createOrganisation,
    {},
  );

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        {state.message && <div className="notice ok">{state.message}</div>}
        <button className="btn ghost sm" type="button" onClick={() => setOpen(true)}>
          Add an organisation
        </button>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h3>Add an organisation</h3>
      </div>
      <div className="panel-body">
        {state.error && <div className="notice error">{state.error}</div>}
        {state.message && <div className="notice ok">{state.message}</div>}

        <form action={formAction}>
          <div className="txn-form">
            <div className="f">
              <label htmlFor="org_name">Name</label>
              <input
                id="org_name"
                name="name"
                type="text"
                required
                placeholder="e.g. Absa Youth Entrepreneurship Fund"
              />
            </div>
            <div className="f">
              <label htmlFor="org_slug">Code</label>
              <input id="org_slug" name="slug" type="text" placeholder="Left blank, from the name" />
            </div>
            <div className="f">
              <label htmlFor="new_org_type">Type</label>
              <select id="new_org_type" name="org_type" defaultValue="funder">
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="hint" style={{ marginTop: 8 }}>
            Their staff still need accounts. Add each person to{' '}
            <code>memberships</code> once they have signed up, as in{' '}
            <code>supabase/SETUP.md</code> step 6.
          </p>

          <div className="mactions" style={{ marginTop: 10 }}>
            <CreateButton />
            <button className="btn ghost sm" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
