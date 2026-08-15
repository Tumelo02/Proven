# Proven

**Turning Potential into Proof.**

**A shared evidence and growth platform for funded businesses, not a surveillance tool.**

Proven helps funders monitor funded businesses while helping entrepreneurs
understand and improve their own performance. Both sides see the same score,
the same explanation, and the same next step. Entrepreneurs see how to
improve; funders see whether improvement is happening.

**We don't just track where funding went. We help determine whether the
funding is helping build a sustainable business, and create the evidence to
prove it.**

*Funding creates potential. Performance creates evidence. Proven turns that
evidence into proof.*

Proven is a web application, in [`app/`](app/), backed by Postgres through
Supabase.

| Route | For | What it is |
|---|---|---|
| **`/`** | Judges, mentors, anyone seeing this for the first time | A short guided walkthrough of the four-step loop: Track, Detect, Guide, Prove. |
| **`/platform`** | Anyone going further | The two entry points, **Enter as Entrepreneur** and **Enter as Funder**. |
| **`/business/[id]`** | An entrepreneur | Their workspace: figures, transactions, evidence, stages, guidance, profile. |
| **`/funder/[orgId]`** | A funder, incubator or accelerator | The portfolio, worst first, with the same scores the entrepreneurs see. |

> **The standalone HTML prototype has been retired.** It served its purpose
> through the pitch and its every feature now lives in the app, which is the
> only codebase from here. It remains in git history if it is ever needed:
> `git show adac902:dashboard.html`.

---

## Built with

Proven is a full product with accounts, a database and row-level security.

| Technology | What it does here |
|---|---|
| **TypeScript** | The language of the whole codebase, [`app/`](app/) and [`packages/engine/`](packages/engine/). Types describe a business, a reporting period and a score, so a missing figure or a wrong tier is a compile error rather than a bad number shown to a funder. |
| **CSS** | All visual design, hand-written, no framework: the Proven palette, the health-tier colours (green, yellow, red), and the responsive sidebar-and-panel layout. |
| **React** | The dashboards themselves. Most of it renders on the server; only the pieces that genuinely need to react to a click, such as revealing the funder fields when a business says it is funded, run in the browser. |
| **Next.js** | The web framework **and** the backend, one project. React Server Components render the dashboards, Server Actions handle every write, and both deploy to Vercel as serverless functions. No separate server. |
| **Supabase** | Managed **PostgreSQL** for businesses, reporting periods, transactions and milestones; **Auth** for sign-in; **Storage** for receipts and invoices; and **row-level security** so an organisation can only ever read its own data, enforced by the database rather than by application code. |
| **SQL** | Schema, constraints and the row-level-security policies that make the platform safely multi-tenant. |

The scoring and guidance engine is shared TypeScript in
[`packages/engine/`](packages/engine/). One implementation serves both sides,
so a score shown to an entrepreneur and the same score shown to their funder
cannot drift apart.

**No AI or machine learning is used anywhere.** Every score, tier and
recommendation comes from published, rule-based arithmetic, deliberately, so
any number on screen can be explained to the person it describes.

**Proof of transaction.** On the Entrepreneur side, Transactions lets you
attach a receipt or invoice to any entry. Files go to Supabase Storage in a
private bucket and are served through short-lived signed links, never public
URLs. An **Evidence Coverage** figure, the share of transaction value backed by
a document, appears on the entrepreneur's Transactions tab and again on the
funder's view of that business, so both sides see the same number.

Every upload is *pending review* until Proven staff check it: a business cannot
mark its own evidence verified, and neither can its funder. A document that is
turned down carries the reason, and only then does the entrepreneur get the
option to send a replacement. Rejected documents stop counting toward evidence
coverage, so the figure reflects what actually stands up.

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. You land on the guided walkthrough; **Open the
platform** takes you to the two entry points.

This needs a database. If you have not set one up yet, follow
[`supabase/SETUP.md`](supabase/SETUP.md) first, it takes about fifteen minutes
and everything is done in the browser.

