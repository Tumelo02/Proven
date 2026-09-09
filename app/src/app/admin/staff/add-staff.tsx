'use client';

import { useState } from 'react';
import { StaffRoleForm } from './staff-form';
import { InviteStaff } from './invite-staff';
import { searchAccounts, type FoundAccount } from './search';

/**
 * Adding someone to the staff.
 *
 * Two ways in. Searching finds someone who already has a Proven account, which
 * is the commoner case and stays the obvious one. Inviting covers the person
 * who has never signed up: they get a link and set their own password, so an
 * account is never created with a password somebody else chose.
 *
 * Deliberately requires three characters before searching, and never lists
 * every account on the platform: this screen is for granting access to a
 * colleague whose address is known, not for browsing the user table.
 */
export function AddStaff() {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<FoundAccount[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<FoundAccount | null>(null);

  async function onSearch(event: React.FormEvent) {
    event.preventDefault();
    if (term.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await searchAccounts(term));
    } finally {
      setSearching(false);
    }
  }

  if (chosen) {
    return (
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>Give staff access</h3>
        </div>
        <div className="panel-body">
          <StaffRoleForm
            userId={chosen.id}
            email={chosen.email}
            onDone={() => {
              setChosen(null);
              setResults(null);
              setTerm('');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h3>Add someone to the staff</h3>
        <span className="hint" style={{ marginLeft: 'auto' }}>
          Search an existing account, or invite by email
        </span>
      </div>
      <div className="panel-body">
        <form onSubmit={onSearch} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search by email address"
            aria-label="Search accounts by email address"
            style={{ flex: '1 1 260px' }}
          />
          <button className="btn sm" type="submit" disabled={searching || term.trim().length < 3}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results !== null && results.length === 0 && (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0, marginTop: 12 }}>
            No account matches that, among people who are not already staff.
          </p>
        )}

        <InviteStaff />

        {results !== null && results.length > 0 && (
          <div className="staff-results">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="staff-result"
                onClick={() => setChosen(r)}
              >
                <span>
                  <b>{r.email}</b>
                  {r.fullName && <span className="tiny muted"> · {r.fullName}</span>}
                </span>
                <span className="tiny">Choose</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
