-- ---------------------------------------------------------------------------
-- Staff roles: more than one kind of Proven admin
-- ---------------------------------------------------------------------------
--
-- Until now `profiles.is_platform_admin` was the whole model: either an account
-- could do everything on the staff side, or it was not staff at all. That is
-- workable for one person and wrong for a team. Someone brought in to check
-- receipts should not also be able to disable a business's access, read the
-- commercial standing of every funder, or promote themselves.
--
-- So this adds a role per staff account, and a grant per capability.
--
-- Deliberately a SEPARATE TABLE rather than a column on `profiles`. That is the
-- whole security argument of this migration: `profiles_update_self` lets any
-- account update its own profile row, so a role stored there could be raised by
-- the person it restricts. `staff_roles` has no self-update policy and no
-- client-writable policy at all — every change goes through a SECURITY DEFINER
-- function that checks the caller is an owner first.
--
-- `is_platform_admin` keeps its meaning: it still says "this account is Proven
-- staff", and it is still what the row-level security policies across the rest
-- of the schema read. The role refines what that staff account may do; it never
-- grants staff access on its own.
-- ---------------------------------------------------------------------------

-- owner    : can do everything, including managing other staff accounts.
-- manager  : the day-to-day panel, minus staff management.
-- reviewer : brought in to check evidence, and little else.
-- analyst  : reads the numbers, changes nothing.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'staff_role') then
    create type staff_role as enum ('owner', 'manager', 'reviewer', 'analyst');
  end if;
end
$$;

