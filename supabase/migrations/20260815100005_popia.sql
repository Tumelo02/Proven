-- =============================================================================
-- POPIA: consent, retention, and the right to leave
-- =============================================================================
-- The Protection of Personal Information Act governs what Proven may hold
-- about a South African entrepreneur and what a funder may be shown. Three
-- obligations are given structure here, because a policy document that the
-- database cannot enforce is a promise rather than a control:
--
--   1. CONSENT must be recorded: what was agreed, to which wording, and when.
--   2. RETENTION must be stated, and a record must be able to expire.
--   3. A person must be able to LEAVE, taking a copy and having the rest go.
--
-- The hard part is already built. A funder sees a business only after that
-- business asked to be linked and the organisation confirmed it, enforced by
-- `funding_links` and the policies in file 2. That IS consent to share; this
-- file records it as such and adds the pieces around it.
--
-- Written to be run after files 1 to 3, and safe to run twice.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- What a person can be asked to agree to
-- ---------------------------------------------------------------------------
-- An enum rather than free text: a consent trail is only meaningful if the
-- same agreement is named the same way every time it is recorded.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'consent_kind') then
    create type consent_kind as enum (
      'terms',            -- The terms of use for the platform itself
      'privacy',          -- The privacy notice: what is held, why, for how long
      'share_with_funder',-- Figures may be shown to a CONFIRMED funder
      'whatsapp'          -- Monthly check-ins may be sent to a phone number
    );
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- consents: append-only record of every agreement and withdrawal
-- ---------------------------------------------------------------------------
-- APPEND-ONLY BY DESIGN. Withdrawing consent inserts a new row saying so; it
-- never updates or deletes the row that granted it. POPIA asks what a person
-- agreed to at the time data was collected, and a mutable record cannot answer
-- that question. The same reasoning as `audit_log`, and the same shape: no
-- UPDATE policy and no DELETE policy exist for this table.
create table if not exists consents (
  id uuid primary key default uuid_generate_v4(),
  -- Not a foreign key to profiles. A consent record has to outlive the account
  -- it describes: if someone deletes their account we must still be able to
  -- show, to a regulator, that their data was collected lawfully while it was
  -- held. Cascading the delete would destroy exactly the evidence that proves
  -- the deletion was handled properly.
  subject_id uuid not null,
  -- Kept alongside the id for the same reason. After an account is gone the
  -- uuid alone identifies nobody.
  subject_email text not null default '',
  kind consent_kind not null,
  granted boolean not null,
  -- Which wording was agreed to. A privacy notice changes over time, and
  -- "they consented" means nothing without saying to what.
  policy_version text not null,
  -- Collected for a real evidentiary reason: POPIA asks how consent was
  -- obtained. Truncated IPs would be safer, but the honest position is that
  -- this is personal information too, so it is nullable and never required.
  source text not null default 'web',
  created_at timestamptz not null default now(),
  constraint consents_version_not_blank check (length(trim(policy_version)) > 0)
);

create index if not exists consents_subject_idx
  on consents (subject_id, kind, created_at desc);


-- The current state of one consent: the most recent row wins, because the
-- table is a history rather than a state. Written as a function so the
-- "latest row" rule lives in one place instead of in every query.
create or replace function has_consent(target_subject uuid, target_kind consent_kind)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select granted
       from consents
      where subject_id = target_subject
        and kind = target_kind
      order by created_at desc
      limit 1),
    false
  );
$$;


-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------
-- POPIA section 14: personal information may not be kept longer than is
-- necessary for the purpose it was collected for. The purpose here is building
-- a financial track record, which is inherently long-lived, so the period is
-- deliberately long and, importantly, STATED rather than infinite.
--
-- Seven years matches the retention the Companies Act and SARS already require
-- of the underlying financial records, so a shorter period would put Proven in
-- conflict with the entrepreneur's own obligations.
alter table businesses
  add column if not exists retention_until date;

