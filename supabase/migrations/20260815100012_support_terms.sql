-- =============================================================================
-- What the organisation is actually providing
-- =============================================================================
-- `funding_links` records an amount, entered by the ENTREPRENEUR when they ask
-- to be linked. That is a claim, not a commitment: the organisation confirms
-- the relationship but has never been able to state its own figure, and the
-- number a funder reports upward is therefore one the business typed.
--
-- It also assumes money. An incubator gives training and space; an accelerator
-- gives both on a clock. "R0" is the wrong way to record a twelve-week
-- programme, and it makes the portfolio total meaningless.
--
-- Two things follow:
--
--   1. The organisation records its OWN committed figure, separately from what
--      the business asked for. Both are kept: a gap between them is worth
--      seeing, not worth hiding.
--   2. What KIND of support this is, so a programme with no cash is recorded
--      honestly rather than as a zero.
--
-- Run after file 11. Safe to run twice.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'support_kind') then
    create type support_kind as enum (
      'grant',        -- Money, not repayable
      'loan',         -- Money, repayable
      'equity',       -- Money, for a share of the business
      'programme',    -- A place on an incubator or accelerator programme
      'mentorship',   -- Structured support, no money
      'in_kind',      -- Space, equipment, services
      'other'
    );
  end if;
end
$$;

alter table funding_links
  -- What kind of support. Defaults to 'grant' because that is what the
  -- existing rows are: money, recorded before this column existed.
  add column if not exists support_kind support_kind not null default 'grant',

  -- The organisation's OWN figure. Null until they state one, which is
  -- different from zero: "not yet recorded" and "no money involved" are not
  -- the same fact, and a portfolio total should not confuse them.
  add column if not exists committed_amount numeric(14, 2),

  -- Released so far, for support paid in tranches against stages. Null means
  -- not tracked rather than nothing released.
  add column if not exists released_amount numeric(14, 2),

  -- For a programme: how long it runs. A twelve-week accelerator and an
  -- open-ended incubation are different commitments.
  add column if not exists support_starts_on date,
  add column if not exists support_ends_on date;

-- Guarded separately: `add constraint` has no IF NOT EXISTS, so folding these
-- into the statement above would fail on a second run.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'funding_links_committed_non_negative'
  ) then
    alter table funding_links
      add constraint funding_links_committed_non_negative
      check (committed_amount is null or committed_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'funding_links_released_non_negative'
  ) then
    alter table funding_links
      add constraint funding_links_released_non_negative
      check (released_amount is null or released_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'funding_links_support_dates_ordered'
  ) then
    alter table funding_links
      add constraint funding_links_support_dates_ordered
      check (
        support_ends_on is null
        or support_starts_on is null
        or support_ends_on >= support_starts_on
      );
  end if;
end
$$;

comment on column funding_links.amount is
  'What the BUSINESS said it received when it asked to be linked. A claim, kept as stated. The organisation''s own figure is committed_amount.';

comment on column funding_links.committed_amount is
  'What the ORGANISATION says it committed. Null until they record one, which is not the same as zero: a mentorship programme legitimately has no amount.';

comment on column funding_links.released_amount is
  'Paid out so far, for support released in tranches. Null means not tracked rather than nothing released.';

comment on column funding_links.support_kind is
  'Grant, loan, equity, programme, mentorship, in-kind or other. An incubator giving a twelve-week place is not giving R0.';


-- ---------------------------------------------------------------------------
-- Carry the existing figures across
-- ---------------------------------------------------------------------------
-- Any confirmed link with an amount already on it gets that figure copied to
-- committed_amount, so nothing appears to have been lost. Guarded on
-- committed_amount still being null, which is what makes this safe to re-run.
update funding_links
   set committed_amount = amount
 where amount is not null
   and committed_amount is null;
