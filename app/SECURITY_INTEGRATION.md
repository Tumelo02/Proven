# Security — Status

The single, current security document for this project. It replaces six
earlier ones (`SECURITY_ASSESSMENT.md`, `SECURITY_REMEDIATION.md`,
`SECURITY_TESTING.md`, `SECURITY_IMPLEMENTATION.md`, `DEPLOYMENT_SUMMARY.md`,
and an earlier draft of this file) that had drifted out of sync with each
other and with the code — several described a debug route, a nonce-based CSP,
and an audit-logging approach that were since deleted or deliberately not
taken. Their genuinely useful content (the original findings, the testing
checklist) is folded in below with a current status against each item, rather
than kept as five more files to re-verify the next time something changes.

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
`@upstash/redis`; both were installed but never used, and have since been
removed from `app/package.json` during a later cleanup pass. Rate limiting is
instead backed by Postgres:
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

## Findings register

From the original security assessment (1 September 2026), one row per finding
with its current, verified status — not the status the original remediation
plan assumed it would reach.

| # | Finding | Status |
|---|---|---|
| 1 | Debug endpoint reachable in production | **Fixed.** Route deleted entirely, not gated. |
| 2 | CSP allows `unsafe-inline` | **Kept deliberately**, not fixed as originally suggested — see [Content-Security-Policy](#content-security-policy) above. |
| 3 | (duplicate of #2 in the original numbering) | — |
| 4 | Session token expiry not explicit | **Partially addressed.** `createClient()` still relies on `@supabase/ssr`'s documented defaults rather than an explicit `auth: {}` block — low impact, since those defaults are sane, but not made explicit. The suggested fix (redirect based on `user.created_at`) was itself wrong and was not used; see [Session idle timeout](#session-idle-timeout) for what was built instead. |
| 5 | Insufficient input validation | **Fixed** for email (format + disposable-domain block on sign-up). Redirect targets were already validated by `safeNext()` before this review. Slugs are not yet validated with `slugSchema` — open. |
| 6 | No rate limiting | **Fixed.** Postgres-backed, not Upstash — see [Rate limiting](#rate-limiting) above. |
| 7 | Weak CORS / no origin validation | **Open.** No CORS headers are set in `vercel.json`. Same-origin requests (the only kind this app's own frontend makes) are unaffected either way; this matters if a third party is ever meant to call these routes directly. |
| 8 | Audit log detail / privacy | **Decided, not fixed as suggested.** Exact IPs and user agents are kept intentionally — see [Audit logging](#audit-logging) above. |
| 9 | Missing HSTS / secure headers | **Fixed.** Present in `vercel.json`. |
| 10 | File upload gaps | **Fixed**: magic-byte verification, PDF JS detection. **Not done**: malware/antivirus scanning (ClamAV or similar) and the file-size reduction to 5 MB — the limit is still 10 MB, unchanged. |
| 11 | Raw database error codes shown to users | **Open.** `app/src/app/businesses/actions.ts` still returns messages like `` Business insert failed (${insertError.code}): ${insertError.message} `` directly to the caller. |
| 12 | No request-ID tracking on API routes | **Open.** No route sets `X-Request-ID`. |
| 13 | No automated dependency scanning | **Fixed.** `.github/workflows/security.yml` runs `npm audit`, TruffleHog secret scanning, and a license check on every push. No `dependabot.yml` exists, so version-bump PRs are not automatic — only the audit/scan is. |
| 14 | Auth events other than sign-in not logged | **Open.** `signUp`, `signOut`, and `updatePassword` do not call `recordEvent`; only `signIn` (and its failure path) do. |

## Remaining open items, in rough priority order

1. **#11 — raw DB error codes.** Small, contained fix: map known Postgres
   error codes (e.g. `23505` unique violation) to a plain sentence before
   returning them from a Server Action.
2. **#14 — log sign-up/sign-out/password-change.** The `recordEvent` call
   already exists as a pattern in `signIn`; the same three lines apply to the
   other auth actions.
3. **#7 — CORS.** Only matters if something outside this app's own frontend
   is expected to call it directly. If that's not a real use case, this can
   stay open indefinitely rather than add headers for a scenario that doesn't
   exist.
4. **#5 (slug), #10 (malware scan, 5 MB limit), #12 (request IDs)** — lower
   priority; none are exploitable on their own, they narrow an existing
   defence rather than close a hole.

## Testing checklist

Trimmed from the original testing guide to the items that are either
currently verifiable facts about this codebase, or worth checking after a
real deploy. Aspirational process items (penetration testing, incident
response plans, team training) are left out — they're organisational
decisions, not something a checklist in this repo enforces.

- [x] RLS enabled on every table (verified in `supabase/migrations/`)
- [x] Service-role key confined to `createAdminClient()`, never imported into
      a Client Component
- [x] File uploads land in the private `proofs` bucket; signed URLs, not
      public links
- [x] `.env.local` files gitignored at every level (root, `app/`, `supabase/`)
- [x] Password requirements enforced server-side (12+ chars, mixed case,
      number, symbol) — not just in the browser
- [x] Sign-in rate-limited (5 / 15 min, keyed per email)
- [x] Sign-up rate-limited (3 / hr, keyed per IP)
- [x] Password-reset rate-limited (3 / hr, keyed per email)
- [x] Magic-byte check rejects a file whose content doesn't match its
      declared type, HEIC included
- [x] PDF upload containing embedded JavaScript is rejected
- [x] HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
      Permissions-Policy all present (`curl -I` against the deployed site)
- [ ] `npm audit` clean of high/critical findings (`.github/workflows/security.yml`
      runs this on every push — check the Actions tab, not a local run)
- [ ] Idle timeout warning appears after 25 minutes of no mouse/keyboard/
      scroll/touch activity while signed in, and signs out at 30

## Still outside this integration

- Nonce-based CSP (would need the inline-style migration described above)
- CORS headers (#7 — open only if a third party needs to call these routes
  directly)
- Malware/antivirus scanning of uploaded files (#10)
- File-size reduction to 5 MB (#10 — still 10 MB)
- Request-ID tracking on responses (#12)
- Sign-up / sign-out / password-change audit events (#14)
- A `dependabot.yml` for automatic version-bump PRs (the CI audit itself
  is live; this would additionally open PRs)
