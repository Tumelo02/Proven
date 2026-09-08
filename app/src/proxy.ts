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
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
  isIdleExpired,
  readLastSeen,
} from '@/lib/idle';

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
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/auth/sign-out',
  '/access-disabled',
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

  /* Older reset emails may point at the project Site URL (`/`) rather than
     the callback route. Forward their one-time code into the same recovery
     flow so users do not land on the public story page. */
  if (pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    url.searchParams.set('next', '/reset-password');
    return NextResponse.redirect(url);
  }

  /* Idle expiry, checked before anything else this session could reach.

     A Supabase session outlives the tab it was created in, so closing the
     browser and coming back later would otherwise resume it — on a shared
     phone that hands the previous person's business to whoever opens the link
     next. The activity cookie records when this session was last actually
     used; if that was too long ago, the session ends here rather than being
     silently restored.

     Public pages are left alone: there is nothing to protect on them, and
     signing a visitor out of the story page would be nonsense. */
  if (user && !isPublic(pathname)) {
    const lastSeen = readLastSeen(request.cookies.get(ACTIVITY_COOKIE)?.value);

    if (isIdleExpired(lastSeen)) {
      /* Sign out for real. Clearing the cookie alone would leave a valid
         refresh token in the browser, which is the flaw being closed, so the
         token is revoked at Supabase as well. */
      await supabase.auth.signOut();

      const url = request.nextUrl.clone();
      url.pathname = '/sign-in';
      url.search = '';
      url.searchParams.set('timeout', '1');

      const redirectResponse = NextResponse.redirect(url);
      /* Carry over whatever cookie clearing `signOut` queued, then drop the
         activity marker itself. */
      for (const cookie of response.cookies.getAll()) {
        redirectResponse.cookies.set(cookie);
      }
      redirectResponse.cookies.delete(ACTIVITY_COOKIE);
      return redirectResponse;
    }
  }

  if (user && pathname !== '/access-disabled') {
    const { data: disabledBusiness, error } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .eq('access_disabled', true)
      .limit(1)
      .maybeSingle();

    /* Fail open if an older database has not received the status migration or
       if Supabase is temporarily unavailable. The normal RLS checks remain
       the security boundary for every page and write. */
    if (!error && disabledBusiness) {
      const url = request.nextUrl.clone();
      url.pathname = '/access-disabled';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

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

  /* Navigating a page is itself activity, so the window moves with the user
     and someone working steadily is never interrupted. The client-side timer
     refreshes this too, which covers the long stretches where a person is
     typing into one page without navigating.

     `maxAge` matches the idle limit, so the browser drops the cookie at
     roughly the moment it stops being valid. The check above does not depend
     on that — an absent cookie reads as expired either way — it simply avoids
     leaving a stale marker lying around. */
  /* Only on the pages the check above actually guards. Refreshing the marker
     on public pages too would be a hole rather than a courtesy: a signed-in
     person sitting on the story page skips the idle check, so renewing their
     clock there would keep an otherwise dead session alive indefinitely. */
  if (user && !isPublic(pathname)) {
    /* Not httpOnly, by design: the browser-side idle timer has to write this
       on real user activity. It carries only a timestamp, and forging it can
       only shorten a session, never extend one. */
    response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), activityCookieOptions());
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
