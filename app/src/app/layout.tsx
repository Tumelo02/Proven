import type { Metadata, Viewport } from 'next';
import { CookieNotice } from '@/components/CookieNotice';
import { SessionTimeoutProvider } from '@/components/SessionTimeoutProvider';
import './globals.css';

/**
 * Without this, a phone renders the page at about 980px wide and scales the
 * whole thing down, so every media query below is never consulted and the text
 * is unreadable. It is the single tag that makes the rest of the responsive
 * work count.
 *
 * `maximumScale` is deliberately not set: capping zoom stops people enlarging
 * text they cannot read, and this is a product for whatever phone someone
 * already owns.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a2540',
};

export const metadata: Metadata = {
  title: 'Proven',
  description:
    'A shared evidence and growth platform for small businesses and the organisations that fund them.',
  icons: {
    icon: '/assets/logo_only__1_-removebg-preview.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <SessionTimeoutProvider>{children}</SessionTimeoutProvider>
        <CookieNotice />
      </body>
    </html>
  );
}
