// app/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...Array.from(bytes)));
}

/**
 * Middleware for security headers including CSP with nonce
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // The strict CSP is valuable in production, but React DevTools and the
  // Next.js development overlay both inject inline styles and scripts. Those
  // are intentionally blocked by a nonce-only policy, so local development
  // would never render normally. Keep the hardening for production while
  // leaving the dev environment usable.
  if (process.env.NODE_ENV !== 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
    );
    return response;
  }

  // Generate nonce for this request. This must use the Edge Runtime-safe Web
  // Crypto API, not Node's `crypto` module.
  const nonce = createNonce();

  // Build CSP header with nonce
  const csp = [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.vercel-analytics.com https://vercel-analytics.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https://*.supabase.co https://cdn.jsdelivr.net",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel-analytics.com https://cdn.vercel-analytics.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
    "block-all-mixed-content",
  ].join('; ');

  // Add security headers
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-CSP-Nonce', nonce);
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
