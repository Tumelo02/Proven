-- ---------------------------------------------------------------------------
-- Business team: more than one person per business
-- ---------------------------------------------------------------------------
--
-- Until now a business was exactly one account. The owner logged everything
-- themselves, and anyone else who helped — a partner, a bookkeeper, the person
-- who actually serves the customers — either shared the owner's password or
-- did not use Proven at all. Both are bad: a shared password makes the audit
-- trail a work of fiction, and the alternative means the record is only as
-- complete as one person's time.
--
-- Three roles, matching what people actually do:
--
--   viewer  — reads the figures and the report. Changes nothing.
--   editor  — logs transactions and reports months. The day-to-day.
--   manager — the above, plus the business profile and funding requests.
--
-- The OWNER is not a role here. Ownership stays on `businesses.owner_id` and
-- is not grantable: only the owner can manage the team, and nobody can be
-- promoted to owner through this table. That is deliberate — a team member who
-- could grant ownership could take the business.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'business_role') then
    create type business_role as enum ('viewer', 'editor', 'manager');
  end if;
end
$$;

create table if not exists business_members (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role business_role not null default 'viewer',
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references profiles (id) on delete set null,
  unique (business_id, user_id)
);

create index if not exists business_members_user_idx on business_members (user_id);
create index if not exists business_members_business_idx on business_members (business_id);

comment on table business_members is
  'People other than the owner who may use a business. Ownership itself is not a role here and cannot be granted through this table.';

alter table business_members enable row level security;

-- Read: the owner sees the whole team; a member sees their own row, so the
-- interface can hide what they may not use. No INSERT, UPDATE or DELETE policy
-- exists, so the table is read-only to every client and all writes go through
-- the owner-checked functions below.
drop policy if exists business_members_select_owner on business_members;
create policy business_members_select_owner on business_members
  for select using (owns_business(business_id));

drop policy if exists business_members_select_self on business_members;
create policy business_members_select_self on business_members
  for select using (user_id = auth.uid());

drop policy if exists business_members_select_admin on business_members;
create policy business_members_select_admin on business_members
  for select using (is_platform_admin_uncached());


-- ---------------------------------------------------------------------------
-- What a team member may do
-- ---------------------------------------------------------------------------
create or replace function business_member_role(target_business_id uuid)
returns business_role
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role business_role;
begin
  select m.role into v_role
    from public.business_members m
   where m.business_id = target_business_id
     and m.user_id = auth.uid();
  return v_role;
end;
$$;

/* May this account change the business's figures? The owner always may; a
   team member may when they are an editor or a manager. A viewer never may,
   which is the whole point of the role. */
create or replace function can_edit_business(target_business_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if owns_business(target_business_id) then
    return true;
  end if;
  return coalesce(business_member_role(target_business_id) in ('editor', 'manager'), false);
end;
$$;

comment on function can_edit_business is
  'Owner, editor or manager. A viewer is excluded, which is what makes the viewer role mean anything.';


-- ---------------------------------------------------------------------------
-- Teach the existing access rules about the team
-- ---------------------------------------------------------------------------
-- These two functions are the chokepoints every policy in the schema already
-- goes through, so extending them covers the whole database at once rather
-- than editing dozens of policies and missing one.

create or replace function can_see_business(target_business_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return
    is_platform_admin_uncached()
    or exists (
      select 1 from public.businesses b
       where b.id = target_business_id and b.owner_id = auth.uid()
    )
    -- Anyone on the team, whatever their role: reading is the minimum a team
    -- member has.
    or exists (
      select 1 from public.business_members m
       where m.business_id = target_business_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.funding_links fl
       where fl.business_id = target_business_id
         and fl.status = 'confirmed'
         and fl.org_id in (select my_org_ids())
    );
end;
$$;

/* `owns_business` gates every write an entrepreneur makes, so an editor needs
   to pass it to be able to log anything at all. Widened to mean "may act for
   this business" rather than "is the owner of it".

   The one thing it must NOT widen is managing the team itself, which is why
   the functions below check `businesses.owner_id` directly instead of calling
   this. A manager who could add members could add themselves as owner. */
create or replace function owns_business(target_business_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.businesses b
     where b.id = target_business_id and b.owner_id = auth.uid()
  ) or coalesce(
    (select m.role from public.business_members m
      where m.business_id = target_business_id and m.user_id = auth.uid())
      in ('editor', 'manager'),
    false
  );
end;
$$;

comment on function owns_business is
  'May this account act for the business: its owner, or a team member who is an editor or manager. Managing the team is checked against businesses.owner_id directly, not through this.';


-- ---------------------------------------------------------------------------
-- Writing the team
-- ---------------------------------------------------------------------------
-- Checked against `businesses.owner_id` directly and deliberately, NOT through
-- `owns_business`: that now includes editors and managers, and a manager who
-- could add members could add themselves as owner.
create or replace function set_business_member(
  target_business_id uuid,
  target_user uuid,
  new_role business_role,
  new_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.businesses b
     where b.id = target_business_id and b.owner_id = auth.uid()
  ) then
    raise exception 'Only the business owner can manage its team.'
      using errcode = 'insufficient_privilege';
  end if;

  if target_user = auth.uid() then
    raise exception 'You already own this business.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into business_members as m (business_id, user_id, role, note, created_by)
  values (target_business_id, target_user, new_role, coalesce(new_note, ''), auth.uid())
  on conflict (business_id, user_id) do update set
    role = excluded.role,
    note = excluded.note;
end;
$$;


create or replace function remove_business_member(
  target_business_id uuid,
  target_user uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.businesses b
     where b.id = target_business_id and b.owner_id = auth.uid()
  ) then
    raise exception 'Only the business owner can manage its team.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from business_members
   where business_id = target_business_id and user_id = target_user;
end;
$$;
