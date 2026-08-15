-- =============================================================================
-- Demo data for presentations
-- =============================================================================
-- The three businesses from the prototype, as real rows with real sign-in
-- accounts, so the live platform can be demonstrated using the same figures
-- and the same scores the pitch already uses.
--
-- Months are fixed, January to June 2025, rather than relative to today, so the
-- scores never drift: Nandi is Healthy (94.2), Soweto is on Watch (72.5), Zola
-- is At Risk (41.1), every single time. A test in `packages/engine/` reads this
-- file and checks all three, so an accidental edit fails the build rather than
-- surprising anyone on stage.
--
-- OPTIONAL. Skip this file for a clean installation.
--
-- SAFE TO RE-RUN. It deletes the demo accounts and their data first, so running
-- it twice leaves one clean copy rather than duplicates.
--
-- NOT FOR PRODUCTION. These are shared accounts with a published password.
-- Before a real deployment, delete them:
--   delete from auth.users where email like '%@demo.proven.co.za';
--   delete from organisations where slug = 'ayef-demo';
-- =============================================================================

do $seed$
declare
  v_org uuid;
  v_funder uuid;
  v_owner uuid;
  v_biz uuid;
  v_period uuid;
  v_email text;
  v_uid uuid;
  v_col text;
  v_cols text[];
  v_pwd text := extensions.crypt('proven2026', extensions.gen_salt('bf'));
