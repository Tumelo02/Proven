-- =============================================================================
-- The business profile
-- =============================================================================
-- Until now a business was six fields captured once at enrolment and never
-- looked at again. That is enough to score it and not nearly enough to
-- recognise it: a funder opening the portfolio sees two grey initials, and an
-- entrepreneur sees a record that does not feel like theirs.
--
-- Three things are added:
--
--   1. IDENTITY, so the business is recognisable: logo, what it does, who runs
--      it, how to reach them, where it trades.
--   2. THE TEAM, as rows rather than one free-text field, because "how many
--      jobs" is the question every development funder in South Africa reports
--      upward and a text blob cannot answer it.
--   3. STAFF COUNT OVER TIME, so job creation becomes visible. A single number
--      set at signup can only ever say how many people work there today.
--
-- Everything here is OPTIONAL. A business must still be able to enrol and
-- report its first month in under two minutes; the profile is filled in
-- afterwards, prompted rather than demanded.
--
-- Run after files 1 to 3. Safe to run twice.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Identity
-- ---------------------------------------------------------------------------
alter table businesses
  -- What it does, in the owner's own words. Shown under the name on both
  -- sides, so a funder reading a portfolio knows what they are looking at.
  add column if not exists tagline text not null default '',
  add column if not exists description text not null default '',

  -- Path in the `logos` storage bucket, not a URL. The bucket is private and
  -- served through signed links, exactly like `proofs`.
  add column if not exists logo_path text,

  -- Who runs it. Kept on the business rather than read from `profiles`,
  -- because the person who signed up is not always the owner of record, and a
  -- funder needs the latter.
  add column if not exists owner_name text not null default '',
  add column if not exists owner_role text not null default '',
  add column if not exists owner_phone text not null default '',
  add column if not exists owner_email text not null default '',

  -- Where it trades. `region` already exists and stays the short label used in
  -- tables; these are the full details a funder needs for a site visit.
  add column if not exists address_line text not null default '',
  add column if not exists city text not null default '',
  add column if not exists province text not null default '',
  add column if not exists postal_code text not null default '',

  -- Formal registration. Every South African funder asks for these, and an
  -- entrepreneur who has them should not have to send them by email each time.
  -- Blank is normal: many businesses in this market are unregistered, and
  -- saying so plainly is better than implying they are incomplete.
  add column if not exists registration_number text not null default '',
  add column if not exists tax_number text not null default '',
  add column if not exists vat_number text not null default '',
  add column if not exists bbbee_level text not null default '',

  -- How to find them. A funder verifying a business often starts here.
  add column if not exists website text not null default '',
  add column if not exists social_handle text not null default '';

comment on column businesses.logo_path is
  'Object path in the private `logos` bucket, keyed <business_id>/<file>. Never a public URL: served through a signed link like every other uploaded file.';

comment on column businesses.owner_name is
  'The owner of record, which is not always the account holder who enrolled the business. Funders need the former.';


-- ---------------------------------------------------------------------------
-- 2. The team
-- ---------------------------------------------------------------------------
-- Rows, not a text field. `businesses.team_roles` held something like
-- "2 bakers, 1 driver", which reads fine and answers nothing: it cannot be
-- counted, grouped by employment type, or reported on. That column is left
-- alone so nothing existing breaks, and this table becomes the real record.
--
-- Employment type matters because "jobs supported" means different things to
-- different funders, and a full-time post is not a part-time one.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'employment_type') then
    create type employment_type as enum (
      'full_time',
      'part_time',
      'casual',      -- Paid by the day or the shift, common in this market
      'volunteer',   -- Unpaid, often family, still real labour
      'owner'        -- The founder working in the business
    );
  end if;
end
$$;

create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses (id) on delete cascade,
  full_name text not null,
  role text not null default '',
  employment_type employment_type not null default 'full_time',
  -- When they joined and, if they have, when they left. `left_on` is what
  -- makes headcount answerable for any past date rather than only today.
  started_on date,
  left_on date,
  created_at timestamptz not null default now(),
  constraint team_members_name_not_blank check (length(trim(full_name)) > 0),
  constraint team_members_left_after_started check (
    left_on is null or started_on is null or left_on >= started_on
  )
);

create index if not exists team_members_business_idx
  on team_members (business_id, started_on);

comment on table team_members is
  'The people in a business, as rows. Replaces the free-text businesses.team_roles for anything that has to be counted, which is every funder report.';


-- ---------------------------------------------------------------------------
-- 3. Staff count over time
-- ---------------------------------------------------------------------------
-- `businesses.staff_count` is a single number set at enrolment. Job creation
-- is the metric a development funder reports upward, and it is a difference
-- between two dates, which one number can never express.
--
-- Recorded per month so it lines up with `reporting_periods`, and left to be
-- captured alongside the monthly figures rather than as a separate chore.
create table if not exists staff_counts (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses (id) on delete cascade,
  -- First of the month, matching `reporting_periods.period_month`, so the two
  -- can be read side by side without date juggling.
  period_month date not null,
  full_time integer not null default 0,
  part_time integer not null default 0,
  casual integer not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, period_month),
  constraint staff_counts_non_negative check (
    full_time >= 0 and part_time >= 0 and casual >= 0
  ),
  constraint staff_counts_month_is_first check (
    period_month = date_trunc('month', period_month)::date
  )
);

