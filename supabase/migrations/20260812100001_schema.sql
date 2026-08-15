-- =============================================================================
-- Proven: schema
-- =============================================================================
-- Multi-tenant from the first line, deliberately. Retrofitting tenancy later
-- would mean changing every table, query and policy at once, so the boundary
-- is built in before there is any data to migrate.
--
-- The central rule: a business is the unit of ownership. An entrepreneur owns
-- their business; a funding organisation sees a business only through a
-- CONFIRMED funding link; Proven staff can read across every organisation and
-- are the only party who can verify evidence. Nothing grants blanket access to
-- "all businesses" except that platform-admin role.
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enumerated vocabularies
-- ---------------------------------------------------------------------------
-- These mirror the scoring engine's TypeScript unions exactly. A value the
-- engine cannot interpret must not be storable in the first place.

-- Whether a monthly update arrived, and when. A fifth of the health score.
create type report_status as enum ('on-time', 'late', 'missed');

-- Health tiers. Stored on score snapshots, never hand-set.
create type health_tier as enum ('green', 'yellow', 'red');

create type milestone_status as enum ('done', 'current', 'delayed', 'pending');

create type transaction_type as enum ('revenue', 'expense');

-- A business enrols whether or not it is funded. `unfunded` is a first-class
-- state, not an absence: an unfunded business tracks, scores, and builds the
-- same credit-readiness record, which is what it later takes to a funder.
create type funding_status as enum ('unfunded', 'applicant', 'funded', 'exited');

-- Roles within one organisation.
create type org_role as enum ('member', 'admin');

-- Proven records that evidence exists; it does not certify it. `pending` is
-- the honest default and the product must never imply otherwise.
create type review_status as enum ('pending', 'verified', 'rejected');

-- A business asks to be linked to a funder; the funder confirms. Without this
-- a business could attach itself to an organisation that has never heard of
-- it, and appear on that funder's portfolio uninvited.
create type link_status as enum ('pending', 'confirmed', 'rejected');

-- Why evidence was not accepted. A fixed set rather than free text, so the
-- entrepreneur reads a consistent sentence, the same reason means the same
-- thing across reviewers, and the reasons can be counted.
create type document_reject_reason as enum (
  'unreadable',        -- Blurred, cropped, too dark to read
  'amount_mismatch',   -- The document shows a different amount
  'date_mismatch',     -- The document is for a different period
  'wrong_document',    -- A receipt for something else entirely
  'not_a_receipt',     -- A screenshot, a note, something that proves nothing
  'duplicate',         -- Already attached to another entry
  'other'              -- Anything else; the note then carries the detail
);


-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user
-- ---------------------------------------------------------------------------
-- Supabase owns `auth.users`. This mirrors the parts the application needs and
-- is what every other table's foreign keys point at.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  -- Proven's own staff. Grants cross-tenant read access and the sole ability
  -- to verify evidence, so it is set by hand in SQL and by nothing else.
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

comment on column profiles.is_platform_admin is
  'Proven staff. Cross-tenant visibility, and the only role that can review evidence. Never settable through the application.';


-- ---------------------------------------------------------------------------
-- organisations: a funder, incubator, or any licensee
-- ---------------------------------------------------------------------------
create table organisations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  -- Short code a business types to request a link, instead of guessing names.
  slug text not null unique,
  created_at timestamptz not null default now(),
  constraint organisations_name_not_blank check (length(trim(name)) > 0)
);


-- ---------------------------------------------------------------------------
-- memberships: which users belong to which organisation
-- ---------------------------------------------------------------------------
-- A user may belong to several organisations, so this is a join table rather
-- than a column on profiles.
create table memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  role org_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

create index memberships_user_idx on memberships (user_id);
create index memberships_org_idx on memberships (org_id);


-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
-- Owned by the entrepreneur, always. `funding_status` records the funding
-- relationship; the link itself lives in `funding_links` so a funder has to
-- confirm it.
create table businesses (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  industry text not null default '',
  region text not null default '',
  funding_status funding_status not null default 'unfunded',
  started_on date,
  staff_count integer not null default 0,
  team_roles text not null default '',
  created_at timestamptz not null default now(),
  constraint businesses_name_not_blank check (length(trim(name)) > 0),
  constraint businesses_staff_count_non_negative check (staff_count >= 0)
);

create index businesses_owner_idx on businesses (owner_id);
create index businesses_funding_status_idx on businesses (funding_status);


-- ---------------------------------------------------------------------------
-- funding_links: the confirmed relationship between a business and a funder
-- ---------------------------------------------------------------------------
-- This table is the entire basis of a funder's read access. A row that is not
-- `confirmed` grants nothing.
create table funding_links (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  status link_status not null default 'pending',
  -- Who asked and who confirmed. Both are historical facts about how this
  -- funder came to see this business's figures, so NEITHER carries a foreign
  -- key: the record has to outlive the accounts involved. A cascade here would
  -- delete the funding link when a staff member left, and `on delete set null`
  -- would fight the CHECK below and make the deletion fail outright.
  requested_by uuid not null,
  confirmed_by uuid,
  confirmed_at timestamptz,
  amount numeric(14, 2),
  funded_on date,
  terms text not null default '',
  created_at timestamptz not null default now(),
  unique (business_id, org_id),
  constraint funding_links_amount_non_negative check (amount is null or amount >= 0),
  -- A confirmed link must record who confirmed it and when: this is the audit
  -- trail for why a funder can see a business's figures.
  constraint funding_links_confirmed_has_actor check (
    status <> 'confirmed' or (confirmed_by is not null and confirmed_at is not null)
  )
);

