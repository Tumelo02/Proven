-- =============================================================================
-- Auth wiring, business defaults, and file storage
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A profile row for every new user
-- ---------------------------------------------------------------------------
-- Created by trigger rather than by the client, so a user can never exist in
-- `auth.users` without the profile the rest of the schema points at, and can
-- never set `is_platform_admin` on the way in.
--
-- The exception handler is not defensive habit: this runs INSIDE Supabase
-- Auth's own transaction, so anything raised here fails the whole
-- authentication request with "Database error querying schema", a message that
-- names the schema when the cause is this trigger. Creating a profile matters,
-- but not enough to lock a real person out of their account.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ---------------------------------------------------------------------------
-- Keep the profile email in step with the authentication record
-- ---------------------------------------------------------------------------
create or replace function handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
exception
  when others then
    /* Same reasoning as above: never fail an authentication request over a
       bookkeeping update. */
    return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function handle_user_email_change();


-- ---------------------------------------------------------------------------
-- The four-stage journey, created with every business
-- ---------------------------------------------------------------------------
-- Every business starts at the same four stages the prototype shows, so the
-- milestone view is never empty and the stage names stay consistent across
-- the platform.
create or replace function seed_default_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.milestones (business_id, label, status, sort_order)
  values
    (new.id, 'Getting set up',        'current', 1),
    (new.id, 'Open and trading',      'pending', 2),
    (new.id, 'Growing the business',  'pending', 3),
    (new.id, 'Standing on its own',   'pending', 4);
  return new;
end;
$$;

create trigger on_business_created
  after insert on businesses
  for each row execute function seed_default_milestones();


-- ---------------------------------------------------------------------------
-- Confirming a funding link stamps who and when
-- ---------------------------------------------------------------------------
-- A CHECK constraint requires `confirmed_by` and `confirmed_at` on a confirmed
-- row; this fills them in from the session so the client cannot claim someone
-- else confirmed it.
create or replace function stamp_funding_link_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    new.confirmed_by := auth.uid();
    new.confirmed_at := now();
  end if;

  -- A business is `funded` exactly when it has a confirmed link, so the two
  -- can never disagree on screen.
  if new.status = 'confirmed' then
    update public.businesses
      set funding_status = 'funded'
      where id = new.business_id and funding_status <> 'exited';
  end if;

  return new;
end;
$$;

create trigger on_funding_link_confirmed
  before update on funding_links
  for each row execute function stamp_funding_link_confirmation();


-- ---------------------------------------------------------------------------
-- Storage: receipts and invoices
-- ---------------------------------------------------------------------------
-- Private bucket. Files are served through signed URLs, never public links, so
-- a receipt cannot be read by anyone who happens to have the path.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proofs',
  'proofs',
  false,
  10485760, -- 10 MB: a photographed receipt, not a video
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

-- Objects are keyed `<business_id>/<uuid>-<filename>`. That first path segment
-- is not decoration: these policies read it to decide access, so a file cannot
-- be written into another business's folder even by a crafted request.
create policy proofs_select on storage.objects
  for select using (
    bucket_id = 'proofs'
    and can_read_business(((storage.foldername(name))[1])::uuid)
  );

create policy proofs_insert_own on storage.objects
  for insert with check (
    bucket_id = 'proofs'
    and owns_business(((storage.foldername(name))[1])::uuid)
  );

create policy proofs_delete_own on storage.objects
  for delete using (
    bucket_id = 'proofs'
    and owns_business(((storage.foldername(name))[1])::uuid)
  );