**New to the system?** [`GUIDE.md`](GUIDE.md) walks through both sides in plain
language, what each tab does, how to log transactions and attach proof, and a
one-minute exercise showing an entrepreneur's update landing on the funder's
screen.

---

## The loop: Track → Detect → Guide → Prove

| Step | What it means |
|---|---|
| **Track** | Entrepreneur logs revenue, expenses and customers each period. Funder sees the same numbers, live. |
| **Detect** | A transparent, rules-based score flags whether the business is Healthy, on Watch, or At Risk, and why. |
| **Guide** | A guidance engine turns a bad number into a specific, practical recommendation, not just a red flag. |
| **Prove** | A verified track record accumulates into a Credit Readiness rating that can support a real funding decision. |

The impact pathway behind the loop: **Funding → Visibility → Early Detection
→ Guidance → Stronger Business Performance → Verified Track Record → Greater
Financial Readiness.** This is the seven-step journey shown on the
`/platform` screen.

---

## Running the app

`npm run dev`, then <http://localhost:3000>. Sign in and you land on whichever
side your account holds:

- **An entrepreneur** gets their workspace: Overview, Transactions, Stages,
  What to do next, Month by month, and Business profile.
- **A funder, incubator or accelerator** gets the portfolio: KPI cards, a
  sortable and filterable table worst-first, a Needs attention view, link
  requests to confirm, and a spreadsheet export for reporting upward.

Someone who is both sees a picker at `/dashboard` and can **Switch role** from
the sidebar at any time.

---

## Suggested demo flow (2 minutes)

A straight line from a healthy entrepreneur view through to a funder seeing the
same event land on their side.

1. **Open `/`** and click through the four beats of the story: one business
   failing while nobody watches.
2. **Open the platform**, then **Enter as Entrepreneur**. Sign in as Nandi
   Beauty Studio from the demo dropdown. A healthy business: 94.2.
3. **Point at the Overview**, health score, trend, stages, all one screen.
4. **Open Transactions** and show the evidence trail: which entries carry a
   document, and which are still waiting on review.
5. **Show why the score is what it is**, four weighted factors, stated
   openly, no black box.
6. **Open What to do next** and read a guidance card aloud: a specific next
   step, not just a red flag.
7. **Switch role** and enter as the funder, `funder@demo.proven.co.za`.
8. **Show the same three businesses**, worst first, with the same scores the
   entrepreneurs see.
9. **Open Zola Deliveries** to close on the at-risk case: a missed update, a
   delayed stage, and guidance naming its largest cost.
10. **Export the spreadsheet** to show the report a funder would otherwise
    rebuild by hand every quarter.

**Close on the demo message:** *"The same data that helps the entrepreneur
improve gives the funder evidence to make better decisions."*

---

## How the scoring works

Everything is a plain weighted average, shown on screen, no machine
learning, no hidden logic.

### Health score (0-100): "is this business healthy right now?"

| Factor | Weight | How it's measured |
|---|---|---|
| Revenue trend | 35% | Mean of last 3 periods vs. the 3 before |
| Expense-to-revenue ratio | 25% | Expenses ÷ revenue, last 3 periods |
| Reporting consistency | 20% | On-time = 1pt, late = 0.5, missed = 0, over the last 6 periods |
| Customer/sales growth | 20% | Same window and scale as revenue |

**Tiers:** 80-100 Healthy (green) · 50-79 Watch (yellow) · below 50 At Risk (red)

### Guidance engine

Every business gets at least one recommendation, generated directly from its
own numbers: a revenue drop triggers a segment-review prompt, expenses
outpacing revenue triggers a cost-review prompt, negative cash flow triggers
an expense-priority prompt, a delayed milestone triggers a blocker-review
prompt, and a business with no issues gets a message reinforcing that its
track record is building toward credit readiness.

### Credit readiness (4 bands): "has it proven itself over time?"

| Band | What it signals |
|---|---|
| Building Track Record | Early days, not enough periods yet, or score too volatile |
| Developing | Some evidence, not yet consistent |
| Strong Evidence | Sustained growth, controlled expenses, reliable reporting |
| Credit-Ready Candidate | The strongest, most consistent track record in the portfolio |

