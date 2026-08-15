-- =============================================================================
-- More than one owner
-- =============================================================================
-- The profile captured a single owner: `owner_name`, `owner_role`,
-- `owner_phone`, `owner_email`. Plenty of businesses are owned by two or three
-- people on a split, and a form with one owner field asks them to leave a
-- co-owner off their own company's record.
--
-- Owners are people in the business, so they belong in `team_members` rather
-- than in a second table that would then disagree with it. Two columns are
-- added: whether this person is an owner, and what share they hold.
--
-- The `businesses.owner_*` columns are LEFT IN PLACE and keep working. They
-- become the primary contact, which is a different and still useful fact: a
-- funder needs one person to call, not a list. Nothing that reads them breaks.
--
-- Run after file 6. Safe to run twice.
-- =============================================================================

alter table team_members
  -- An owner is a team member with this set, not a separate kind of record.
  add column if not exists is_owner boolean not null default false,

  -- Percentage held. Null means "an owner, share not stated", which is the
  -- common case: many partnerships have never written the split down, and
  -- forcing a number would invent one.
  add column if not exists ownership_pct numeric(5, 2);

-- Added separately and guarded: `add constraint` has no IF NOT EXISTS, so
-- folding it into the statement above would fail on a second run and take the
-- rest of this file with it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_members_ownership_pct_range'
  ) then
    alter table team_members
      add constraint team_members_ownership_pct_range
      check (ownership_pct is null or (ownership_pct >= 0 and ownership_pct <= 100));
  end if;
end
$$;

comment on column team_members.is_owner is
  'Marks this person as an owner of the business. Owners are team members rather than a separate table, so headcount and ownership never disagree about who is here.';

comment on column team_members.ownership_pct is
  'Share held, or null for an owner whose split has not been stated. Deliberately not required: many partnerships have never written it down.';

-- Owners first when listing people, then by when they joined.
create index if not exists team_members_owner_idx
  on team_members (business_id, is_owner desc, started_on);


-- ---------------------------------------------------------------------------
-- Carry the existing single owner across
-- ---------------------------------------------------------------------------
-- Any business that filled in `owner_name` before this file ran gets that
-- person created as an owner row, so the team list matches what the profile
-- already showed. Guarded on there being no owner row yet, which is what makes
-- this safe to run twice.
insert into team_members (business_id, full_name, role, employment_type, is_owner)
select
  b.id,
  trim(b.owner_name),
  coalesce(nullif(trim(b.owner_role), ''), 'Owner'),
  'owner'::employment_type,
  true
from businesses b
where length(trim(b.owner_name)) > 0
  and not exists (
    select 1 from team_members t
     where t.business_id = b.id
       and t.is_owner
  );


-- ---------------------------------------------------------------------------
-- Completeness, updated
-- ---------------------------------------------------------------------------
-- Same weights as before, with one change: the owner points are earned by
-- having an owner recorded EITHER on the business or as a team member, so a
-- business that lists two owners in the team is not marked down for leaving
-- the single-owner field blank.
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
      (case when length(trim(b.owner_name)) > 0
              or exists (
                select 1 from team_members t
                 where t.business_id = b.id and t.is_owner
              ) then 15 else 0 end) +
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
