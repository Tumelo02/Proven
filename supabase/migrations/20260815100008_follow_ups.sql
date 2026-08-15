-- =============================================================================
-- Follow-ups: what the funder did about a flagged business
-- =============================================================================
-- A funder can see everything and record nothing. When they call an
-- entrepreneur about a bad month, that fact lives in their head or their inbox,
-- so the next person to open the record cannot tell whether the problem has
-- been dealt with or ignored.
--
-- This is deliberately NOT a judgement about the business. It is the
-- organisation's own note about its own work, which is why it hangs off the
-- funding link rather than off the business: two funders of the same business
-- each keep their own record, and neither sees the other's.
--
-- Run after file 7. Safe to run twice.
-- =============================================================================

create table if not exists follow_ups (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  -- Who did it. Historical, like the funding-link columns: the record has to
  -- outlive the staff member leaving, so no foreign key.
  actor_id uuid not null,
  -- What they did, in their own words. Optional: the common case is simply
  -- "I have dealt with this", and demanding a sentence would stop it being
  -- recorded at all.
  note text not null default '',
  -- The score at the moment of the follow-up, so a later reader can see what
  -- the funder was reacting to rather than what is true today.
  score_at numeric(5, 2),
  created_at timestamptz not null default now()
);

create index if not exists follow_ups_business_idx
  on follow_ups (business_id, org_id, created_at desc);

comment on table follow_ups is
  'An organisation''s own record of acting on a flagged business. Never visible to the entrepreneur, and never to another funder: this is the funder''s working note, not a judgement added to the business''s record.';


-- ---------------------------------------------------------------------------
-- Access rules
-- ---------------------------------------------------------------------------
-- Readable and writable only by members of the organisation that made it.
-- Deliberately NOT readable by the business it concerns: an entrepreneur
-- reading "called her, seems evasive" would poison the very candour that makes
-- the note worth keeping. What the funder tells the entrepreneur is a
-- conversation, not a database row.
alter table follow_ups enable row level security;

drop policy if exists follow_ups_select on follow_ups;
create policy follow_ups_select on follow_ups
  for select using (
    is_platform_admin_uncached()
    or org_id in (select my_org_ids())
  );

drop policy if exists follow_ups_insert on follow_ups;
create policy follow_ups_insert on follow_ups
  for insert with check (
    actor_id = (select auth.uid())
    and org_id in (select my_org_ids())
  );

-- Deleting your own note is allowed, editing it is not: a working record that
-- can be quietly rewritten is worth less than one that can only be added to.
drop policy if exists follow_ups_delete on follow_ups;
create policy follow_ups_delete on follow_ups
  for delete using (
    actor_id = (select auth.uid())
    and org_id in (select my_org_ids())
  );

grant select, insert, delete on follow_ups to authenticated;
