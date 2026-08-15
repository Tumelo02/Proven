-- =============================================================================
-- Access control: grants, then row-level security
-- =============================================================================
-- TWO LAYERS, BOTH REQUIRED. This is the single most confusing thing about
-- Postgres access control and the source of the longest bug in this project's
-- history, so it is stated first:
--
--   GRANT   decides whether a role may touch the table at all.
--   POLICY  decides which rows it then sees.
--
-- With policies but no grant, every query fails with "permission denied for
-- table X". Nothing about that looks like a policy problem. Worse, Supabase's
-- SQL editor runs as `postgres`, which owns these tables and bypasses both
-- layers, so every row is plainly visible there while the application sees
-- none of them.
--
-- Access follows three rules, in order:
--   1. An entrepreneur reads and writes their own businesses.
--   2. An organisation reads businesses it has a CONFIRMED funding link to.
--      Read-only: a funder never edits an entrepreneur's figures.
--   3. Proven staff read everything, and are the only party who can mark
--      evidence verified.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Grants
-- ---------------------------------------------------------------------------
-- Deliberately broad, because the policies below are the real control: they
-- already say who may read and write what, per row. A grant without policies
-- would be dangerous; policies without a grant are merely useless.
--
-- `service_role` is included on purpose. It bypasses row-level *security*,
-- which is a different layer from table *privileges*, so without a grant it is
-- refused at the door exactly like anyone else.
--
-- `anon` gets SELECT only. Every policy requires `auth.uid()`, so in practice
-- it reads nothing: this lets the sign-in flow query without erroring rather
-- than opening anything up.
grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- The same for anything added later, so a new table cannot repeat the bug.
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 2. Row-level security, on every table
-- ---------------------------------------------------------------------------
alter table profiles          enable row level security;
alter table organisations     enable row level security;
alter table memberships       enable row level security;
alter table businesses        enable row level security;
alter table funding_links     enable row level security;
alter table reporting_periods enable row level security;
alter table transactions      enable row level security;
alter table documents         enable row level security;
alter table milestones        enable row level security;
alter table score_snapshots   enable row level security;
alter table audit_log         enable row level security;


-- ---------------------------------------------------------------------------
-- 3. Helper functions
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, so they can read membership tables the calling user's own
-- policies would otherwise restrict. `search_path` is pinned so the body
-- cannot be redirected by a caller-supplied path.
--
-- LANGUAGE PLPGSQL, NOT SQL, and that matters: Postgres may INLINE a `language
-- sql` function into the calling query, and an inlined body loses its SECURITY
-- DEFINER boundary. When that happened to the admin check, which reads
-- `profiles`, the SELECT policy on `profiles` ended up referring to `profiles`
-- and reading your own profile failed. PL/pgSQL is never inlined.

create or replace function is_platform_admin_uncached()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_flag boolean;
begin
  if v_uid is null then
    return false;
  end if;

  select p.is_platform_admin into v_flag
    from public.profiles p
   where p.id = v_uid;

  return coalesce(v_flag, false);
end;
$$;

create or replace function is_platform_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return is_platform_admin_uncached();
end;
$$;

/* Organisations the current user belongs to, in any role. */
create or replace function my_org_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query select m.org_id from public.memberships m where m.user_id = auth.uid();
end;
$$;

/* Organisations the current user administers. */
create or replace function my_admin_org_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select m.org_id from public.memberships m
     where m.user_id = auth.uid() and m.role = 'admin';
end;
$$;

/* True when the user may read this business: they own it, one of their
   organisations has a confirmed link to it, or they are Proven staff. */
create or replace function can_read_business(target_business_id uuid)
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
    or exists (
      select 1 from public.funding_links fl
       where fl.business_id = target_business_id
         and fl.status = 'confirmed'
         and fl.org_id in (select my_org_ids())
    );
end;
$$;

/* True only for the owner. Funders never write an entrepreneur's figures: the
   evidence has to be the business's own, or it proves nothing. */
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
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- 4. profiles
-- ---------------------------------------------------------------------------
-- Split in two on purpose. Reading your own row must not depend on a function
-- that reads `profiles`, or the policy guards the table it consults. The
-- self-read is therefore a plain column comparison with no function call in
-- it, and the cross-tenant admin read is a separate policy. Postgres ORs
-- permissive policies together, so the pair means what one combined
-- expression would have meant, without the interlock.
create policy profiles_select_self on profiles
  for select using (id = (select auth.uid()));

create policy profiles_select_admin on profiles
  for select using (is_platform_admin_uncached());

create policy profiles_update_self on profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No INSERT policy: profiles are created by the `handle_new_user` trigger,
-- which bypasses RLS by being SECURITY DEFINER. A plain insert from anywhere
-- else is filtered out and reports success having written nothing.


-- ---------------------------------------------------------------------------
-- 5. organisations
-- ---------------------------------------------------------------------------
-- Every signed-in user may read the list: a business has to be able to find
-- its funder by name in order to request a link. Only name and slug live here,
-- so this exposes nothing about any organisation's portfolio.
create policy organisations_select_all on organisations
  for select to authenticated using (true);

create policy organisations_update_admin on organisations
  for update using (id in (select my_admin_org_ids()))
  with check (id in (select my_admin_org_ids()));


-- ---------------------------------------------------------------------------
-- 6. memberships
-- ---------------------------------------------------------------------------
create policy memberships_select on memberships
  for select using (
    user_id = (select auth.uid())
    or org_id in (select my_org_ids())
    or is_platform_admin_uncached()
  );

