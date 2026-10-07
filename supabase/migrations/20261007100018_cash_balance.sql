-- ---------------------------------------------------------------------------
-- What is actually in the account
-- ---------------------------------------------------------------------------
--
-- Proven has recorded what a business earned and spent each month, but never
-- what it was left holding. Those are different questions and a lender asks
-- both: a business can be profitable on paper and still have nothing in the
-- bank, which is exactly the position that kills it.
--
-- Two figures, because a bank statement carries two and they rarely agree:
--
--   closing_balance   — what the account held at the end of the month.
--   available_balance — what could actually be spent, which is lower whenever
--                       something has not cleared yet. On the MiniFridge Mate
--                       statement the closing balance is R14 827.18 and the
--                       available balance R14 797.18: a R30 difference that
--                       matters to whoever is deciding what the business can
--                       afford this week.
--
-- Both are nullable. A business that reports its figures without a statement
-- to hand has no balance to give, and a zero would be a lie rather than a
-- blank.
-- ---------------------------------------------------------------------------

alter table reporting_periods
  add column if not exists closing_balance numeric(14, 2),
  add column if not exists available_balance numeric(14, 2);

comment on column reporting_periods.closing_balance is
  'What the account held at the end of this month, from the statement. Null when the business did not report one — different from zero.';

comment on column reporting_periods.available_balance is
  'What could actually be spent at the end of this month: lower than the closing balance when something has not cleared. Null when not reported.';
