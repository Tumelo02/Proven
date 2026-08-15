# Running Proven: what the business actually does

A plain-language guide to what Proven provides, who does what, and how the work
gets done day to day. Written so it can be read before a meeting and used to
answer questions without hedging.

If you only remember one thing: **Proven is not software that people log into
and figure out.** It is a service. The software is the part that scales; the
service is the part that makes it work.

---

## 1. What Proven is, in one paragraph

When a funder gives money to a small business, they usually find out how things
are going at the next check-in, often months later. By then a small problem has
become a big one. Proven closes that gap. The business logs its numbers each
month, Proven turns those numbers into a health score with a reason, and both
the business owner and the funder see the same score, the same explanation, and
the same suggested next step, at the same time.

**Funding creates potential. Performance creates evidence. Proven turns that
evidence into proof.**

---

## 2. What we provide to each side

### To the entrepreneur

| What they get | Why it matters to them |
|---|---|
| A monthly check-in that takes two minutes | Not paperwork. Four numbers and a sentence. |
| A health score with the reasoning shown | They can see *why*, not just a number they distrust. |
| Specific guidance, not a red flag | "Your biggest cost was petrol at R10,840. That is the first one to bring down." |
| A record of evidence | Receipts attached to entries, checked by Proven. |
| A credit readiness rating that builds over time | The thing they can take to a bank later. |
| Control of who sees it | A funder sees nothing until the business asks and the funder confirms. |

**The honest pitch to an entrepreneur:** *"You already know your business is
working. This is how you prove it to someone who has never met you."*

### To the funder, incubator or accelerator

| What they get | Why it matters to them |
|---|---|
| One portfolio view, ordered by health score | The business needing support is read first. |
| The same score the entrepreneur sees | No two versions of the truth to reconcile. |
| Early warning, not a post-mortem | A problem surfaces in month three, not month nine. |
| An evidence trail | Receipts behind the figures, checked by Proven rather than self-certified. |
| Reporting they can send upward | Excel and PDF exports of the whole portfolio, on their own letterhead. |
| A record of their own follow-ups | What they did about a flagged business, private to them. |
| Jobs supported, tracked over time | The number their own funder asks for. |

**The honest pitch to a funder:** *"You are already collecting this. We are
making it take an afternoon instead of a fortnight, and making it verifiable."*

---

## 3. Onboarding: how a business actually joins

This is the part most likely to be underestimated. **Township entrepreneurs
will not self-serve onto a web application.** Plan for human contact.

### Step 1 — The funder comes first

Proven does not recruit entrepreneurs directly. We sign a funder, incubator or
accelerator, and their businesses come with them. One conversation gets twenty
businesses instead of twenty conversations getting twenty businesses.

**What we need from them:**
- Their organisation set up on the platform (name, logo, type, contact)
- A named person who confirms funding links
- Their list of funded businesses

### Step 2 — The enrolment session

Sit with the entrepreneur. Do not email them a link and hope.

1. Create their account with them, on their phone if that is what they have.
2. Add the business: name, what it does, where it trades.
3. Pick their funder from the list. This sends a link request.
4. **Enter their last three months of figures together.** This matters more
   than anything else: a business with no history has no score, and a score of
   nothing is not motivating.
5. Show them their first score and read the guidance aloud.
6. Explain the monthly rhythm: figures are due on the 15th.

**Budget 45 minutes per business.** It gets faster with practice, never fast.

### Step 3 — The funder confirms

The funder opens Requests and confirms the link. Until they do, they see
nothing. This is the consent gate and it is not optional.

### Step 4 — The first month alone

Call them before the 15th of the first month. Not after. A business that misses
its first check-in usually never starts.

---

## 4. Using the system, month by month

### What the entrepreneur does

Once a month, four numbers and a sentence:
- Money in
- Money out
- Customers
- What happened

Plus, whenever they have one, attach a receipt to a transaction.

### What the funder does

- Opens the portfolio, reads it worst score first
- Looks at anything flagged
- Records what they did about it
- Once a quarter, exports the report for their board

### What Proven does

- **Checks evidence.** Documents are marked *pending review* until Proven staff
  open them and confirm they match the entry. Neither the business nor the
  funder can mark their own evidence verified. This is what makes the record
  credible to a third party.
- **Chases late updates.** A business that has not reported is the single most
  important thing on the admin panel.
- **Watches for enrolled-but-silent businesses.** Enrolment is not the same as
  being helped, and that gap is the number worth watching.

