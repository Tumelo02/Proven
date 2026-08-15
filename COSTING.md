# What Proven costs to run

A working budget for a pilot, kept in the repository so the numbers behind any
funding ask are written down rather than remembered.

All figures in South African Rand, at August 2026 prices. Foreign services are
billed in US dollars; converted here at roughly R19 to the dollar, so revisit
if the rand moves sharply.

---

## The short version

| | 6 months | 12 months |
|---|---|---|
| **Infrastructure** | ~R9,300 | ~R18,600 |
| **Compliance and setup** (one-off) | ~R13,000 | ~R13,000 |
| **Minimum viable pilot**, one person part-time | ~R120,000 | ~R220,000 |
| **Comfortable**, two people and a field budget | ~R250,000 | ~R470,000 |

**The line worth remembering:** infrastructure is under R10,000 for a six-month
pilot. Everything else is people. That is a real finding about this product,
not a rounding error, and it is worth saying plainly to a panel: most teams
overstate technical cost and understate the human cost of reaching township
entrepreneurs.

---

## 1. Infrastructure

What it actually costs to keep the system running.

| Service | What it does | Monthly | 6 months |
|---|---|---|---|
| Supabase Pro | Database, auth, file storage for receipts | ~R500 | R3,000 |
| Vercel Pro | Hosting and serverless functions | ~R400 | R2,400 |
| Domain and email | `provenfinance.co.za` and a working inbox | ~R150 | R900 |
| WhatsApp Business API | Monthly check-ins, once built | ~R500 | R3,000 |
| **Total** | | **~R1,550** | **~R9,300** |

**On the free tiers.** Both Supabase and Vercel have free plans that would
technically carry a pilot this size. Budget for Pro anyway: a free Supabase
project **pauses after a week of inactivity**, and a business that cannot
submit its month because the database is asleep is a business that stops
trusting the platform. R500 a month is cheap insurance against that.

**On WhatsApp.** Meta charges per conversation, not per message, and since
November 2024 **user-initiated conversations are free**. Proven's traffic is
almost entirely inbound: entrepreneurs replying to a reminder. The cost is the
reminder itself, a business-initiated utility conversation at roughly R0.50
each in South Africa. A hundred businesses, one reminder a month, is about R50.
The R500 line above is generous headroom, not a forecast.

**What does not scale with users.** Nothing in this table moves much between
10 businesses and 500. Storage is the only one that grows, and receipts are
capped at 10 MB each: a thousand businesses reporting monthly with photos is
still inside a Pro plan's allowance.

---

## 2. Compliance and setup

One-off, and mostly unavoidable before real users.

| Item | Cost | Notes |
|---|---|---|
| Information Officer registration | Free | POPIA requires it. Paperwork with the Information Regulator, no fee. |
| Legal review of terms and privacy notice | R8,000 – R15,000 | See below. |
| Company registration | ~R500 | If not already done. |
| **Total** | **~R9,000 – R16,000** | |

**The legal review is the one I would not skip.** A bank's compliance team will
ask who reviewed your privacy notice. "Nobody" ends that conversation. The
notice and terms already in the app are written to be readable and to cover the
POPIA obligations honestly, but they have not been reviewed by an admitted
attorney, and that is a different thing.

---

## 3. People

This is where the money actually goes, and the part most likely to be
underestimated.

| | Monthly | 6 months |
|---|---|---|
| One person, part-time | ~R15,000 | R90,000 |
| Two people | ~R30,000 | R180,000 |
| Field budget: travel, data, onboarding visits | ~R5,000 | R30,000 |

**Why a field budget is not optional.** Township entrepreneurs will not
self-serve onto a web application. Someone has to sit with them, help them
enrol, and show them the first month. That cost scales with the number of
businesses in a way the servers never will, and it is the honest answer to
"what would you do with more money": field agents, not infrastructure.

---

## 4. The two asks

### Minimum viable pilot, ~R120,000 for six months

- Infrastructure: R9,300
- Compliance and setup: R13,000
- One person, part-time: R90,000
- Small travel budget: R8,000

Enough to run a real pilot with one funder or incubator and perhaps 20 to 40
businesses, with one person doing the work.

### Comfortable, ~R250,000 for six months

- Infrastructure: R9,300
- Compliance and setup: R13,000
- Two people: R180,000
- Field budget: R30,000
- Contingency: R18,000

Enough to onboard businesses in person across more than one area, and to keep
building while the pilot runs rather than pausing development to support it.

---

## 5. What changes these numbers

Worth stating, because a budget defended without knowing its own assumptions is
a budget that falls apart under questioning.

- **Paying entrepreneurs for data, or subsidising devices or airtime.** Nothing
  above assumes this. If the model requires it, it becomes the largest line by
  far and scales directly with the number of businesses.
- **A funder demanding on-premise hosting or a specific region.** Some banks
  will. That replaces the R900/month infrastructure line with something an
  order of magnitude larger.
- **Scale past a few hundred businesses.** Supabase Pro covers a lot, but a
  serious rollout eventually needs a paid tier above it, and the WhatsApp
  reminder cost starts to be visible rather than a rounding error.
- **A second developer.** The single largest lever on both cost and speed.

---

## 6. What is already paid for

Worth noting when presenting: the platform itself is **built**. The scoring
engine, both dashboards, the evidence trail, POPIA consent and retention, the
funder reporting exports and the organisation and business profiles all exist
and are tested. The budget above is to **run and grow** it, not to build it.