begin
  -- ---------------------------------------------------------------------------
  -- Clear any previous run
  -- ---------------------------------------------------------------------------
  -- Businesses first: deleting them cascades to their figures, transactions,
  -- milestones and funding links. Doing it before the accounts keeps the
  -- deletion order explicit rather than relying on what cascades from where.
  delete from businesses
   where owner_id in (
     select id from profiles where email like '%@demo.proven.co.za'
   );

  delete from auth.users where email like '%@demo.proven.co.za';
  delete from organisations where slug = 'ayef-demo';

  -- ---------------------------------------------------------------------------
  -- The funding organisation
  -- ---------------------------------------------------------------------------
  insert into organisations (name, slug)
  values ('Absa Youth Entrepreneurship Fund', 'ayef-demo')
  returning id into v_org;

  -- ---------------------------------------------------------------------------
  -- Demo accounts
  -- ---------------------------------------------------------------------------
  -- Written straight into `auth.users`: there is no sign-up form to drive from
  -- SQL. Every account shares one password so the credentials fit on a slide.
  -- `email_confirmed_at` is set, so these work whether or not email
  -- confirmation is switched on for the project.
  foreach v_email in array array[
    'funder@demo.proven.co.za',
    'nandi-beauty@demo.proven.co.za',
    'soweto-bakery@demo.proven.co.za',
    'zola-deliveries@demo.proven.co.za'
  ]
  loop
    v_uid := gen_random_uuid();

    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      v_uid, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', v_email, v_pwd,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', case v_email
        when 'funder@demo.proven.co.za'        then 'Thandi Nkosi'
        when 'nandi-beauty@demo.proven.co.za'  then 'Nandi Mahlangu'
        when 'soweto-bakery@demo.proven.co.za' then 'Palesa Dlamini'
        else 'Zola Mokoena' end)
    );

    -- Every email account also needs an identity row. Sign-up creates one
    -- automatically; an account written by SQL does not get one, and password
    -- sign-in fails without it even though the password hash is correct.
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text, 'email',
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );
  end loop;

  -- ---------------------------------------------------------------------------
  -- Every nullable text column on auth.users must hold '' rather than NULL
  -- ---------------------------------------------------------------------------
  -- Supabase Auth reads these into plain Go strings. A NULL in any one of them
  -- breaks every sign-in with "Database error querying schema", a message that
  -- blames the schema when the cause is the row.
  --
  -- Driven off the catalogue rather than a hand-written list: the exact set of
  -- token columns differs between Supabase versions, and naming them by hand
  -- means silently missing whichever one was added most recently.
  select coalesce(array_agg(column_name::text), array[]::text[])
    into v_cols
    from information_schema.columns
   where table_schema = 'auth'
     and table_name = 'users'
     and data_type in ('text', 'character varying')
     and is_nullable = 'YES'
     -- These carry real values; blanking them would break the account.
     and column_name not in ('email', 'phone', 'encrypted_password');

  foreach v_col in array v_cols
  loop
    execute format(
      'update auth.users set %I = %L where %I is null and email like %L',
      v_col, '', v_col, '%@demo.proven.co.za'
    );
  end loop;

  -- The funder runs the organisation.
  select id into v_funder from profiles where email = 'funder@demo.proven.co.za';
  insert into memberships (user_id, org_id, role) values (v_funder, v_org, 'admin');

  -- ---------------------------------------------------------------------------
  -- Nandi Beauty Studio: healthy. Growing sales, costs under control, never
  -- a late update. Scores 94.2, Credit-Ready Candidate.
  -- ---------------------------------------------------------------------------
  select id into v_owner from profiles where email = 'nandi-beauty@demo.proven.co.za';

  insert into businesses (owner_id, name, industry, region, funding_status, started_on, staff_count, team_roles)
  values (v_owner, 'Nandi Beauty Studio', 'Beauty & Wellness', 'Tembisa, GP', 'funded', '2024-03-01', 3, 'Two stylists and a receptionist')
  returning id into v_biz;

  insert into funding_links (business_id, org_id, status, requested_by, confirmed_by, confirmed_at, amount, funded_on, terms)
  values (v_biz, v_org, 'confirmed', v_owner, v_funder, now(), 150000, '2024-03-01', 'Youth enterprise grant');

  insert into reporting_periods (business_id, period_month, revenue, expenses, customers, status, submitted_at) values
    (v_biz, '2025-01-01', 48000, 27500, 145, 'on-time', '2025-01-01'::timestamptz),
    (v_biz, '2025-02-01', 49800, 28100, 150, 'on-time', '2025-02-01'::timestamptz),
    (v_biz, '2025-03-01', 51700, 28700, 155, 'on-time', '2025-03-01'::timestamptz),
    (v_biz, '2025-04-01', 53700, 29400, 161, 'on-time', '2025-04-01'::timestamptz),
    (v_biz, '2025-05-01', 55700, 30000, 166, 'on-time', '2025-05-01'::timestamptz),
    (v_biz, '2025-06-01', 57800, 30700, 172, 'on-time', '2025-06-01'::timestamptz);

  -- The four stages arrive by trigger; set them to this business's progress.
  update milestones set status = 'done'    where business_id = v_biz and sort_order = 1;
  update milestones set status = 'done'    where business_id = v_biz and sort_order = 2;
  update milestones set status = 'done'    where business_id = v_biz and sort_order = 3;
  update milestones set status = 'current' where business_id = v_biz and sort_order = 4;

  -- The latest month's entries, so guidance can name a real largest cost.
  select id into v_period from reporting_periods where business_id = v_biz and period_month = '2025-06-01';
  insert into transactions (business_id, period_id, type, description, category, amount, occurred_on) values
    (v_biz, v_period, 'revenue', 'Salon takings for the month', 'Sales', 57800, '2025-06-13'),
    (v_biz, v_period, 'expense', 'Hair products and colour stock', 'Stock & Inventory', 10440, '2025-06-16'),
    (v_biz, v_period, 'expense', 'Assistant stylist wages', 'Wages', 9210, '2025-06-19'),
    (v_biz, v_period, 'expense', 'Salon rent', 'Rent', 6750, '2025-06-22'),
    (v_biz, v_period, 'expense', 'Electricity and water', 'Utilities', 2460, '2025-06-25'),
    (v_biz, v_period, 'expense', 'Instagram promotion', 'Marketing', 1840, '2025-06-28');

  -- ---------------------------------------------------------------------------
  -- Soweto Sunrise Bakery: on watch. Sales growing slowly, costs rising
  -- faster, one late update. Scores 72.5, Strong Evidence.
  -- ---------------------------------------------------------------------------
  select id into v_owner from profiles where email = 'soweto-bakery@demo.proven.co.za';

  insert into businesses (owner_id, name, industry, region, funding_status, started_on, staff_count, team_roles)
  values (v_owner, 'Soweto Sunrise Bakery', 'Food & Beverage', 'Soweto, GP', 'funded', '2024-08-01', 4, 'A baker, two counter staff and a driver')
  returning id into v_biz;

  insert into funding_links (business_id, org_id, status, requested_by, confirmed_by, confirmed_at, amount, funded_on, terms)
  values (v_biz, v_org, 'confirmed', v_owner, v_funder, now(), 120000, '2024-08-01', 'Youth enterprise grant');

  insert into reporting_periods (business_id, period_month, revenue, expenses, customers, status, submitted_at) values
    (v_biz, '2025-01-01', 36000, 24500, 160, 'on-time', '2025-01-01'::timestamptz),
    (v_biz, '2025-02-01', 36400, 25200, 161, 'on-time', '2025-02-01'::timestamptz),
    (v_biz, '2025-03-01', 36900, 26000, 163, 'on-time', '2025-03-01'::timestamptz),
    (v_biz, '2025-04-01', 37300, 26800, 164, 'late',    '2025-04-01'::timestamptz),
    (v_biz, '2025-05-01', 37800, 27600, 166, 'on-time', '2025-05-01'::timestamptz),
    (v_biz, '2025-06-01', 38200, 28400, 167, 'on-time', '2025-06-01'::timestamptz);

  update milestones set status = 'done'    where business_id = v_biz and sort_order = 1;
  update milestones set status = 'done'    where business_id = v_biz and sort_order = 2;
  update milestones set status = 'current' where business_id = v_biz and sort_order = 3;
  update milestones set status = 'pending' where business_id = v_biz and sort_order = 4;

  select id into v_period from reporting_periods where business_id = v_biz and period_month = '2025-06-01';
  insert into transactions (business_id, period_id, type, description, category, amount, occurred_on) values
    (v_biz, v_period, 'revenue', 'Bread and cake sales', 'Sales', 38200, '2025-06-13'),
    (v_biz, v_period, 'expense', 'Flour, sugar and yeast', 'Stock & Inventory', 10790, '2025-06-16'),
    (v_biz, v_period, 'expense', 'Baker and counter staff', 'Wages', 7670, '2025-06-19'),
    (v_biz, v_period, 'expense', 'Shop rent', 'Rent', 5110, '2025-06-22'),
    (v_biz, v_period, 'expense', 'Gas for the ovens', 'Utilities', 3120, '2025-06-25'),
    (v_biz, v_period, 'expense', 'Delivery fuel', 'Transport', 1700, '2025-06-28');

  -- ---------------------------------------------------------------------------
  -- Zola Deliveries: at risk. Sales falling, spending more than it earns, a
  -- delayed stage and a missed update. Scores 41.1, Building Track Record.
  -- ---------------------------------------------------------------------------
  select id into v_owner from profiles where email = 'zola-deliveries@demo.proven.co.za';

  insert into businesses (owner_id, name, industry, region, funding_status, started_on, staff_count, team_roles)
  values (v_owner, 'Zola Deliveries', 'Transport', 'Pretoria, GP', 'funded', '2025-01-01', 2, 'Two drivers')
  returning id into v_biz;

  insert into funding_links (business_id, org_id, status, requested_by, confirmed_by, confirmed_at, amount, funded_on, terms)
  values (v_biz, v_org, 'confirmed', v_owner, v_funder, now(), 100000, '2025-01-01', 'Youth enterprise grant');

  -- The missed June update has no `submitted_at`, because it never arrived.
  insert into reporting_periods (business_id, period_month, revenue, expenses, customers, status, submitted_at) values
    (v_biz, '2025-01-01', 32000, 26500, 95, 'on-time', '2025-01-01'::timestamptz),
    (v_biz, '2025-02-01', 31400, 27200, 93, 'late',    '2025-02-01'::timestamptz),
    (v_biz, '2025-03-01', 30900, 27900, 92, 'on-time', '2025-03-01'::timestamptz),
    (v_biz, '2025-04-01', 30300, 28600, 91, 'on-time', '2025-04-01'::timestamptz),
    (v_biz, '2025-05-01', 29800, 29400, 89, 'late',    '2025-05-01'::timestamptz),
    (v_biz, '2025-06-01', 29200, 30100, 88, 'missed',  null);

  update milestones set status = 'done'    where business_id = v_biz and sort_order = 1;
  update milestones set status = 'delayed' where business_id = v_biz and sort_order = 2;
  update milestones set status = 'pending' where business_id = v_biz and sort_order = 3;
  update milestones set status = 'pending' where business_id = v_biz and sort_order = 4;

  select id into v_period from reporting_periods where business_id = v_biz and period_month = '2025-06-01';
  insert into transactions (business_id, period_id, type, description, category, amount, occurred_on) values
    (v_biz, v_period, 'revenue', 'Delivery fees collected', 'Sales', 29200, '2025-06-13'),
    (v_biz, v_period, 'expense', 'Petrol for the bakkie', 'Transport', 10840, '2025-06-16'),
    (v_biz, v_period, 'expense', 'Driver wages', 'Wages', 9030, '2025-06-19'),
    (v_biz, v_period, 'expense', 'Vehicle service and repairs', 'Transport', 5420, '2025-06-22'),
    (v_biz, v_period, 'expense', 'Insurance premium', 'Other', 3010, '2025-06-25'),
    (v_biz, v_period, 'expense', 'Airtime and data', 'Utilities', 1810, '2025-06-28');

end
$seed$;