comment on column businesses.retention_until is
  'When this business''s records may be erased. Seven years after the last reported figures, matching the retention already required of the underlying financial records. Null means still active and not yet scheduled.';


-- Marks a business as closed and starts its retention clock. Separate from
-- deletion on purpose: an entrepreneur leaving Proven does not mean a funder's
-- record of a completed loan should vanish the same afternoon.
--
-- SECURITY DEFINER is needed to read every period regardless of policy, so the
-- ownership check is made explicitly here. Without it this function would let
-- any signed-in user start the retention clock on somebody else's business.
create or replace function close_business(target_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  last_period date;
begin
  if not exists (
    select 1 from businesses
     where id = target_business_id
       and owner_id = auth.uid()
  ) then
    raise exception 'Not your business';
  end if;

  select max(period_month) into last_period
    from reporting_periods
   where business_id = target_business_id;

  update businesses
     set retention_until = coalesce(last_period, current_date) + interval '7 years'
   where id = target_business_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- The right to leave, with a copy
-- ---------------------------------------------------------------------------
-- POPIA gives a data subject the right to know what is held about them and to
-- have it corrected or deleted. `export_my_data` answers the first; the app's
-- delete flow answers the second.
--
-- SECURITY DEFINER with an explicit auth.uid() check rather than relying on
-- RLS: the point of this function is to gather everything about one person in
-- a single pass, and it must be impossible to aim it at anybody else.
create or replace function export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  result jsonb;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'profile', (
      select to_jsonb(p) - 'is_platform_admin'
        from profiles p where p.id = me
    ),
    'consents', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at)
        from consents c where c.subject_id = me
    ), '[]'::jsonb),
    'businesses', coalesce((
      select jsonb_agg(
        to_jsonb(b) || jsonb_build_object(
          'reporting_periods', coalesce((
            select jsonb_agg(to_jsonb(r) order by r.period_month)
              from reporting_periods r where r.business_id = b.id
          ), '[]'::jsonb),
          'transactions', coalesce((
            select jsonb_agg(to_jsonb(t) order by t.occurred_on)
              from transactions t where t.business_id = b.id
          ), '[]'::jsonb),
          /* Documents hang off a transaction, not off the business, so this
             reaches them through the ledger rather than directly. */
          'documents', coalesce((
            select jsonb_agg(to_jsonb(d) order by d.uploaded_at)
              from documents d
              join transactions t2 on t2.id = d.transaction_id
             where t2.business_id = b.id
          ), '[]'::jsonb),
          'milestones', coalesce((
            select jsonb_agg(to_jsonb(m) order by m.created_at)
              from milestones m where m.business_id = b.id
          ), '[]'::jsonb),
          'funding_links', coalesce((
            select jsonb_agg(to_jsonb(f) order by f.created_at)
              from funding_links f where f.business_id = b.id
          ), '[]'::jsonb)
        )
        order by b.created_at
      )
        from businesses b where b.owner_id = me
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;


-- ---------------------------------------------------------------------------
-- Access rules
-- ---------------------------------------------------------------------------
alter table consents enable row level security;

-- A person reads their own consent history, and Proven staff read all of it,
-- because answering a regulator is precisely what the record is for.
drop policy if exists consents_select on consents;
create policy consents_select on consents
  for select using (
    subject_id = (select auth.uid())
    or is_platform_admin_uncached()
  );

-- You may only record consent as yourself. Granting and withdrawing are both
-- inserts, so this one policy covers both.
drop policy if exists consents_insert on consents;
create policy consents_insert on consents
  for insert with check (subject_id = (select auth.uid()));

-- No UPDATE policy and no DELETE policy, deliberately. See the table comment:
-- a consent trail that can be rewritten is not a consent trail. Even Proven
-- staff cannot alter it through these rules.

grant select, insert on consents to authenticated;
grant select on consents to anon;

comment on table consents is
  'Append-only history of what each person agreed to and when. Withdrawal is a new row, never an edit. Survives account deletion so lawful collection remains provable.';
