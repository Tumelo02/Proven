# Security Integration — Status

This replaces an earlier draft of this document that described integration
steps for features that, at the time, were built but not wired into the app.
Everything below reflects what is actually live.

## What's live

### Input validation

`src/lib/validation.ts` — `emailSchema` (format + disposable-domain block) is
used in `signUp`, where it decides whether a *new* account may be created. It
is deliberately **not** used to gate `signIn`: a wrong password against an
account that already exists (even one made with a disposable address) is
still a legitimate sign-in attempt, and that path only checks email *format*.

Password strength is enforced by the existing `src/lib/password.ts`
(`validatePasswordStrength`), which already matched the rules in
`validation.ts`'s `passwordSchema` — there was no gap there, so
`passwordSchema` itself is unused by design rather than a missed wiring.

### File upload security

`src/lib/file-security.ts`, wired into `src/app/businesses/documents.ts`:

- `verifyMagicBytes` — confirms an uploaded file's actual bytes match its
  claimed MIME type, so a file that only *says* it's a JPEG can't slip
  through. **Fixed during integration**: the HEIC signature check originally
  read the wrong byte offset (checked `ftyp` at byte 0; it actually sits at
  byte 4, after a variable-length size field) and would have rejected every
  real HEIC photo, which is what an iPhone camera produces by default.
- `checkPDFForJavaScript` — rejects a PDF carrying embedded JavaScript.
- `sanitizeFilename` — used in place of the file's previous inline
  `safeName()`.

### Rate limiting

**Not Upstash Redis.** An earlier plan called for `@upstash/ratelimit` +
`@upstash/redis` (both are installed as dependencies but unused — left in
place rather than uninstalled, since removing them is low-value and
low-risk either way). Rate limiting is instead backed by Postgres:
`supabase/migrations/20260905100015_rate_limits.sql` plus
`src/lib/rateLimit.ts`, already wired into `signIn`, `signUp`, and
`requestPasswordReset` in `src/app/(auth)/actions.ts`. This needs no external
account, no extra environment variables, and no cost — the volumes here (auth
attempts, not general API traffic) don't warrant a dedicated cache service.

If Upstash is ever wanted for other reasons (a general API rate limiter, for
instance), it can be added independently; it does not need to replace this.

### Session idle timeout

`src/components/SessionTimeoutProvider.tsx`, mounted in the root layout.
**Rewritten from the original draft**, which computed "session age" from the
account's `created_at` (signup date) rather than actual activity — that would
have treated every session as expired exactly 30 minutes after the account
was first created, forever, and could not distinguish "not signed in" from
"session expired," which would have redirected logged-out visitors away from
the public pages `proxy.ts` deliberately leaves open (`/`, `/platform`,
`/sign-in`).

The fix: idle timeout is a client-side concern by nature — only the browser
knows when someone last clicked, typed, scrolled, or touched the screen — so
it's tracked there. The provider checks once on mount whether a session
exists at all (via the browser Supabase client, no extra network round trip)
and does nothing further if not. For a signed-in user: 25 minutes idle shows
a dismissible warning, 30 minutes idle calls the real `signOut()` server
action.

`src/lib/session.ts` was rewritten to drop the broken account-age check
entirely. What remains, `ensureValidSession()`, checks the actual token
`expires_at` Supabase issued — useful as a guard immediately before a
specific sensitive action, not as a page-level gate.

### Audit logging

**`audit-enhanced.ts` was deleted, not merged in.** It duplicated
`src/lib/audit.ts` (already live, wired into five call sites) with one
material difference: it hashed IP addresses to their first two octets and
truncated user agents to just a browser name and major version, for privacy.
Decision made explicitly: the live audit trail (`/admin/audit`) keeps exact
IPs and full user agents, because that's what actually lets an admin
distinguish one attacker hitting an account five times from five unrelated
people — a masked IP defeats that. If this decision is revisited later, the
place to change it is `requestOrigin()` in `audit.ts`, not a second module.

### Debug endpoint

**Deleted**, not merely gated. `src/app/api/debug/profile/route.ts` checked
`NODE_ENV` at request time, but the route was still compiled into every
production build regardless — reachable at a real, guessable URL, using the
service-role key, with no authentication check beyond that one environment
variable. The diagnostic capability it provided (checking or repairing a
missing `profiles` row) is already documented as a plain SQL query in
`supabase/SETUP.md`, which is what to use instead.

### Content-Security-Policy

**Not nonce-based.** An untracked, never-wired `app/middleware.ts` (predating
this integration, never committed) implemented a stricter nonce-only CSP for
production, alongside the real routing file this app actually uses,
`src/proxy.ts` (Next 16 renamed `middleware` to `proxy`; having both files
present is not a supported configuration). It's been deleted.

The CSP that's live is in `app/vercel.json`, using `'unsafe-inline'` for
`script-src` and `style-src`. This is a deliberate tradeoff, not an oversight:
a nonce only covers actual `<script>`/`<style>` elements, not the `style={{}}`
prop React writes as an inline `style` HTML attribute — which this codebase
uses extensively throughout its UI. Switching to nonce-only would block that
styling on every page unless every inline style were first migrated to CSS
classes, which is a substantial, separate piece of work, not something to fold
in here. The current CSP still blocks the actual cross-origin threat (loading
a script or stylesheet from an attacker-controlled domain); it just doesn't
additionally forbid this app's own inline styles.

## Verification

- [x] Debug endpoint: route deleted, not merely 404-gated
- [x] CSP header present via `vercel.json` (`script-src`/`style-src` with
      `'unsafe-inline'`, not nonce-based — see above)
- [x] Zod rejects malformed emails and disposable domains at sign-up
- [x] File upload rejects content that doesn't match its declared MIME type,
      including HEIC (fixed the offset bug during integration)
- [x] Rate limiting active on sign-in (5/15min), sign-up (3/hr per IP),
      password reset (3/hr per email) — Postgres-backed, not Upstash
- [x] Idle session warning at 25 minutes, sign-out at 30 minutes, tracked
      client-side against real activity
- [x] Audit log records exact IP and user agent (by decision, not omission)
- [x] HSTS header present via `vercel.json`

## Still outside this integration

- Nonce-based CSP (would need the inline-style migration described above)
- Any use of `@upstash/ratelimit`/`@upstash/redis` (installed, unused)
