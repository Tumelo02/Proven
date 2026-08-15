-- =============================================================================
-- The audit trail
-- =============================================================================
-- `audit_log` existed from the start but only two actions ever wrote to it, and
-- nothing displayed it. A trail nobody can read is not a trail.
--
-- What this file does:
--
--   1. Adds the columns needed to answer "who, from where, and what changed",
--      not just "who and when".
--   2. Widens what gets recorded: sign-ins, consent, evidence decisions,
--      funding links, exports, and anything touching another party's data.
--   3. Makes the trail readable by Proven staff and, for their own actions,
--      by an organisation's admins.
--
-- WHAT AN AUDIT TRAIL IS FOR, and what it is not.
--
-- It answers questions AFTER something has gone wrong: which account read that
-- portfolio, when, and from what address. It does not prevent anything. It is
-- evidence, and like all evidence it is only worth keeping if it cannot be
-- quietly rewritten, which is why there is still no UPDATE or DELETE policy.
--
-- Run after file 9. Safe to run twice.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. More to record
-- ---------------------------------------------------------------------------
alter table audit_log
  -- Kept alongside actor_id, which is nullable and set to null when an account
  -- is deleted. After that the uuid alone names nobody, and "who did this" is
  -- exactly the question the trail exists to answer.
  add column if not exists actor_email text not null default '',

  -- Where from. The single most useful field when investigating access that
  -- should not have happened: one account signing in from two continents in an
  -- hour is visible here and nowhere else.
  add column if not exists ip_address text not null default '',
  add column if not exists user_agent text not null default '',

  -- How serious. Lets the admin view show what matters without reading every
  -- row: 'info' is routine, 'notice' is worth knowing, 'alert' is worth acting
  -- on today.
  add column if not exists severity text not null default 'info';

-- Added separately and guarded: `add constraint` has no IF NOT EXISTS, so
-- folding it into the statement above would fail on a second run and take the
-- rest of this file with it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audit_log_severity_valid'
  ) then
    alter table audit_log
      add constraint audit_log_severity_valid
      check (severity in ('info', 'notice', 'alert'));
  end if;
end
$$;

comment on column audit_log.actor_email is
  'The acting account''s email, copied at the time. Survives the account being deleted, because "who did this" is the question the trail exists to answer.';

comment on column audit_log.ip_address is
  'Where the request came from. The most useful field when investigating access that should not have happened.';

comment on column audit_log.severity is
  'info, notice or alert. Lets the admin view surface what matters without reading every row.';

create index if not exists audit_log_severity_idx
  on audit_log (severity, created_at desc);

create index if not exists audit_log_created_idx
  on audit_log (created_at desc);


-- ---------------------------------------------------------------------------
-- 2. Who can read it
-- ---------------------------------------------------------------------------
-- Proven staff read everything, which is the point.
--
-- An organisation's ADMINS read rows tagged with their own org. That matters:
-- if a funder's staff member exports a portfolio they should not have, the
-- funder's own admin can see it without asking us. A member cannot: being able
-- to read the trail is itself a privilege.
--
-- An entrepreneur reads nothing here. Their own consent history is on their
-- privacy page; this table records staff and funder actions.
drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log
  for select using (
    is_platform_admin_uncached()
    or (org_id is not null and org_id in (select my_admin_org_ids()))
  );

-- Unchanged: you may only write a row as yourself.
drop policy if exists audit_log_insert on audit_log;
create policy audit_log_insert on audit_log
  for insert with check (actor_id = (select auth.uid()));

-- Still no UPDATE and no DELETE policy, deliberately. An actor who can edit
-- their own trail has no trail. Not even Proven staff can alter it through
-- these rules.


-- ---------------------------------------------------------------------------
-- 3. Reading the trail
-- ---------------------------------------------------------------------------
-- One row per event with the names already resolved, so the admin view is a
-- plain select rather than three joins repeated in application code.
create or replace view audit_trail as
  select
    a.id,
    a.created_at,
    a.severity,
    a.action,
    a.entity_type,
    a.entity_id,
    a.detail,
    a.actor_id,
    /* Falls back to the stored email once a profile is gone. */
    coalesce(nullif(p.full_name, ''), nullif(a.actor_email, ''), 'Deleted account') as actor_name,
    coalesce(nullif(a.actor_email, ''), p.email, '') as actor_email,
    a.org_id,
    o.name as org_name,
    a.ip_address,
    a.user_agent
  from audit_log a
  left join profiles p on p.id = a.actor_id
  left join organisations o on o.id = a.org_id;

comment on view audit_trail is
  'audit_log with actor and organisation names resolved. A view rather than a repeated join, so every reader sees the same shape.';

-- A view runs with the privileges of the querying user by default in recent
-- Postgres, so the policies on `audit_log` still apply through it. Stated
-- explicitly so an upgrade cannot silently change that.
alter view audit_trail set (security_invoker = true);

grant select on audit_trail to authenticated;
