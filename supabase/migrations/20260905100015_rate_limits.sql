-- Rate limiting, backed by Postgres rather than a separate Redis service.
--
-- This has to work before we know who the user is (a sign-in attempt against
-- an email that may not exist at all), so it is keyed by a caller-supplied
-- string (ip:action or email:action), not by profile id like audit_log is.
--
-- A row per (key, window) with an atomic increment-or-insert, so concurrent
-- requests from the same key cannot both read "0 attempts" and both proceed.

create table public.rate_limits (
  id bigint generated always as identity primary key,
  rate_key text not null,
  -- Truncated to the start of its window on write, so all attempts in the
  -- same window collapse onto one row instead of one per request.
  window_start timestamptz not null,
  attempts integer not null default 1,
  created_at timestamptz not null default now(),
  unique (rate_key, window_start)
);

create index rate_limits_key_idx on public.rate_limits (rate_key, window_start desc);

-- Old windows are cheap to accumulate but serve no purpose once expired.
-- Deleted opportunistically by the check function rather than a cron job,
-- so there is nothing extra to schedule.
create index rate_limits_created_idx on public.rate_limits (created_at);

comment on table public.rate_limits is
  'Sliding-window rate limiting for unauthenticated actions (sign-in, sign-up, password reset) where the caller is not yet a known profile.';

-- Row-level security stays on, but nothing needs direct table access: all
-- reads and writes go through check_rate_limit below, which runs as the
-- function owner regardless of who calls it.
alter table public.rate_limits enable row level security;

-- Returns true if the call is allowed, false if the limit is already hit.
-- window_seconds truncation buckets requests into fixed windows (simple and
-- sufficient here) rather than a true sliding log, which would need a row per
-- request instead of per window.
create or replace function public.check_rate_limit(
  p_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_attempts integer;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into rate_limits (rate_key, window_start, attempts)
  values (p_key, v_window_start, 1)
  on conflict (rate_key, window_start)
  do update set attempts = rate_limits.attempts + 1
  returning attempts into v_attempts;

  -- Opportunistic cleanup: only runs on a fraction of calls, so it never
  -- adds latency to the common path.
  if random() < 0.01 then
    delete from rate_limits where created_at < now() - interval '1 day';
  end if;

  return v_attempts <= p_max_attempts;
end;
$$;

comment on function public.check_rate_limit is
  'Increments the attempt count for rate_key in the current window and returns whether it is still within p_max_attempts. Call once per attempt, including the one that ultimately succeeds.';

-- Callable by both anon (someone not yet signed in, attempting sign-in) and
-- authenticated (an already-signed-in user hitting a limited action).
grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated;