---

## 5. Your duties, plainly

Things that will not happen unless a person does them.

### Weekly
- Clear the evidence review queue (`/admin/review`)
- Check for businesses that enrolled and never reported
- Follow up on funding links a funder has not confirmed

### Monthly
- Chase businesses that missed the 15th, by phone, not email
- Check every funder has logged in at least once
- Read the guidance the system generated and sanity-check that it makes sense

### Quarterly
- Send each funder their portfolio report, or check they have downloaded it
- Review whether the scoring rules still reflect reality
- Ask two entrepreneurs what is annoying them

### Once
- Register an Information Officer with the Information Regulator (POPIA)
- Get the terms and privacy notice reviewed by an attorney
- Remove the demo accounts before real users sign up

---

## 6. Security and privacy, in plain terms

You will be asked this by a bank. Know it cold.

### How access actually works

Access is enforced by **the database itself**, not by the app. That means a
mistake in application code produces a missing row rather than a data leak.
There are over 60 such rules, one per table per operation.

Three rules, in order:

1. **An entrepreneur owns their business.** They read and write their own
   figures, transactions, receipts and stages. Nobody else's.
2. **A funder reads a business only through a confirmed link.** The business
   asks, the organisation confirms. Until then the funder sees nothing. The
   access is **read-only**: a funder can never edit an entrepreneur's numbers,
   because evidence someone else can edit proves nothing.
3. **Proven staff read everything and write almost nothing.** The one thing
   staff can do is mark evidence checked, and every such decision is recorded.

### The specific questions you will be asked

**"Can a business fake its numbers?"**
Yes, in the short term, and we say so. That is exactly why evidence coverage
exists: a figure with a receipt behind it is worth more than one without, and
the coverage percentage is visible to both sides. A business that inflates its
sales and cannot show a till slip has a visibly thin record.

**"Can a funder see a business that has not agreed?"**
No. Enforced in the database, not just the interface.

**"Can one funder see another funder's businesses?"**
No. Same mechanism.

**"What about POPIA?"**
Consent is recorded at signup against a versioned privacy notice, in an
append-only table: withdrawal adds a row, it never edits one. Retention is
stated at seven years after last reported figures, matching what SARS and the
Companies Act already require. Any person can download everything held about
them, and ask for it to be erased.

**"Where are the receipts stored?"**
A private bucket, served through short-lived signed links, never public URLs.

**"What happens if a staff member leaves?"**
Their account is removed, but the record of what they verified or confirmed
survives: those rows carry no foreign key to the account, deliberately.

### What we do not do

- We do **not** sell data.
- We do **not** make credit decisions. A score is evidence, not an approval.
- We do **not** let a funder edit a business's figures.
- We do **not** show a funder's private follow-up notes to the entrepreneur.

---

## 7. The line to hold with funders

They will eventually ask for things that would break the product. Know which to
refuse.

**Yes to:** surfacing, organising, reminding, summarising, recording what they
decided, exporting for their board, their own branding on reports.

**No to:** scoring beyond the evidence, recommending "cut funding",
ranking entrepreneurs publicly against each other, automating a decision, or
showing them figures a business has not consented to share.

The reasoning: the moment Proven appears to make the call, the funder is
accountable for our judgement, and they will stop trusting it. We provide
evidence. They decide.

---

## 8. What could go wrong, and what to say

| Risk | Honest answer |
|---|---|
| Entrepreneurs stop reporting | The real risk. Mitigated by phone follow-up, not by software. Reporting consistency is 20% of the score, so it is visible. |
| A funder wants automated decisions | Refuse, and explain why. It transfers their accountability to us. |
| Someone games their figures | Evidence coverage makes a thin record visible. We do not claim to prevent it. |
| A funder asks not to appear in the signup list | Reasonable. Build the join-code path when a real funder asks. |
| We lose a pilot partner | The product is not built around one funder. The same platform serves incubators and accelerators without changes. |

---

## 9. What is built, and what is not

**Built and working:** both dashboards, the scoring and guidance engine,
evidence upload and review, business and organisation profiles, funder
reporting exports, POPIA consent and data export, the admin panel.

**Not built yet:** WhatsApp intake. The product story describes entrepreneurs
submitting by WhatsApp with no app download; today they use a web form. This is
the most important remaining piece and it needs Meta business verification,
which takes days to weeks. Start it before it is urgent.

**Deliberately not built:** anything that makes a funding decision
automatically.