This band is **evidence to support a human credit decision, not an automatic
loan approval**, the app never claims otherwise anywhere in the interface.

---

## The ten demo businesses

Eight required industries plus two extra, spanning Healthy, Watch and At Risk:

Nandi Beauty Studio · Soweto Sunrise Bakery · Khaya Tutoring & Consulting ·
Mabaso Fashion Lab · Langa Urban Farm Co-op · BuildRight Construction
Services · Sifiso Errand App · Zola Deliveries · Mthunzi Mobile Repairs ·
Thabo Recycling Collective.

**Mthunzi Mobile Repairs** starts Healthy and is scripted to collapse the
first time you click **Quick demo: log a rough month** on its Transactions
tab, this is the "watch the score change live" moment for the demo.

---

## Editing the data

The three demo businesses live in
[migration 4](supabase/migrations/20260812100004_demo_data.sql).

Each business looks like this:

```js
{
  id: 'nandi-beauty', name: 'Nandi Beauty Studio', industry: 'Beauty & Wellness',
  owner: 'Nandi Mahlangu', region: 'Tembisa, GP', fundingAmount: 150000,
  milestones: milestoneSet(3, 'current'),
  model: { rev: 0.038, exp: 0.022, cust: 0.035, vol: 0.008, miss: 0.02 },
  base: { revenue: 240000, expenses: 138000, customers: 410 }
}
```

- **`model`** drives the six seed periods of simulated history: per-period
  growth rates for revenue, expenses and customers.
- **`base`** is the period-1 starting point.
- **`script`** (optional, see Mthunzi) forces a specific outcome the first
  time "Quick demo: log a rough month" is clicked for that business.

To change the scoring itself, search for `var WEIGHTS =` and
`var CREDIT_WEIGHTS =` near the top of the script block. To change the
guidance messages, search for `function getGuidance`.

Save the file and refresh the browser. No rebuild step.

---

## Troubleshooting

**Page is blank or unstyled.** Check the dev server is running and look for a
build error in the terminal.

**Buttons don't respond.** Open the browser console (F12) and look for a red
error. Confirm JavaScript isn't disabled, some locked-down work laptops
block it for `file://` pages. If so, serve the folder instead:

```bash
python -m http.server 8000   # or: npx serve .
```

Then open `http://localhost:8000`.

---

## The scoring engine (`packages/engine/`)

The scoring and guidance rules live in a standalone, typed package so every
part of the system shares one implementation.

```bash
cd packages/engine
npm install
npm test        # 37 tests: golden values, plus the database adapters
npm run build   # emits dist/ with type declarations
```

The tests are **golden-value** tests: every expected number and string in them
was produced by the engine code these rules came from, against the same three
fixture businesses. They exist to prove the scores stay identical to what has
already been demonstrated, so moving to
a database cannot silently move anyone's score. If a scoring rule is changed
on purpose, those values change with it, visibly, in the same commit.

| Module | Contains |
|---|---|
| `health.ts` | The four weighted factors, the 0-100 score, and the Healthy / Watch / At Risk tiers |
| `credit.ts` | Credit readiness, the four bands, and the funder-facing decision for a business |
| `guidance.ts` | The rules that turn a bad number into a specific next step, quoting the business's own figures |
| `types.ts` | The shapes a business, a period and a score take, mirroring the database tables |
| `db.ts` | The seam between Postgres rows and engine inputs: converts `numeric` columns, which arrive as strings, and sorts periods oldest-first |
| `fixtures.ts` | Three fixture businesses, one per tier, with fixed dates so expected values never drift |

The adapters in `db.ts` are tested as carefully as the scoring, because the two
things most likely to go wrong there fail *silently*: a `numeric` column
arriving as a string, and rows coming back newest-first from an `order by
period_month desc`. Neither throws. Left unhandled, the second makes a growing
business score as one in steep decline, so there is a test asserting a
descending query still scores 94.2 and lands in the green tier.

---

## Technical notes