create index if not exists staff_counts_business_idx
  on staff_counts (business_id, period_month desc);

comment on table staff_counts is
  'Headcount by month, so job creation is a visible trend rather than one number captured once at enrolment.';


-- ---------------------------------------------------------------------------
-- 4. Profile completeness
-- ---------------------------------------------------------------------------
-- Drives the nudge to finish the profile, and tells a funder how much of what
-- they are reading is actually filled in.
--
-- Weighted by what each field is FOR, not by how many there are: what the
-- business does and who runs it matter more than a VAT number. Registration
-- details are deliberately a small share, because most businesses in this
-- market do not have them and a completeness score that punishes an informal
-- trader for being informal is measuring the wrong thing.
create or replace function profile_completeness(target_business_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select least(100, coalesce((
    select
      (case when length(trim(b.tagline)) > 0 then 15 else 0 end) +
      (case when length(trim(b.description)) > 0 then 15 else 0 end) +
      (case when b.logo_path is not null then 10 else 0 end) +
      (case when length(trim(b.owner_name)) > 0 then 15 else 0 end) +
      (case when length(trim(b.owner_phone)) > 0
              or length(trim(b.owner_email)) > 0 then 10 else 0 end) +
      (case when length(trim(b.industry)) > 0 then 5 else 0 end) +
      (case when length(trim(b.city)) > 0
              or length(trim(b.region)) > 0 then 10 else 0 end) +
      (case when b.started_on is not null then 5 else 0 end) +
      (case when length(trim(b.registration_number)) > 0 then 5 else 0 end) +
      (case when exists (
          select 1 from team_members t where t.business_id = b.id
        ) then 10 else 0 end)
    from businesses b
   where b.id = target_business_id
  ), 0));
$$;


-- ---------------------------------------------------------------------------
-- 5. Access rules
-- ---------------------------------------------------------------------------
-- Both new tables follow the same rule as every other table hanging off a
-- business: the owner writes, a CONFIRMED funder reads, Proven staff read.
-- `can_read_business` and `owns_business` already encode exactly that.
alter table team_members enable row level security;
alter table staff_counts enable row level security;

drop policy if exists team_members_select on team_members;
create policy team_members_select on team_members
  for select using (can_read_business(business_id));

drop policy if exists team_members_insert_own on team_members;
create policy team_members_insert_own on team_members
  for insert with check (owns_business(business_id));

drop policy if exists team_members_update_own on team_members;
create policy team_members_update_own on team_members
  for update using (owns_business(business_id))
  with check (owns_business(business_id));

drop policy if exists team_members_delete_own on team_members;
create policy team_members_delete_own on team_members
  for delete using (owns_business(business_id));

drop policy if exists staff_counts_select on staff_counts;
create policy staff_counts_select on staff_counts
  for select using (can_read_business(business_id));

drop policy if exists staff_counts_insert_own on staff_counts;
create policy staff_counts_insert_own on staff_counts
  for insert with check (owns_business(business_id));

drop policy if exists staff_counts_update_own on staff_counts;
create policy staff_counts_update_own on staff_counts
  for update using (owns_business(business_id))
  with check (owns_business(business_id));

drop policy if exists staff_counts_delete_own on staff_counts;
create policy staff_counts_delete_own on staff_counts
  for delete using (owns_business(business_id));

grant select, insert, update, delete on team_members to authenticated;
grant select, insert, update, delete on staff_counts to authenticated;
grant select on team_members to anon;
grant select on staff_counts to anon;


-- ---------------------------------------------------------------------------
-- 6. Logo storage
-- ---------------------------------------------------------------------------
-- A separate bucket from `proofs`, with a smaller limit and image types only.
-- Private, like everything else: a logo is not secret, but a public bucket
-- would make every object in it enumerable, and the same bucket then holds a
-- guessable path for every business on the platform.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  false,
  2097152, -- 2 MB: a logo, not a photograph
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

-- Keyed `<business_id>/<file>`, and the policies read that first segment,
-- exactly as the `proofs` policies do.
drop policy if exists logos_select on storage.objects;
create policy logos_select on storage.objects
  for select using (
    bucket_id = 'logos'
    and can_read_business(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists logos_insert_own on storage.objects;
create policy logos_insert_own on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and owns_business(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists logos_update_own on storage.objects;
create policy logos_update_own on storage.objects
  for update using (
    bucket_id = 'logos'
    and owns_business(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists logos_delete_own on storage.objects;
create policy logos_delete_own on storage.objects
  for delete using (
    bucket_id = 'logos'
    and owns_business(((storage.foldername(name))[1])::uuid)
  );
