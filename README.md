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

Two files, two audiences:

| File | For | What it is |
|---|---|---|
| **`index.html`** | Judges, mentors, anyone seeing this for the first time | A short guided walkthrough of the four-step loop, Track, Detect, Guide, Prove, with one example business. Open this first. |
| **`dashboard.html`** | Someone who wants to see the full system | The full two-sided prototype: an Entrepreneur workspace and a Funder portfolio view, switchable from one landing screen. Proves the depth behind the pitch. |

Both link to each other. Everything runs from static files with mock data,
no server to start, no API keys, no internet connection required.

**Proof of transaction.** On the Entrepreneur side, Transactions lets you
attach a receipt or invoice to any entry. Files are stored for real in the
browser's IndexedDB, so an upload survives a refresh and a browser restart,
and can be reopened or downloaded. An **Evidence Coverage** figure, the share
of transaction value backed by a document, appears on the entrepreneur's
Transactions tab and again on the funder's view of that business, so both
sides see the same number. Documents stay on the device and are labelled
*pending review*: Proven records that evidence exists, it does not certify it.
A production deployment would post the same uploads to object storage.

---

## Quick start (30 seconds)

**Double-click `index.html`.**

That's it. It opens in your default browser on the guided walkthrough. Click
through to `dashboard.html` at any time to see the full system.

If double-clicking opens a code editor instead of a browser, right-click
`index.html`, choose **Open with**, then pick Chrome, Edge, or Firefox.

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
`dashboard.html` landing screen.

---

## Running `dashboard.html`

Open the file. You land on a screen with the seven-step journey and two
entry points:

- **Enter as Entrepreneur**, pick a business from the sidebar dropdown and
  see Overview, Transactions, Milestones, Recommendations and History for
  that business.
- **Enter as Funder**, see the full ten-business portfolio: KPI cards,
  a health-tier donut, a sortable/filterable table, and a full Business
  Profile (score breakdown, funding info, milestones, recommendations,
  credit readiness) for any business.

Use **Switch role** in the sidebar to jump between the two views at any time
this is the fastest way to show a judge both sides of the platform.

---

## Suggested demo flow (2 minutes)

This follows the ten-step demonstration script the product proposal lays
out, a straight line from a healthy entrepreneur view through to a funder
seeing the same event land on their side.

1. **Log in as the entrepreneur** (landing screen → Enter as Entrepreneur,
   Mthunzi Mobile Repairs). Show the healthy dashboard.
2. **Point at the Overview tab**, Business Health Score, revenue/expense
   trend, milestones, all in one screen.
3. **Open Transactions and click "Quick demo: log a rough month."** This
   changes the data, revenue falls, expenses rise.
4. **Watch the score change** on screen, live, in front of the judges.
5. **Show exactly why it changed**, open the Business Profile-style factor
   breakdown (or the math box on `index.html`): four weighted factors, no
   black box.
6. **Show the recommended action**, click into Recommendations and read the
   guidance card out loud: a specific next step, not just a red flag.
7. **Switch to the funder dashboard** (sidebar → Switch role → Enter as
   Funder).
8. **Show the same business has moved into Watch or At Risk** on the
   portfolio table, same score, same reasoning, now visible to the funder.
9. **Open the detailed business profile** from the table and show the full
   evidence trail: score factors, history chart, milestones, recommendations.
10. **Open a strong-performing business** (e.g. Nandi Beauty Studio) and show
    its track record and Credit Readiness status.

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

Everything lives in one array near the top of the script block in
`dashboard.html`, search for `var DEFS = [`.

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

**Page is blank or unstyled.** The file was likely saved incorrectly or
truncated, re-copy `index.html` and `dashboard.html` together.

**Buttons don't respond.** Open the browser console (F12) and look for a red
error. Confirm JavaScript isn't disabled, some locked-down work laptops
block it for `file://` pages. If so, serve the folder instead:

```bash
python -m http.server 8000   # or: npx serve .
```

Then open `http://localhost:8000`.

---

## Technical notes

- **Two static files**, plain HTML/CSS/JavaScript, no build step, no
  dependencies. Charts are hand-drawn inline SVG.
- **No AI API is used anywhere.** Scoring, tiers and recommendations are all
  rule-based and threshold-driven, deliberately, so every number on screen
  is explainable.
- **No persistence.** Refreshing resets to the seed state by design, so a
  demo always opens the same way. Transactions and submitted updates made
  during a session live only in memory.
- **No dependency on a human mentor for the core workflow**, the score and
  the guidance are both deterministic.
- **All display text is HTML-escaped**, so pasted business names can't break
  the layout.
- **Production considerations not built into this prototype:** secure data
  integration with a real funder's transaction rails, consent and data
  governance, authentication, audit logging, and formal validation of the
  scoring methodology. These are explicitly out of scope for a hackathon
  build and called out as next steps, not gaps we're hiding.

## Scope

This is a prototype built to demonstrate a concept for the EDHE
Studentpreneurs Indaba FinTech Hackathon, empowered by Absa. The data is
fictional, the businesses are invented, and there are no real integrations.
Proven can use Absa's Youth Entrepreneurship Fund (AYEF) as its initial pilot
use case without being dependent on it, the product is institution-agnostic
by design. Proven is its own product name and uses its own branding
throughout; trademark and domain availability should be checked before any
commercial use.