create policy memberships_insert_admin on memberships
  for insert with check (org_id in (select my_admin_org_ids()));

create policy memberships_update_admin on memberships
  for update using (org_id in (select my_admin_org_ids()))
  with check (org_id in (select my_admin_org_ids()));

create policy memberships_delete_admin on memberships
  for delete using (org_id in (select my_admin_org_ids()));


-- ---------------------------------------------------------------------------
-- 7. businesses
-- ---------------------------------------------------------------------------
create policy businesses_select on businesses
  for select using (can_read_business(id));

-- Anyone signed in may enrol a business, funded or not. The owner is forced to
-- be the current user, so a business cannot be created in someone else's name.
create policy businesses_insert_own on businesses
  for insert with check (owner_id = (select auth.uid()));

create policy businesses_update_own on businesses
  for update using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy businesses_delete_own on businesses
  for delete using (owner_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- 8. funding_links
-- ---------------------------------------------------------------------------
create policy funding_links_select on funding_links
  for select using (
    owns_business(business_id)
    or org_id in (select my_org_ids())
    or is_platform_admin_uncached()
  );

-- Either side may propose a link: a business applying, or an organisation
-- inviting a business it already funds.
create policy funding_links_insert on funding_links
  for insert with check (
    requested_by = (select auth.uid())
    and (owns_business(business_id) or org_id in (select my_org_ids()))
  );

-- Confirming is the organisation's decision, so only its members may update
-- the row. A business cannot confirm its own link and appear on a funder's
-- portfolio uninvited.
create policy funding_links_update_org on funding_links
  for update using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));

-- A business may withdraw its own request, but only while still pending.
create policy funding_links_delete on funding_links
  for delete using (
    (owns_business(business_id) and status = 'pending')
    or org_id in (select my_admin_org_ids())
  );


-- ---------------------------------------------------------------------------
-- 9. reporting_periods, transactions, milestones
-- ---------------------------------------------------------------------------
-- Same shape for all three: readable by owner, linked funder and Proven staff;
-- writable by the owner alone.

create policy reporting_periods_select on reporting_periods
  for select using (can_read_business(business_id));
create policy reporting_periods_insert_own on reporting_periods
  for insert with check (owns_business(business_id));
create policy reporting_periods_update_own on reporting_periods
  for update using (owns_business(business_id))
  with check (owns_business(business_id));
create policy reporting_periods_delete_own on reporting_periods
  for delete using (owns_business(business_id));

create policy transactions_select on transactions
  for select using (can_read_business(business_id));
create policy transactions_insert_own on transactions
  for insert with check (owns_business(business_id));
create policy transactions_update_own on transactions
  for update using (owns_business(business_id))
  with check (owns_business(business_id));
create policy transactions_delete_own on transactions
  for delete using (owns_business(business_id));

create policy milestones_select on milestones
  for select using (can_read_business(business_id));
create policy milestones_insert_own on milestones
  for insert with check (owns_business(business_id));
create policy milestones_update_own on milestones
  for update using (owns_business(business_id))
  with check (owns_business(business_id));
create policy milestones_delete_own on milestones
  for delete using (owns_business(business_id));


-- ---------------------------------------------------------------------------
-- 10. documents
-- ---------------------------------------------------------------------------
-- Reached through the parent transaction, so access follows that business.
create policy documents_select on documents
  for select using (
    exists (
      select 1 from transactions t
       where t.id = documents.transaction_id and can_read_business(t.business_id)
    )
  );

create policy documents_insert_own on documents
  for insert with check (
    exists (
      select 1 from transactions t
       where t.id = documents.transaction_id and owns_business(t.business_id)
    )
  );

create policy documents_delete_own on documents
  for delete using (
    exists (
      select 1 from transactions t
       where t.id = documents.transaction_id and owns_business(t.business_id)
    )
  );

-- Review is Proven staff only, and who holds this matters more than it first
-- appears:
--
--   The business    No. Marking your own receipt verified is the whole thing
--                   the review column exists to prevent.
--
--   Its funder      No. A funder has an interest in the answer: an optimistic
--                   verification flatters a portfolio it reports on. It is
--                   also the party the evidence is meant to convince, and a
--                   claim checked only by the person being persuaded is not
--                   independent.
--
--   Proven staff    Yes. Neutral in the outcome, and the party whose name is
--                   on the claim that evidence was checked.
create policy documents_update_platform_admin on documents
  for update
  using (is_platform_admin_uncached())
  with check (is_platform_admin_uncached());


-- ---------------------------------------------------------------------------
-- 11. score_snapshots
-- ---------------------------------------------------------------------------
-- Read-only to everyone. Snapshots are written by the server with the service
-- role after recomputation, so a score can never be edited into existence.
create policy score_snapshots_select on score_snapshots
  for select using (can_read_business(business_id));


-- ---------------------------------------------------------------------------
-- 12. audit_log
-- ---------------------------------------------------------------------------
-- Visible to an organisation for its own entries, and to Proven staff. An
-- actor must not be able to edit their own trail, so there is no UPDATE or
-- DELETE policy at all.
create policy audit_log_select on audit_log
  for select using (
    is_platform_admin_uncached()
    or (org_id is not null and org_id in (select my_admin_org_ids()))
  );

create policy audit_log_insert on audit_log
  for insert with check (actor_id = (select auth.uid()));
