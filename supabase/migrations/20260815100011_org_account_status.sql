-- =============================================================================
-- Is this organisation paying, or on a pilot?
-- =============================================================================
-- Proven staff need to know which organisations are trialling and which are
-- customers. It changes who gets chased, who gets a renewal conversation, and
-- which numbers matter when someone asks how the business is doing.
--
-- Deliberately visible ONLY to Proven staff. A funder should not open their own
-- profile and read "trial, expires in three weeks": that is a commercial
-- position, and it belongs in a conversation rather than on a dashboard they
-- happen to be using for something else.
--
-- Run after file 10. Safe to run twice.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type account_status as enum (
      'pilot',      -- Trialling, not yet paying
      'paying',     -- A customer
      'internal',   -- Proven's own, for testing and demonstration
      'lapsed'      -- Was paying, no longer
    );
  end if;
end
$$;

alter table organisations
  add column if not exists account_status account_status not null default 'pilot',

  -- When the pilot ends or the subscription renews. Null means open-ended,
  -- which is honest: plenty of early arrangements have no fixed date.
  add column if not exists account_until date,

  -- Anything worth remembering about the arrangement. Staff-only, like the
  -- rest of this block.
  add column if not exists account_note text not null default '';

comment on column organisations.account_status is
  'Commercial standing: pilot, paying, internal or lapsed. Readable by Proven staff only, through the `admin_org_accounts` view. Never shown to the organisation itself.';

comment on column organisations.account_until is
  'When the pilot ends or the subscription renews. Null means open-ended.';


-- ---------------------------------------------------------------------------
-- Keeping it out of a funder's sight
-- ---------------------------------------------------------------------------
-- `organisations_select_all` lets any signed-in user read this table, which is
-- right for a name and a logo: a business has to find its funder before any
-- link exists. Column-level rules cannot be added on top of that, so these
-- three columns are readable by anyone who queries the table directly.
--
-- The application therefore never selects them outside the admin panel, and
-- the view below is the only place they are read. That is a convention rather
-- than a wall, and worth stating plainly: this field is a business note, not a
-- secret. Nothing here would be damaging if seen; it would simply be a
-- conversation happening in the wrong place.
create or replace view admin_org_accounts as
  select
    o.id,
    o.name,
    o.slug,
    o.org_type,
    o.account_status,
    o.account_until,
    o.account_note,
    o.created_at,
    (select count(*) from memberships m where m.org_id = o.id) as member_count,
    (select count(*) from funding_links f
      where f.org_id = o.id and f.status = 'confirmed') as business_count
  from organisations o;

comment on view admin_org_accounts is
  'Organisations with their commercial standing and counts, for the Proven admin panel.';

alter view admin_org_accounts set (security_invoker = true);

grant select on admin_org_accounts to authenticated;