- **Charts are hand-drawn inline SVG**, no charting dependency.
- **No AI API is used anywhere.** Scoring, tiers and recommendations are all
  rule-based and threshold-driven, deliberately, so every number on screen
  is explainable.
- **Everything persists in Postgres**, with row-level security deciding which
  rows each request may see, so a forgotten filter in application code becomes
  a missing row rather than a data leak
  between devices or users. **Reset the demo data** in the sidebar returns it
  to the seed state. Real accounts and a shared database arrive with the
  Supabase work below.
- **No dependency on a human mentor for the core workflow**, the score and
  the guidance are both deterministic.
- **All display text is HTML-escaped**, so pasted business names can't break
  the layout.
- **Still to build for production:** secure data integration with a real
  funder's transaction rails, consent and data governance, audit logging, and
  formal validation of the scoring methodology. Authentication and a shared
  database are now in progress rather than out of scope, see the roadmap
  below.

---

## From prototype to platform

The prototype proved the concept. The product it describes needs real accounts,
a shared database, and administration, and is being built in five stages, each
one useful on its own.

| Stage | What it delivers | Status |
|---|---|---|
| **1. Extract the engine** | Scoring and guidance as a shared, typed, tested package, proven to produce the prototype's exact numbers | **Done**, [`packages/engine/`](packages/engine/) |
| **2. Database and sign-in** | Postgres schema, row-level security, and real user accounts on Supabase | **Done**, [`supabase/`](supabase/) |
| **3. Port the two views** | The entrepreneur and funder dashboards reading live data instead of mock data | **Done**, [`app/`](app/) |
| **4. Organisation admin** | A funding organisation manages its own members and the businesses it funds | Planned |
| **5. Proven admin** | Our own view across every organisation: how many people and businesses are enrolled, funded and unfunded, and who is reporting | **Done**, [`/admin`](app/src/app/admin/page.tsx) |

**Any business can enrol, funded or not.** A business records whether it is
funded, and if it is, selects the funding organisation from those already on
the platform. An unfunded business uses the same tracking and guidance, and
builds the same credit-readiness record, which is what it can later take to a
funder.

**The funder confirms the link.** A business asks to be linked to an
organisation and that organisation confirms it, so no business can attach
itself to a funder that has never heard of it. Until the link is confirmed the
funder sees nothing, and once confirmed the access is read-only: a funder can
never edit an entrepreneur's figures, because evidence somebody else can edit
proves nothing.

---

### Deploying

`vercel.json` at the repository root builds and serves the **app**. It replaced
the static prototype, so the deployed URL now shows the real platform, and old
prototype links redirect rather than breaking:

| Old link | Goes to |
|---|---|
| `/index.html` | `/` |
| `/dashboard.html` | `/platform` |
| `/entrepreneur`, `/funder` | `/platform` |

Two things to set up on Vercel itself, neither of which belongs in this file:

1. **Environment variables**, under Settings → Environment Variables. The same
   three as [`app/.env.example`](app/.env.example). The build will succeed
   without them and then fail at runtime on every page, so set them first.
2. **Turn on email confirmation** in Supabase before anyone real signs up, and
   delete the demo accounts. Both are covered in
   [supabase/SETUP.md](supabase/SETUP.md).

The Content-Security-Policy allows exactly what the app needs and nothing more:
`'unsafe-inline'` for scripts and styles because Next inlines both, and
`*.supabase.co` for `connect-src` and `img-src`. It is deliberately written as
a wildcard rather than your project reference, so this file carries no
identifying detail. `'unsafe-eval'` is **not** granted, having checked the
production bundle does not need it.

---

## The database (`supabase/`)

Postgres on Supabase, with **[a step-by-step setup guide](supabase/SETUP.md)**
that runs entirely in the browser, no tools to install.

Four files in [`supabase/migrations/`](supabase/migrations/), run in order: the
tables, then access control, then sign-up handling and file storage, then the
optional demo data. The guide covers creating the project, running them,
checking they worked, and the keys the app needs.

