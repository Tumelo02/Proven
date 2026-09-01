-- Ensure an entrepreneur can read a business immediately after creating it.
-- This is separate from the cross-tenant helper policy because INSERT ...
-- RETURNING evaluates SELECT visibility on the returned row.

drop policy if exists businesses_select_own on public.businesses;
create policy businesses_select_own on public.businesses
  for select to authenticated
  using (owner_id = auth.uid());

alter table public.businesses
  add column if not exists access_disabled boolean not null default false,
  add column if not exists access_disabled_reason text not null default '';

comment on column public.businesses.access_disabled is
  'Proven staff can suspend access for this business and its owner without deleting the record.';
comment on column public.businesses.access_disabled_reason is
  'Internal reason recorded when access is suspended.';
