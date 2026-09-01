'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { LogoPreview } from '@/components/logo-preview';
import { setBusinessAccess } from './actions';

const PAGE_SIZE = 5;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function TrackingTable({ businesses, logoUrls = {} }: { businesses: any[]; logoUrls?: Record<string, string> }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(businesses.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageBusinesses = useMemo(
    () => businesses.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [businesses, safePage],
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Tracking independently</h3>
        <span className="hint" style={{ marginLeft: 'auto' }}>
          {businesses.length} of {businesses.length} businesses have no funder
        </span>
      </div>

      {businesses.length === 0 ? (
        <div className="panel-body">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            Every business is attached to an organisation.
          </p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Industry</th>
                  <th>Region</th>
                  <th>Created by</th>
                  <th className="num">Months</th>
                  <th>Joined</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {pageBusinesses.map(({ business, linkStatus, months, creatorEmail }) => {
                  const logoUrl = business.logo_path ? logoUrls[business.logo_path] ?? null : null;

                  return (
                  <tr key={business.id}>
                    <td>
                      <div className="biz-cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <LogoPreview
                          logoUrl={logoUrl}
                          alt={`${business.name} logo`}
                          fallback={initials(business.name)}
                        />
                        <div style={{ minWidth: 0 }}>
                          <Link
                            href={`/admin/business/${business.id}`}
                            style={{ textDecoration: 'none', color: 'var(--ink)' }}
                          >
                            <strong>{business.name}</strong>
                          </Link>
                          {linkStatus === 'pending' && (
                            <span className="chip yellow" style={{ marginLeft: 6 }}>
                              <span className="dot" />
                              Awaiting confirmation
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="muted">{business.industry || '—'}</td>
                    <td className="muted">{business.region || '—'}</td>
                    <td className="muted tiny" style={{ whiteSpace: 'nowrap' }}>
                      {creatorEmail || '—'}
                    </td>
                    <td className="num mono">
                      {months === 0 ? <span className="muted">None</span> : months}
                    </td>
                    <td className="muted tiny">{business.created_at.slice(0, 10)}</td>
                    <td>
                      <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0' }}>
                        <Link className="btn ghost sm" href={`/admin/business/${business.id}`}>
                          Summary
                        </Link>
                        <form action={setBusinessAccess} className="row" style={{ gap: 6 }}>
                          <input type="hidden" name="business_id" value={business.id} />
                          {business.access_disabled ? (
                            <>
                              <span className="chip red">Disabled</span>
                              <button className="btn ghost sm" name="action" value="enable" type="submit">
                                Restore
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="btn ghost sm" name="action" value="disable" type="submit">
                                Disable
                              </button>
                              <input name="reason" placeholder="Reason (optional)" aria-label={`Reason for disabling ${business.name}`} />
                            </>
                          )}
                        </form>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {businesses.length > PAGE_SIZE && (
            <div
              className="table-pager"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: 18,
                gap: 8,
                paddingBottom: 4,
              }}
            >
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
                style={{
                  ...(safePage <= 1 ? { pointerEvents: 'none', opacity: 0.5 } : {}),
                  padding: '6px 12px',
                  fontSize: 12,
                  minHeight: 34,
                }}
              >
                <span aria-hidden="true">&lt;</span>
                <span>Previous</span>
              </button>

              <div className="tiny muted" style={{ minWidth: 90, textAlign: 'center', fontSize: 11.5 }}>
                Page {safePage} of {totalPages}
              </div>

              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Next page"
                style={{
                  ...(safePage >= totalPages ? { pointerEvents: 'none', opacity: 0.5 } : {}),
                  padding: '6px 12px',
                  fontSize: 12,
                  minHeight: 34,
                }}
              >
                <span>Next</span>
                <span aria-hidden="true">&gt;</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