Tenant isolation is enforced by **row-level security**, in the database itself
rather than in application code, so a forgotten filter in a query becomes a
missing row instead of one funder seeing another's portfolio. Two rules worth
knowing: a business cannot mark its own receipt verified, and scores are
read-only to everyone, written only by the shared engine.

---

## The web app (`app/`)

Next.js on the App Router, TypeScript throughout, reading and writing the live
database. This is the real product: accounts, a shared database, and both
dashboards driven by data people enter themselves.

### Running it

```bash
npm install                 # once, from the repository root
cp app/.env.example app/.env.local   # then fill in your Supabase keys
npm run dev                 # http://localhost:3000
```

`npm run verify` runs the engine tests and both typechecks. `npm run build`
builds the engine and then the app.

The database must exist first, see **[supabase/SETUP.md](supabase/SETUP.md)**.

### What is in it

| Route | For | What it does |
|---|---|---|
| `/` | Everyone | The home page: why Proven exists, told as four clickable beats of one business failing unseen |
| `/platform` | Everyone | The landing screen: the seven-step journey, and **Enter as Entrepreneur** / **Enter as Funder** |
| `/sign-in` | Everyone | Reached from either role button, and shows the demo accounts for that role with a **Use** button that fills the form in |
| `/sign-up` | Entrepreneurs | Create a real account, funded or not |
| `/businesses/new` | Entrepreneurs | Enrol a business, funded or not; if funded, name the organisation |
| `/business/[id]` | Entrepreneurs | Health score with all four factors shown, credit readiness, trend chart, monthly reporting form |
| `/business/[id]/transactions` | Entrepreneurs | Log what came in and went out |
| `/business/[id]/milestones` | Entrepreneurs | The four-stage journey, and funding link status |
| `/business/[id]/guidance` | Entrepreneurs | Every recommendation, worked out from that business's own figures |
| `/funder/[orgId]` | Funders | Portfolio table sorted worst-first, with tier counts |
| `/funder/[orgId]/requests` | Funders | Confirm or decline businesses asking to be linked |
| `/funder/[orgId]/business/[id]` | Funders | Full profile: score breakdown, credit readiness, stages, and the same guidance the entrepreneur sees |
| `/admin` | Proven staff | Enrolment across every organisation: people, businesses, funded vs not funded, and who is actually reporting |

### Demo accounts for presenting

Run file 4, then sign in with any of these. Password: `proven2026`.

| Account | Email | What it shows |
|---|---|---|
| Nandi Beauty Studio | `nandi-beauty@demo.proven.co.za` | Healthy, 94.2, Credit-Ready Candidate |
| Soweto Sunrise Bakery | `soweto-bakery@demo.proven.co.za` | On watch, 72.5, Strong Evidence |
| Zola Deliveries | `zola-deliveries@demo.proven.co.za` | At risk, 41.1, Building Track Record |
| The funder | `funder@demo.proven.co.za` | All three in one portfolio |

The sign-in page lists them with a **Use** button, so nothing has to be typed
in front of an audience. The figures are fixed to January-June 2025, and a test
reads the migration and checks all three scores, so what you rehearse is what
the judges see. Full details in [supabase/SETUP.md](supabase/SETUP.md).

Three things worth knowing about how it behaves:

- **A user who holds one role skips the picker.** Someone with only a business
  lands on it directly; only a user who is both an entrepreneur and a funder
  sees a choice, and that is the screen **Switch role** returns them to.
- **A business with no figures yet gets a setup screen**, not a dashboard of
  zeroes that would read as failure.
- **Not being allowed to see a business and it not existing look identical.**
  A different message for "exists, but not yours" would confirm which
  businesses are real.

## Scope

This is a prototype built to demonstrate a concept for the EDHE
Studentpreneurs Indaba FinTech Hackathon, empowered by Absa. The data is
fictional, the businesses are invented, and there are no real integrations.
Proven can use Absa's Youth Entrepreneurship Fund (AYEF) as its initial pilot
use case without being dependent on it, the product is institution-agnostic
by design. Proven is its own product name and uses its own branding
throughout; trademark and domain availability should be checked before any
commercial use.
