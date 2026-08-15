-- =============================================================================
-- The organisation profile
-- =============================================================================
-- An organisation was two fields, `name` and `slug`, which is thinner than the
-- businesses it funds. Three things follow from that:
--
--   1. An entrepreneur choosing their funder sees a bare name, and after the
--      link is confirmed still sees no mark of who now reads their figures.
--      For a platform whose premise is consent, that is a hole.
--   2. A funder sending an exported report to their own board cannot put their
--      own mark on it.
--   3. Nothing records WHAT kind of organisation this is. Funders, incubators
--      and accelerators do the same four things in different vocabulary, and
--      storing the type is what lets one product serve all three.
--
-- Deliberately small: six fields. A bank has its registration details on its
-- own letterhead and will not fill them in here.
--
-- IMPORTANT, on visibility. `organisations_select_all` lets any authenticated
-- user read this table, which is right for a name and a logo, since a business
-- must be able to find its funder before any link exists. It is NOT right for
-- a named contact's direct line. The contact columns are therefore split into
-- a separate table with its own rule.
--
-- Run after file 8. Safe to run twice.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. What kind of organisation this is
-- ---------------------------------------------------------------------------
-- Vocabulary differs by type: an incubator runs a "programme", a funder makes
-- a "grant" or a "loan". Storing the type lets one product read correctly to
-- all of them instead of forcing everyone into a funder's words.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'org_type') then
    create type org_type as enum (
      'funder',       -- Bank, fund, grant-maker: gives money
      'incubator',    -- Gives training, space, mentorship
      'accelerator',  -- Both, on a fixed programme clock
      'government',   -- Department or agency
      'other'
    );
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- 2. Public identity
-- ---------------------------------------------------------------------------
-- Readable by any signed-in user, on purpose: a business has to recognise its
-- funder in a list before there is any relationship to authorise it.
alter table organisations
  add column if not exists org_type org_type not null default 'funder',

  -- Path in the `logos` bucket, keyed `org/<org_id>/<file>`. The `org/` prefix
  -- keeps organisation logos in their own namespace so the business-logo
  -- policies, which read the first path segment as a business id, can never
  -- match them.
  add column if not exists logo_path text,

  add column if not exists tagline text not null default '',
  add column if not exists website text not null default '',
  add column if not exists province text not null default '';

comment on column organisations.logo_path is
  'Object path in the private `logos` bucket, always under the `org/` prefix so it cannot collide with a business logo path.';

comment on column organisations.org_type is
  'Funder, incubator, accelerator or government. Drives vocabulary, not permissions: every type has the same powers.';


-- ---------------------------------------------------------------------------
-- 3. Contact details, held separately
-- ---------------------------------------------------------------------------
-- A named person's email and direct line is personal information under POPIA,
-- and `organisations` is world-readable to signed-in users. Putting a contact
-- there would publish a staff member's details to every entrepreneur on the
-- platform, including ones with no relationship to that organisation.
--
-- So: its own table, readable only by that organisation's own members and by
-- the businesses it has a CONFIRMED link to. An entrepreneur gets their
-- funder's contact once the funder has agreed to the relationship, and not
-- before.
create table if not exists org_contacts (
  org_id uuid primary key references organisations (id) on delete cascade,
  contact_name text not null default '',
  contact_role text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  updated_at timestamptz not null default now()
);

comment on table org_contacts is
  'Who to speak to at an organisation. Separate from `organisations` because that table is readable by every signed-in user, and a named person''s direct line is not public information.';

alter table org_contacts enable row level security;

-- Own members, Proven staff, and any business with a confirmed link.
drop policy if exists org_contacts_select on org_contacts;
create policy org_contacts_select on org_contacts
  for select using (
    is_platform_admin_uncached()
    or org_id in (select my_org_ids())
    or exists (
      select 1
        from funding_links fl
        join businesses b on b.id = fl.business_id
       where fl.org_id = org_contacts.org_id
         and fl.status = 'confirmed'
         and b.owner_id = (select auth.uid())
    )
  );

-- Only an organisation ADMIN writes it. A member reading the portfolio should
-- not be able to change the details their entrepreneurs are given.
drop policy if exists org_contacts_insert on org_contacts;
create policy org_contacts_insert on org_contacts
  for insert with check (org_id in (select my_admin_org_ids()));

drop policy if exists org_contacts_update on org_contacts;
create policy org_contacts_update on org_contacts
  for update using (org_id in (select my_admin_org_ids()))
  with check (org_id in (select my_admin_org_ids()));

grant select, insert, update on org_contacts to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Logo storage for organisations
-- ---------------------------------------------------------------------------
-- FIRST, the existing business-logo policies have to be made safe.
--
-- They cast the first path segment straight to uuid. Once an object exists at
-- `org/<id>/<file>`, that cast is `'org'::uuid`, which does not return false,
-- it RAISES, and a raise inside a policy fails the whole query. Adding
-- organisation logos without this guard would break logo reads for every
-- business on the platform.
--
-- The added test short-circuits on the prefix before any cast is attempted.
drop policy if exists logos_select on storage.objects;
create policy logos_select on storage.objects
  for select using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] <> 'org'
    and can_read_business(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists logos_insert_own on storage.objects;
create policy logos_insert_own on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] <> 'org'
    and owns_business(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists logos_update_own on storage.objects;
create policy logos_update_own on storage.objects
  for update using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] <> 'org'
    and owns_business(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists logos_delete_own on storage.objects;
create policy logos_delete_own on storage.objects
  for delete using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] <> 'org'
    and owns_business(((storage.foldername(name))[1])::uuid)
  );

-- Now the organisation rules, matched on the `org/` prefix.
--
-- Readable by anyone signed in, for the same reason the name is: a business
-- picking its funder from a list should see the mark it recognises.
drop policy if exists logos_org_select on storage.objects;
create policy logos_org_select on storage.objects
  for select to authenticated using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = 'org'
  );

-- Written only by an admin of the organisation the path names.
drop policy if exists logos_org_write on storage.objects;
create policy logos_org_write on storage.objects
  for insert to authenticated with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = 'org'
    and ((storage.foldername(name))[2])::uuid in (select my_admin_org_ids())
  );

drop policy if exists logos_org_delete on storage.objects;
create policy logos_org_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = 'org'
    and ((storage.foldername(name))[2])::uuid in (select my_admin_org_ids())
  );
