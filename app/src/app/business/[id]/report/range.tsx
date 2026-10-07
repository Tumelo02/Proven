'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Ranges people actually ask for, rather than making them count months. */
function presets(): { key: string; label: string; from: string; to: string }[] {
  const now = new Date();
  const year = now.getUTCFullYear();
  const thisMonth = now.toISOString().slice(0, 7);

  const back = (n: number) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - n);
    return d.toISOString().slice(0, 7);
  };

  return [
    { key: 'ytd', label: `This year`, from: `${year}-01`, to: thisMonth },
    { key: 'last12', label: 'Last 12 months', from: back(11), to: thisMonth },
    { key: 'lastyear', label: `${year - 1}`, from: `${year - 1}-01`, to: `${year - 1}-12` },
    { key: 'last6', label: 'Last 6 months', from: back(5), to: thisMonth },
  ];
}

/**
 * The period this report covers, and the way to download it.
 *
 * This calendar year is the default, since that is what someone means when a
 * bank asks for "this year's figures". The presets cover the rest of what gets
 * asked for; the two month fields are there for anything else.
 */
export function ReportRange({
  businessId,
  from,
  to,
}: {
  businessId: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const thisMonth = new Date().toISOString().slice(0, 7);

  function apply(nextFrom: string, nextTo: string) {
    setF(nextFrom);
    setT(nextTo);
    router.push(
      `/business/${businessId}/report?from=${nextFrom}&to=${nextTo}`,
    );
  }

  return (
    <div className="panel report-range">
      <div className="panel-body">
        <div className="report-range-row">
          <div className="growth-ranges" role="group" aria-label="Report period">
            {presets().map((p) => (
              <button
                key={p.key}
                type="button"
                className={`growth-range${from === p.from && to === p.to ? ' on' : ''}`}
                onClick={() => apply(p.from, p.to)}
                aria-pressed={from === p.from && to === p.to}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="report-range-custom">
            <label className="f">
              <span>From</span>
              <input
                type="month"
                value={f}
                max={thisMonth}
                onChange={(e) => setF(e.target.value)}
              />
            </label>
            <label className="f">
              <span>To</span>
              <input
                type="month"
                value={t}
                max={thisMonth}
                onChange={(e) => setT(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => apply(f, t)}
              disabled={!f || !t || f > t}
            >
              Apply
            </button>
          </div>

          {/* A plain link, not a fetch: the browser downloads it with the
              filename the route sets, and it keeps working if JavaScript does
              not. */}
          <a
            className="btn sm report-download"
            href={`/business/${businessId}/report/download?from=${from}&to=${to}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              style={{ width: 15, height: 15 }}>
              <path d="M12 4v12" />
              <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
              <path d="M4 20h16" />
            </svg>
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