create table if not exists staff_roles (
  user_id uuid primary key references profiles (id) on delete cascade,
  role staff_role not null default 'analyst',

  -- Per-capability grants, so a role is a sensible default rather than a
  -- straitjacket. A reviewer who also chases quiet businesses can be given
  -- `can_manage_businesses` without becoming a manager.
  --
  -- There is deliberately no `can_manage_staff` column: that capability is the
  -- role `owner` and nothing else, so it cannot be granted piecemeal to an
  -- account that should not have it.
  can_review_evidence boolean not null default false,
  can_manage_businesses boolean not null default false,
  can_manage_organisations boolean not null default false,
  can_view_commercial boolean not null default false,
  can_view_audit boolean not null default false,

  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table staff_roles is
  'What each Proven staff account may do. Separate from profiles on purpose: profiles_update_self would otherwise let an account raise its own role.';

comment on column staff_roles.role is
  'owner can manage staff; the others cannot. Capability columns refine the role and never grant staff access on their own.';

alter table staff_roles enable row level security;

-- Staff read the roster; everyone reads their own row so the UI can hide what
-- they may not use. No INSERT, UPDATE or DELETE policy exists, so the table is
-- read-only to every client — writes go through the functions below.
drop policy if exists staff_roles_select_self on staff_roles;
create policy staff_roles_select_self on staff_roles
  for select using (user_id = auth.uid());

drop policy if exists staff_roles_select_admin on staff_roles;
create policy staff_roles_select_admin on staff_roles
  for select using (is_platform_admin_uncached());


-- ---------------------------------------------------------------------------
-- Who is an owner
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so it can read staff_roles regardless of the caller's own
-- policies, and `search_path` pinned so a caller cannot shadow the tables it
-- reads with their own.
create or replace function is_staff_owner(target uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_role staff_role;
begin
  select p.is_platform_admin into v_admin from profiles p where p.id = target;
  if coalesce(v_admin, false) = false then
    return false;
  end if;

  select r.role into v_role from staff_roles r where r.user_id = target;

  -- A staff account with no row yet is treated as an owner. This is what makes
  -- the migration safe to apply to a live database: the person who set up the
  -- platform keeps full access on the next request instead of locking
  -- themselves out, and `seed_staff_owner` below writes the row explicitly.
  return v_role is null or v_role = 'owner';
end;
$$;

comment on function is_staff_owner is
  'True for a Proven staff account whose role is owner, or who has no role row yet. The no-row case keeps an existing single-admin install working after this migration.';


-- ---------------------------------------------------------------------------
-- One capability check, used by the application and by policies
-- ---------------------------------------------------------------------------
create or replace function staff_can(capability text, target uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_row staff_roles%rowtype;
begin
  select p.is_platform_admin into v_admin from profiles p where p.id = target;
  if coalesce(v_admin, false) = false then
    return false;
  end if;

  select * into v_row from staff_roles where user_id = target;

  -- No row, or the owner role: everything. Same reasoning as above.
  if not found or v_row.role = 'owner' then
    return true;
  end if;

  return case capability
    when 'review_evidence'      then v_row.can_review_evidence
    when 'manage_businesses'    then v_row.can_manage_businesses
    when 'manage_organisations' then v_row.can_manage_organisations
    when 'view_commercial'      then v_row.can_view_commercial
    when 'view_audit'           then v_row.can_view_audit
    -- Managing staff is the owner role and nothing else, so it is never
    -- reachable through a capability grant.
    when 'manage_staff'         then false
    else false
  end;
end;
$$;

comment on function staff_can is
  'Whether a staff account holds one capability. Unknown capability names return false, so a typo denies rather than grants.';


-- ---------------------------------------------------------------------------
-- Writing the roster
-- ---------------------------------------------------------------------------
-- The only way staff_roles is written. Checks the caller is an owner first, so
-- a limited admin calling this directly through the API changes nothing.
create or replace function set_staff_role(
  target uuid,
  new_role staff_role,
  review_evidence boolean default false,
  manage_businesses boolean default false,
  manage_organisations boolean default false,
  view_commercial boolean default false,
  view_audit boolean default false,
  new_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff_owner() then
    raise exception 'Only a Proven owner can change staff roles.'
      using errcode = 'insufficient_privilege';
  end if;

  -- An owner must not be able to demote themselves out of the last owner seat
  -- and leave the platform with nobody who can manage staff.
  if target = auth.uid() and new_role <> 'owner' then
    raise exception 'You cannot change your own role. Ask another owner.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Being on this roster is what makes an account staff, so the flag the rest
  -- of the schema reads is set here rather than left to a separate manual step
  -- that could be forgotten.
  update profiles set is_platform_admin = true where id = target;

  insert into staff_roles as r (
    user_id, role, can_review_evidence, can_manage_businesses,
    can_manage_organisations, can_view_commercial, can_view_audit,
    note, created_by, updated_at
  )
  values (
    target, new_role, review_evidence, manage_businesses,
    manage_organisations, view_commercial, view_audit,
    coalesce(new_note, ''), auth.uid(), now()
  )
  on conflict (user_id) do update set
    role = excluded.role,
    can_review_evidence = excluded.can_review_evidence,
    can_manage_businesses = excluded.can_manage_businesses,
    can_manage_organisations = excluded.can_manage_organisations,
    can_view_commercial = excluded.can_view_commercial,
    can_view_audit = excluded.can_view_audit,
    note = excluded.note,
    updated_at = now();
end;
$$;


create or replace function remove_staff_member(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owners integer;
begin
  if not is_staff_owner() then
    raise exception 'Only a Proven owner can remove staff.'
      using errcode = 'insufficient_privilege';
  end if;

  if target = auth.uid() then
    raise exception 'You cannot remove your own staff access.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Never leave the platform with no owner. Counted from the roster plus any
  -- staff account that predates it and therefore still counts as an owner.
  select count(*) into v_owners
  from profiles p
  left join staff_roles r on r.user_id = p.id
  where p.is_platform_admin
    and (r.role is null or r.role = 'owner')
    and p.id <> target;

  if v_owners = 0 then
    raise exception 'That is the last owner. Promote someone else first.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from staff_roles where user_id = target;
  update profiles set is_platform_admin = false where id = target;
end;
$$;


-- ---------------------------------------------------------------------------
-- Seeding
-- ---------------------------------------------------------------------------
-- Writes an explicit owner row for every staff account that predates this
-- migration, so the roster shows them rather than relying forever on the
-- "no row means owner" fallback.
insert into staff_roles (
  user_id, role, can_review_evidence, can_manage_businesses,
  can_manage_organisations, can_view_commercial, can_view_audit, note
)
select p.id, 'owner', true, true, true, true, true,
       'Existing Proven staff at the time roles were introduced.'
from profiles p
where p.is_platform_admin
on conflict (user_id) do nothing;
