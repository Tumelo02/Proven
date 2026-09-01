'use client';

import { useState } from 'react';

export function LogoPreview({
  logoUrl,
  alt,
  fallback,
}: {
  logoUrl: string | null;
  alt: string;
  fallback: string;
}) {
  const [open, setOpen] = useState(false);

  const boxStyle = {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'var(--bg)',
    border: '1px solid var(--line)',
    overflow: 'hidden',
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 36px',
    padding: 0,
    cursor: 'pointer',
  } as const;

  if (!logoUrl) {
    return (
      <div
        style={{
          ...boxStyle,
          background: 'var(--bg)',
          fontWeight: 800,
          color: 'var(--muted)',
          fontSize: 11,
          lineHeight: 1,
          borderRadius: 10,
        }}
      >
        {fallback}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${alt} in full size`}
        style={boxStyle}
      >
        <img
          src={logoUrl}
          alt={alt}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: 3 }}
        />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 12, 18, 0.72)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 2000,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: 'min(82vw, 760px)',
              maxHeight: '82vh',
              background: '#fff',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close logo preview"
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '1px solid var(--line)',
                background: 'rgba(255,255,255,0.92)',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <img
              src={logoUrl}
              alt={alt}
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                maxHeight: '82vh',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
