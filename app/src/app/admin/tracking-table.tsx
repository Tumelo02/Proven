'use client';

import Link from 'next/link';
import { LogoPreview } from '@/components/logo-preview';
import { PagedRows } from '@/components/Paged';
import { setBusinessAccess } from './actions';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function TrackingTable({ businesses, logoUrls = {} }: { businesses: any[]; logoUrls?: Record<string, string> }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Tracking independently</h3>
        <span className="hint" style={{ marginLeft: 'auto' }}>
          {businesses.length} business{businesses.length === 1 ? '' : 'es'} with no funder
        </span>
      </div>

      {businesses.length === 0 ? (
        <div className="panel-body">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            Every business is attached to an organisation.
          </p>
        </div>
      ) : (
          <div className="table-wrap">
            <table className="fixed-cols">
              {/* Explicit widths, because the browser otherwise re-measures
                  every column against whatever happens to be on the current
                  page. That made each page of the same table a different
                  shape: one long business name or region on page three was
                  enough to squeeze the Access column until its buttons wrapped
                  onto separate lines and the row grew taller. Fixed columns
                  mean paging changes the rows and nothing else. */}
              <colgroup>
                <col style={{ width: '24%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
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
              <PagedRows label="businesses" columns={7}>
                {businesses.map(({ business, linkStatus, months, creatorEmail }) => {
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
                        {/* min-width: 0 lets this shrink inside the flex row, but
                            combined with the global `td { overflow-wrap: anywhere }`
                            rule it let the browser break the name at any character
                            once squeezed, stacking it one letter per line instead of
                            wrapping at word boundaries. overflow-wrap: normal here
                            restores ordinary word wrap; break-word still catches a
                            single word too long for the column on its own. */}
                        <div style={{ minWidth: 0, overflowWrap: 'normal', wordBreak: 'normal' }}>
                          <Link
                            href={`/admin/business/${business.id}`}
                            style={{ textDecoration: 'none', color: 'var(--ink)' }}
                          >
                            <strong style={{ overflowWrap: 'break-word' }}>{business.name}</strong>
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
                    <td className="muted tiny nowrap">{business.created_at.slice(0, 10)}</td>
                    <td>
                      <div className="access-cell">
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
              </PagedRows>
            </table>
          </div>
      )}
    </div>
  );
}