comment on column funding_links.confirmed_by is
  'Who confirmed this link. A historical record, not a live reference: deliberately without a foreign key, so the audit trail survives that profile being deleted.';

create index funding_links_business_idx on funding_links (business_id);
create index funding_links_org_idx on funding_links (org_id, status);


-- ---------------------------------------------------------------------------
-- reporting_periods: one row per business per month
-- ---------------------------------------------------------------------------
-- The unit the entire health score is built on.
create table reporting_periods (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses (id) on delete cascade,
  -- Normalised to the first of the month, so "the June period" is one row.
  period_month date not null,
  revenue numeric(14, 2) not null default 0,
  expenses numeric(14, 2) not null default 0,
  customers integer not null default 0,
  status report_status not null default 'on-time',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, period_month),
  constraint reporting_periods_revenue_non_negative check (revenue >= 0),
  constraint reporting_periods_expenses_non_negative check (expenses >= 0),
  constraint reporting_periods_customers_non_negative check (customers >= 0),
  constraint reporting_periods_month_is_first check (
    period_month = date_trunc('month', period_month)::date
  )
);

create index reporting_periods_business_month_idx
  on reporting_periods (business_id, period_month desc);


-- ---------------------------------------------------------------------------
-- transactions and their supporting documents
-- ---------------------------------------------------------------------------
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses (id) on delete cascade,
  -- Nullable: an entry can be logged before its month is closed off.
  period_id uuid references reporting_periods (id) on delete set null,
  type transaction_type not null,
  description text not null default '',
  category text not null default '',
  amount numeric(14, 2) not null,
  occurred_on date not null,
  created_at timestamptz not null default now(),
  constraint transactions_amount_positive check (amount > 0)
);

create index transactions_business_idx on transactions (business_id, occurred_on desc);

-- Receipts and invoices. The file itself lives in Supabase Storage; this row
-- records that it exists and what Proven made of it.
create table documents (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid not null references transactions (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null default '',
  size_bytes bigint not null default 0,
  review_status review_status not null default 'pending',
  -- Historical, like the funding-link columns: a review survives the reviewer's
  -- account being removed, so no foreign key.
  reviewed_by uuid,
  reviewed_at timestamptz,
  -- Why it was not accepted. Rejecting without saying why leaves the business
  -- guessing at what to change, which is the difference between a flag and
  -- guidance, and the whole point the product rests on.
  reject_reason document_reject_reason,
  reject_note text not null default '',
  uploaded_at timestamptz not null default now(),
  constraint documents_size_non_negative check (size_bytes >= 0),
  constraint documents_rejected_has_reason check (
    review_status <> 'rejected' or reject_reason is not null
  )
);

comment on column documents.review_status is
  'pending until Proven staff check it. Never settable by the uploading business or by its funder.';

create index documents_transaction_idx on documents (transaction_id);
create index documents_review_idx on documents (review_status, uploaded_at);


-- ---------------------------------------------------------------------------
-- milestones
-- ---------------------------------------------------------------------------
create table milestones (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses (id) on delete cascade,
  label text not null,
  status milestone_status not null default 'pending',
  -- Position in the four-stage journey, so ordering never depends on the label.
  sort_order integer not null default 0,
  target_date date,
  completed_on date,
  created_at timestamptz not null default now()
);

create index milestones_business_idx on milestones (business_id, sort_order);


-- ---------------------------------------------------------------------------
-- score_snapshots: what the score was, on a given date
-- ---------------------------------------------------------------------------
-- Scores are recomputed by the shared engine, never stored as the source of
-- truth. This table is the audit record: it answers "what did this business
-- score in June, and why", which a recomputation from today's rules cannot.
create table score_snapshots (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses (id) on delete cascade,
  computed_at timestamptz not null default now(),
  health_score numeric(5, 2) not null,
  health_tier health_tier not null,
  -- The four weighted factors, kept as written so an old score stays
  -- explainable even after the weights are revised.
  health_factors jsonb not null,
  credit_score numeric(5, 2) not null,
  credit_band text not null,
  -- The version of the rules that produced this, so a change to the weights
  -- is visible rather than silently rewriting history.
  engine_version text not null default '1.0.0',
  constraint score_snapshots_health_range check (health_score >= 0 and health_score <= 100),
  constraint score_snapshots_credit_range check (credit_score >= 0 and credit_score <= 100)
);

create index score_snapshots_business_idx
  on score_snapshots (business_id, computed_at desc);


-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
-- Written by the application only. Every funding-link confirmation and every
-- evidence decision belongs here: "who verified this, and when" is precisely
-- the question a disputed record turns on.
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles (id) on delete set null,
  org_id uuid references organisations (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_actor_idx on audit_log (actor_id, created_at desc);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);
