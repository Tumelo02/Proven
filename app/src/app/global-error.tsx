'use client';

/**
 * The last resort: an error thrown by the root layout itself, which the
 * ordinary `error.tsx` boundary sits inside and therefore cannot catch.
 *
 * This replaces the whole document when it renders, so it must bring its own
 * `<html>` and `<body>`, and it does not receive `globals.css`. Every style
 * here is inline for that reason.
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('[proven] root layout failed', error.digest ?? '', error);
  }, [error]);

  return (
    <html lang="en-ZA">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#f6f8fb',
          color: '#0a2540',
          font: '15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 460,
            width: '100%',
            background: '#fff',
            border: '1px solid #e3e8ef',
            borderRadius: 14,
            padding: '28px 26px',
            boxShadow: '0 8px 24px rgba(10,37,64,0.08)',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Proven is temporarily unavailable</h1>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#5b6b7f' }}>
            Something went wrong loading the platform. Your data is safe.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              width: '100%',
              padding: '11px 16px',
              borderRadius: 9,
              border: 0,
              background: '#0a2540',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: 14, marginBottom: 0, fontSize: 12, color: '#8695a8' }}>
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
