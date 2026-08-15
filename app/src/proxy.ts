/**
 * Session refresh and route guarding.
 *
 * The `proxy` file convention, which replaced `middleware` in Next 16.
 *
 * Runs before every matched request. Two jobs:
 *
 *   1. Refresh the auth token. Server Components cannot write cookies, so
 *      without this a session would expire mid-visit and the user would be
 *      signed out while still clicking around.
 *   2. Keep signed-out visitors out of the app, and signed-in ones out of the
 *      sign-in pages.
 *
 * This is a convenience, not the security boundary. Even if it were bypassed
 * entirely, row-level security would still return nothing.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Pages reachable without signing in.
 *
 * `/` is the story of why Proven exists and `/platform` is the role picker.
 * Both are the pitch, shown to people who have no account and may never get
 * one, so neither may sit behind a sign-in wall.
 */
const PUBLIC_PATHS = [
  '/',
  '/platform',
  '/sign-in',
  '/sign-up',
  '/auth/callback',
  '/auth/sign-out',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  /* `getUser` revalidates against the auth server. `getSession` only reads the
     cookie, which a client could have forged, so it must not be used to decide
     access. */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    /* Remember where they were headed, so signing in resumes the journey
       rather than dumping them on a generic landing page. */
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/sign-in' || pathname === '/sign-up')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /* Everything except static assets and image files, which never need a
       session check and would only slow the response down. */
    '/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
