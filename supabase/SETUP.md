# Setting up the Proven database

A step-by-step guide to creating the Proven database on
[supabase.com](https://supabase.com). Everything is done in the browser, no
tools to install, no Docker, no command line.


**Time needed:** about 15 minutes.

At the end you will have a live Postgres database with sign-in, file storage
for receipts, and security rules that stop one funder from ever seeing another
funder's businesses.

---

## Before you start

The files you will paste are in [`migrations/`](migrations/). Run them in
**numeric order**, which is the order they are listed here:

| # | File | What it creates |
|---|---|---|
| 1 | `20260812100001_schema.sql` | The tables: businesses, monthly figures, transactions, documents, milestones, scores |
| 2 | `20260812100002_security.sql` | Table privileges and the row-level rules that decide who reads and writes what |
| 3 | `20260812100003_triggers_and_storage.sql` | Sign-up handling, business defaults, and the receipts file store |
| 4 | `20260812100004_demo_data.sql` | **Optional.** The three demo businesses and their sign-in accounts, for presenting |
| 5 | `20260815100005_popia.sql` | Consent records, the retention period, and the data export a person can ask for |
| 6 | `20260815100006_business_profile.sql` | The business profile: identity, logo storage, the team, and headcount by month |
| 7 | `20260815100007_owners.sql` | More than one owner per business, with optional shares |
| 8 | `20260815100008_follow_ups.sql` | A funder's own record of acting on a flagged business |
| 9 | `20260815100009_org_profile.sql` | The organisation profile: logo, type, contact details |
| 10 | `20260815100010_audit_trail.sql` | Who did what, when, and from where |
| 11 | `20260815100011_org_account_status.sql` | Whether an organisation is on a pilot or paying |

**Order matters.** Each builds on the one before, so file 2 fails if file 1 has
not run.

> **These files do nothing until you paste them into Supabase.** Having them in
> the repository is not enough, and nothing runs them for you. Until they do
> run, the `public` schema stays empty and the app cannot work: signing up
> appears to succeed, because Supabase creates the account itself, but signing
> in then fails. Step 3 checks for exactly this.

---

## Step 1, create the project

1. Go to [supabase.com](https://supabase.com) and sign in, or create a free
   account.
2. Click **New project**.
3. Fill in:
   - **Name:** `proven`
   - **Database Password:** click **Generate a password**, then copy it
     somewhere safe. You will not be shown it again.
   - **Region:** choose the one closest to your users. For South Africa, pick
     the nearest available, usually **EU (Frankfurt)** or **AWS Cape Town** if
     it is offered on your plan.
4. Click **Create new project** and wait about two minutes while it starts.

> **About that password.** It is for direct database access, which you will
> not need for normal work. Keep it, but do not put it in the project, in
> GitHub, or in a message.

---

## Step 2, run the migration files

For **each** file, in numeric order:

1. In the left sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open the migration file from this repository, select all of it, and copy it.
4. Paste it into the editor.
5. Click **Run**, or press `Ctrl+Enter`.
6. You should see **Success. No rows returned.** That is the expected result:
   these files create tables, they do not fetch anything.

Repeat for files 2 and 3. File 4, the demo data, is optional and covered
further down.

### If you see an error

| Message | What it means | What to do |
|---|---|---|
| `type "report_status" already exists` | File 1 was run twice | Skip to the next file, it already worked |
| `relation "businesses" does not exist` | Files were run out of order | Run file 1 first, then this one again |
| `permission denied for table …` | File 2 has not run | Run file 2: it grants the table privileges the rules sit on top of |
| `permission denied for schema auth` | Rare, a project still starting up | Wait a minute and run it again |

To start completely fresh: **Settings → General → Delete project**, then begin
again at step 1. Nothing is lost this early.

---

## Step 3, check it worked

In the SQL Editor, run this:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

You should get **14 rows**: `audit_log`, `businesses`, `consents`, `documents`,
`funding_links`, `memberships`, `milestones`, `organisations`, `profiles`,
`reporting_periods`, `score_snapshots`, `staff_counts`, `team_members`,
`transactions`.

(`consents` comes from file 5, `team_members` and `staff_counts` from file 6.
If you have run only files 1 to 3, expect 11.)

Now confirm the security rules are switched on, this one matters most:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

**Every row must show `rowsecurity = true`.** If any table shows `false`, that
table is readable by anyone with an API key. Re-run file 2 and check again.

Finally, confirm the receipts bucket exists:

```sql
select id, public from storage.buckets where id in ('proofs', 'logos');
```

`proofs` after file 3, and `logos` as well once file 6 has run. Both must show
`public = false`: receipts are private business records, served through
short-lived signed links, never public URLs. The logo bucket is private for a
different reason, a public bucket makes every object in it enumerable, which
would expose a guessable path for every business on the platform.

And confirm the sign-up trigger exists, the one that gives every new account a
profile:

```sql
select tgname from pg_trigger where tgname = 'on_auth_user_created';
```

One row. If it returns nothing, file 3 has not run, and accounts created before
you fix that will be able to sign up but not sign in.

---

## Step 4, turn on email sign-in

1. Go to **Authentication → Sign In / Providers**.
2. **Email** is on by default. Leave it on.
3. While building, turn **Confirm email** *off*, under **Authentication →
   Sign In / Providers → Email**. You can then create test accounts without
   collecting real inboxes.

> **Turn Confirm email back on before any real user signs up.** Without it,
> anyone can register using someone else's email address.

---

## Step 5, copy the three keys

Go to **Settings → API keys** and copy these:

| Key | Where it goes | Safe in the browser? |
|---|---|---|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| **anon / publishable key** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes, the security rules constrain it |
| **service_role / secret key** | `SUPABASE_SERVICE_ROLE_KEY` | **No, server only** |

Copy the template, then put the real values in the **copy**:

```bash
cp app/.env.example app/.env.local
```

Now open **`app/.env.local`** and replace the three placeholder values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Two things that are easy to get wrong here, and neither one announces itself:

- **The file must be `app/.env.local`, not `.env.local` at the repository
  root.** Next reads env files from the folder it runs in. A file at the root
  is silently ignored, and every page fails with *"Your project's URL and Key
  are required to create a Supabase client"*.
- **Put the keys in `.env.local`, never in `.env.example`.** The example file
  is a committed template; the `.local` one is gitignored, and that is the
  only thing keeping your keys out of the repository.

`.env.local` is already covered by [`.gitignore`](../.gitignore). Check with
`git status` that it does not appear before you commit.

**Restart the dev server after editing it.** Next reads env files only at
startup, so changes to a running server have no effect.

> **The service_role key bypasses every security rule in file 2.** It must
> never appear in browser code, in this repository, or in a `NEXT_PUBLIC_`
> variable. It belongs only in server code and in Vercel's environment
> settings. If it ever leaks, rotate it immediately under **Settings → API
> keys**.

---

## Step 6, create your first organisation and admin

Create a funding organisation so businesses have something to link to:

```sql
insert into organisations (name, slug)
values ('Absa Youth Entrepreneurship Fund', 'ayef');
```

Then sign up for an account through the app, or under **Authentication →
Users → Add user**, and make yourself Proven staff:

```sql
update profiles
set is_platform_admin = true
where email = 'your-email@example.com';
```

This is the one thing that cannot be done through the app, deliberately.
`is_platform_admin` grants visibility across every organisation, so it is set
here by hand and nowhere else. There is no form anywhere in Proven that can
grant it, which means it cannot be obtained by anyone who has not been given
your database password.

**Then sign out and back in**, and you will land on the Proven admin panel at
**`/admin`**. See [Your admin panel](#your-admin-panel) below for what it shows.

To make someone an admin of a specific organisation instead:

```sql
insert into memberships (user_id, org_id, role)
select p.id, o.id, 'admin'
from profiles p, organisations o
where p.email = 'funder@example.com' and o.slug = 'ayef';
```

---

## How the security rules work

Worth understanding, because it is what makes this safe to sell as a licensed
product.

Every table has **row-level security** switched on, which means Postgres itself
decides which rows a request may see. A forgotten filter in application code
becomes a missing row rather than a data leak.

Three rules, in order:

1. **An entrepreneur owns their business.** They can read and write their own
   figures, transactions, receipts and milestones. Nobody else's.
2. **A funder reads a business only through a confirmed link.** A business
   asks to be linked to an organisation, and *the organisation confirms it*.
   Until then the funder sees nothing. The access is **read-only**: a funder
   can never edit an entrepreneur's numbers, because evidence someone else
   can edit proves nothing.
3. **Proven staff can read everything, and write nothing** through these
   rules. Administrative writes go through server code that records who did
   what in `audit_log`.

Two smaller rules worth knowing:

- **A business cannot mark its own receipt "verified".** No policy grants
  update on `documents`, so review status is set by a reviewer through server
  code. Proven records that evidence exists; it does not certify it.
- **Scores are never written by hand.** `score_snapshots` is read-only to
  everyone. Scores come from the shared engine in
  [`packages/engine/`](../packages/engine/), so the number an entrepreneur
  sees and the number their funder sees cannot drift apart.

### Try it yourself

Sign up two accounts, create a business on each, and confirm that neither can
see the other's figures. That single test exercises the whole model.

---

## POPIA, what file 5 adds

The Protection of Personal Information Act governs what Proven may hold about a
South African entrepreneur. Three things are given structure, because a policy
document the database cannot enforce is a promise rather than a control.

**Consent is recorded, and cannot be rewritten.** Every agreement goes into
`consents` with the wording version it was given against. Withdrawing inserts a
new row saying so; it never edits the row that granted it. Like `audit_log`,
the table has no UPDATE and no DELETE policy, so nobody can alter the trail,
including Proven staff. Consent rows deliberately survive account deletion, or
deleting an account would destroy the evidence that its data was collected
lawfully.

The wording lives in `app/src/lib/policy.ts` as `POLICY_VERSION`. **Bump it
whenever the terms or privacy notice change materially**, and existing rows keep
pointing at what people actually agreed to.

**Retention is stated rather than infinite.** `businesses.retention_until` is
set by `close_business()` to seven years after the last reported figures,
matching the retention SARS and the Companies Act already require of the
underlying records. A shorter period would leave the entrepreneur unable to meet
their own obligations.

**A person can take their data and leave.** `export_my_data()` returns
everything held about the caller as one JSON document, reached from
**Your data and privacy** in the app. It takes no arguments on purpose: it reads
`auth.uid()` itself, so there is no id in the request that could be pointed at
somebody else.

Check consent is being captured:

```sql
select kind, granted, policy_version, count(*)
from consents
group by 1, 2, 3
order by 1;
```

Every account created through the app should have a `terms` and a `privacy`
row. An account with neither signed up before file 5 was run, or hit the
fallback in `signUp` that lets an account be created even when the consent
write fails, on the reasoning that an unusable orphaned account is worse than a
recoverable gap. Ask those users to accept again rather than backfilling rows
they never actually saw.

---

## The business profile, what file 6 adds

A business used to be six fields captured at enrolment and never revisited.
File 6 makes it a profile, at **Business profile** in the entrepreneur's
sidebar, and shows it to the funder at the top of that business's record.

**Identity.** Logo, tagline, description, owner and contact details, full
address, registration numbers, B-BBEE level, website and social handle.

**The team, as rows.** `team_members` replaces the free-text `team_roles` for
anything that has to be counted. Someone leaving is recorded with a date rather
than deleted, so headcount stays answerable for past months.

**Headcount by month.** `staff_counts` records full time, part time and casual
per month, aligned to `reporting_periods.period_month`. This is what turns
"jobs supported" from one number captured at signup into job creation over
time, which is the figure a development funder reports upward.

**Everything is optional.** A business must still be able to enrol and report
its first month in under two minutes. `profile_completeness()` drives a nudge,
not a gate, and it deliberately weights registration details lightly: most
businesses in this market are informal, and a score that punishes an informal
trader for being informal is measuring the wrong thing.

**More than one owner** (file 7). Plenty of businesses are owned by two or
three people on a split. Owners are `team_members` with `is_owner` set, rather
than a second table that could disagree with the team list about who is there.
`ownership_pct` is optional: many partnerships have never written the split
down, and requiring a number would invent one.

The `businesses.owner_*` columns stay, and become the **primary contact**,
which is still a useful and different fact. File 7 also carries any existing
single owner across into the team, so nothing already captured is lost.

Check the new pieces:

```sql
select
  (select count(*) from team_members)  as team_rows,
  (select count(*) from team_members where is_owner) as owner_rows,
  (select count(*) from staff_counts)  as staff_rows,
  (select count(*) from storage.buckets where id = 'logos') as logo_bucket;
```

---

## Follow-ups, what file 8 adds

A funder could see everything and record nothing. When they called an
entrepreneur about a bad month, that fact lived in their inbox, so the next
person to open the record could not tell whether it had been dealt with.

**Mark as followed up** on a business record writes a `follow_ups` row: who,
when, an optional note, and the score at the time so a later reader sees what
was being reacted to rather than what is true today.

It hangs off the organisation, not the business, and that is the important
part. **The entrepreneur never sees it, and neither does another funder of the
same business.** An entrepreneur reading "called her, seems evasive" would
poison the candour that makes the note worth keeping. What a funder tells an
entrepreneur is a conversation; this is the funder's own working record.

There is no UPDATE policy, deliberately: a note can be added or deleted by its
author, never quietly rewritten.

---

## The organisation profile, what file 9 adds

An organisation was two fields. File 9 gives it a logo, a type, a one-line
description, a website and a province, at **Organisation profile** in the
funder sidebar. The logo appears in their own sidebar and on exported reports,
so a report going to their board carries their mark rather than only Proven's.

**The type matters more than it looks.** Funder, incubator, accelerator or
government. It drives vocabulary, not permissions: every type has the same
powers. It is what lets one product serve all three without three codebases.

**Contact details are held separately**, in `org_contacts`. `organisations` is
readable by every signed-in user, because a business has to find its funder
before any link exists, and a named person's direct line is not public
information. The contact is visible to that organisation's own members and to
businesses it has a **confirmed** link to, and nobody else.

**Only an org admin can edit any of it.** A member reading the portfolio should
not be able to change the logo their entrepreneurs see.

One thing file 9 also fixes: the existing business-logo storage policies cast
the first path segment straight to `uuid`. Organisation logos live under
`org/<id>/`, and `'org'::uuid` does not return false, it **raises**, which
would fail the whole query. The policies are recreated with a prefix test that
short-circuits before any cast.

Check it:

```sql
select name, org_type, logo_path is not null as has_logo from organisations;
```

---

## The audit trail, what file 10 adds

`audit_log` existed from the start but only two actions wrote to it and nothing
displayed it. A trail nobody can read is not a trail.

File 10 adds the columns needed to answer **who, from where, and what changed**:
the actor's email copied at the time so the row still names someone after the
account is deleted, the IP address and browser, and a severity so the view can
surface what matters without reading every row.

**What gets recorded, and nothing more:**

| Event | Severity |
|---|---|
| Sign-in succeeded | info |
| **Sign-in failed** | alert |
| Document verified or turned down | notice |
| Funding link confirmed or declined | notice |
| Organisation created or changed | notice |
| Portfolio exported | notice |
| Personal data exported (POPIA) | notice |

The rule is anything that touches another party's data or changes who can see
what. Ordinary reads of your own records are not logged: a trail that records
everything is one nobody reads.

**Failed sign-ins are the one written with the service-role key**, because a
failed attempt has no session to write as. Five against one address in a
minute is an attack, and it is invisible unless the failures are recorded. The
address is stored as typed, which may name no account at all: someone guessing
addresses looks different from someone with one wrong password.

**Who can read it.** Proven staff see everything, at **`/admin/audit`**. An
organisation's *admins* see their own organisation's events, so a funder can
tell whether one of their own staff exported a portfolio without asking us. A
member cannot: reading the trail is itself a privilege. Entrepreneurs see
nothing here; their own consent history is on their privacy page.

**It still cannot be edited.** There is no UPDATE and no DELETE policy on
`audit_log`, deliberately. An actor who can rewrite their own trail has no
trail, and that applies to Proven staff too.

Check it:

```sql
select action, severity, count(*)
from audit_log group by 1, 2 order by 3 desc;
```

### Pilot or paying

File 11 records whether an organisation is on a **pilot**, is **paying**, is
**internal** (ours, for testing), or has **lapsed**. It shows on the admin
organisation list and is set from that organisation's admin page.

**It is never shown to the organisation itself.** A customer should not open
their dashboard and read "pilot, expires in three weeks": that is a
conversation, not a status line. The application only selects these columns
through the `admin_org_accounts` view, which is the one place they are read.

Being honest about the limit: `organisations` is readable by every signed-in
user, and column-level rules cannot be layered on top of that, so a determined
person querying the table directly could see the field. Nothing here would be
damaging if seen; it would simply be a conversation happening in the wrong
place. If that ever stops being true, the columns move to their own table with
their own rule, as `org_contacts` already does.

Only Proven staff can change it. `organisations` grants UPDATE to an
organisation's own admins, so without the staff check in `setOrgAccount` a
funder could mark themselves as paying.

### Onboarding a funder

**Add an organisation** on the admin panel creates it, so no database console
is needed. Their staff still need accounts: they sign up through the app like
anyone else, then you add each person to `memberships` as in step 6 above.

That last step stays in SQL deliberately. Granting someone sight of a funder's
whole portfolio is not something a form should do casually.

### Still to do before real users

File 5 provides the machinery. Two things remain a decision for you, not code:

- **Name an Information Officer** and register them with the Information
  Regulator. POPIA requires this of every responsible party.
- **Put a real contact address** in the privacy notice for access and deletion
  requests, replacing "Email us" in `app/src/app/account/privacy/page.tsx`.

---

## Your admin panel

As the creator of Proven, this is how you see the whole platform: how many
people have signed up, how many businesses are enrolled, and how many of those
are funded versus tracking on their own.

### Getting access

Two steps, once:

1. **Sign up through the app** like anyone else, at `/sign-up`.
2. **Grant yourself admin**, in the SQL Editor:

```sql
update profiles
set is_platform_admin = true
where email = 'your-email@example.com';
```

Sign out and back in. You will land on **`/admin`**.

There is no way to grant this through the app, on purpose. It is set in the
database or not at all, so nobody can give it to themselves.

### What it shows

| Tile | Answers |
|---|---|
| **People enrolled** | How many accounts exist, entrepreneurs and funder staff together |
| **Businesses enrolled** | How many businesses, and how many have actually reported figures |
| **Funding organisations** | How many funders or licensees are on the platform |
| **Months reported** | Total months of figures recorded across everyone |
| **Funded** | Businesses with a confirmed link to an organisation |
| **Not funded** | Businesses tracking independently, the ones you are now also serving |
| **Awaiting confirmation** | Businesses that named a funder who has not confirmed yet |

Below the tiles, **every organisation** with its people count, businesses funded
and requests waiting. **Click one to open it** and see its businesses, its
people, and how many months each business has reported.

Businesses are reached through their organisation rather than listed flat: a
platform with fifty funders and a thousand businesses is unusable as one list.
The only businesses shown on the main page are those **tracking independently**,
because they belong to no organisation and would otherwise be invisible.

A business that enrolled but has never reported is called out separately.
Enrolment is not the same as being helped, and that gap is the number worth
watching.

### What it deliberately does not show

The panel is **read-only**, and it shows *who is enrolled and whether they are
reporting*, never the figures themselves. A business's revenue belongs to that
business and to the funder it has confirmed. Being Proven staff means you can
see how the platform is being used, not read a stranger's books.

### If `/admin` shows "page not found"

That is the guard working. It means `is_platform_admin` is not set on your
profile, or you signed in before setting it. Run the `update` above, then sign
out and in again.

The route returns *not found* rather than *forbidden* on purpose, so nobody who
should not have it can learn that the page exists.

---

## The demo data, for presenting

Running **file 4** puts the three businesses from the prototype into the live
platform as real rows, with real sign-in accounts. Judges can then be shown the
working product using the same figures and the same scores as the pitch deck.

Run it exactly like the others: SQL Editor, New query, paste, Run.

### The accounts it creates

Password for all of them: **`proven2026`**

| Sign in as | Email | Shows |
|---|---|---|
| Nandi Beauty Studio | `nandi-beauty@demo.proven.co.za` | **Healthy**, scores 94.2, Credit-Ready Candidate |
| Soweto Sunrise Bakery | `soweto-bakery@demo.proven.co.za` | **On watch**, scores 72.5, Strong Evidence |
| Zola Deliveries | `zola-deliveries@demo.proven.co.za` | **At risk**, scores 41.1, Building Track Record |
| Absa Youth Entrepreneurship Fund | `funder@demo.proven.co.za` | The funder view, all three in one portfolio |

The sign-in page offers these in a **Demo account** dropdown that fills in the
email and password for you, so nobody has to type an address in front of an
audience.

### The walkthrough, screen by screen

1. **`/`** opens on the story: four beats of one business failing while nobody
   watches. Click through Month 1 to Month 7, ending on *"The problem wasn't
   that nobody cared. It was that nobody saw it in time."*
2. **Open the platform** goes to `/platform`, the seven-step journey and the
   two entry points.
3. **Enter as Entrepreneur**, pick **Nandi Beauty Studio** from the demo
   dropdown, and sign in. A healthy business: 94.2, all four factors shown
   openly.
4. **Switch role**, then **Enter as Funder** as `funder@demo.proven.co.za`. The
   same three businesses, ordered worst-first, with the same scores the
   entrepreneurs see.
5. Open **Zola Deliveries** from the portfolio to close on the at-risk case:
   41.1, a missed update, a delayed stage, and guidance naming its largest
   cost by name.

**Back to Home** in the corner of `/platform` returns to step 1 at any point.

### Why the scores never change

The figures run January to June 2025, fixed, rather than being generated
relative to today. A business that scores 94.2 in rehearsal scores 94.2 on the
day. There is a test in [`packages/engine/`](../packages/engine/) that reads
this migration and checks all three numbers, so an accidental edit fails the
build instead of surprising you on stage.

### Re-running and removing it

**Safe to run again.** It clears the demo accounts first, so you get one clean
copy rather than duplicates. Run it again to reset everything after a
demonstration where you changed figures.

**Before any real deployment, remove it:**

```sql
delete from auth.users where email like '%@demo.proven.co.za';
delete from organisations where slug = 'ayef-demo';
```

These are shared accounts with a published password. They are fine for a
demonstration and must not exist anywhere real people sign up.

---

## When something is not working

### "That email address and password do not match an account", but you just signed up

The migrations have not run. Supabase creates the account itself, in a schema
that exists from the start, so signing up succeeds. The **profile** row every
other table points at is created by a trigger in **file 3**, so without it the
account exists but cannot be used.

Check:

```sql
select count(*) from information_schema.tables where table_schema = 'public';
```

**0 means nothing has run.** Go back to step 2. It should be 11.

Then clear up the unusable account, under **Authentication → Users**, delete
it, and sign up again. The trigger only fires for *new* accounts, so an
existing one cannot repair itself. If you would rather keep it:

```sql
insert into profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;
```

### "Could not sign in: Database error querying schema"

Supabase Auth could not read the account row. Two causes, both handled by the
current migrations but worth knowing if you ever write accounts by hand:

- **A NULL in one of `auth.users`'s text columns.** Auth reads them into plain
  strings, and a NULL breaks sign-in with this message, which names the schema
  when the cause is the row.
- **A trigger on `auth.users` that raises.** It runs inside Auth's own
  transaction, so anything it throws fails the whole request.

If you see this on a demo account, re-run
[file 4](migrations/20260812100004_demo_data.sql): it clears and recreates
them.

### The Table Editor shows no tables

Check the schema selector at the top of the Table Editor is set to **public**.
Tables named `messages`, `subscription`, `schema_migrations` or `secrets`
belong to Supabase's own `realtime` and `vault` schemas, not to Proven, and
they are there whether or not your migrations have run.

### "Your project's URL and Key are required to create a Supabase client"

The app cannot see your keys. The file must be **`app/.env.local`**, not
`.env.local` at the repository root, and the dev server has to be restarted
after it changes. See step 5.

---

## Everyday tasks

**See the tables and their contents:** left sidebar → **Table Editor**.

**Run a query:** left sidebar → **SQL Editor**.

**Check who has signed up:** **Authentication → Users**.

**Back up the database:** **Settings → Database → Backups**. Paid plans take
daily backups automatically; on the free plan, take one manually before any
change you are unsure about.

**Start over completely:**

```sql
drop schema public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
```

Then run the migration files again from step 2. **This deletes every
business, figure and receipt in the project.**

> Do not add `grant all on all tables ... to anon` here. Table access comes
> from the security rules in file 2, per table and per role. A blanket grant
> would hand the public browser key full access to anything those rules have
> not yet locked down.

---

## A note on the free plan

The free tier is enough to build and demonstrate the whole platform. Two
limits to know about:

- **Projects pause after a week of no activity.** Opening the dashboard wakes
  one back up, but do not let this happen the morning of a demo. Open the
  project the day before.
- **500 MB of database, 1 GB of file storage.** Receipts are capped at 10 MB
  each, so this is thousands of businesses' worth of figures and hundreds of
  receipts.

---

## Start the app

With the database live and `app/.env.local` filled in, from the repository
root:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, create an account, and add a business. If you
made yourself an organisation admin in step 6, sign up a second account, add a
business there naming that organisation as its funder, then confirm the request
from the funder side. That exercises the whole model end to end: enrolment,
the confirmation gate, and a funder seeing figures they cannot edit.

The standalone HTML prototype that preceded this app has been retired: every
feature it had now lives in [`app/`](../app/), which is the only codebase from
here. It remains in git history if it is ever needed.

---

## Deploying to Vercel

This repository is an npm workspace: the app is in `app/`, and the scoring
engine it imports is in `packages/engine/`. Two settings follow from that, and
a deploy fails without them.

**1. Root Directory must be `app`.**

Vercel looks for `next` in the Root Directory's `package.json`. The repository
root is a workspace container that does not depend on `next` itself, so a
deploy from the root fails with *"No Next.js version detected"*.

In **Settings → General → Root Directory**, set it to `app` and tick
**Include files outside the root directory**. That last box matters: without
it, `packages/engine` is not copied and the build cannot resolve
`@proven/engine`.

The install and build commands in [`app/vercel.json`](../app/vercel.json) then
`cd ..` deliberately, because the engine has to be compiled to `dist/` before
the app can import it, and `dist/` is not committed.

**2. The three environment variables.**

In **Settings → Environment Variables**:

| Variable | Environments |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | **Production only** |

The service-role key bypasses every security rule in file 2. Preview
deployments get public URLs, so it does not belong there.

**Redeploy after adding them.** Next reads environment variables at build time,
so variables added to an existing deployment do nothing until the next build.

If `SUPABASE_SERVICE_ROLE_KEY` is missing, sign-up still appears to work but
records no consent, because that write uses the admin client and its failure is
deliberately swallowed rather than stranding someone with an unusable account.
Check with the `consents` query above after your first real sign-up.
