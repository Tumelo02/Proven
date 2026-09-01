-- Backfill missing profiles for auth users without a matching profile row
-- This can happen if the trigger was not active when they signed up, or if
-- they manually deleted their profile row.

insert into public.profiles (id, email, full_name)
select au.id, au.email, coalesce(au.raw_user_meta_data ->> 'full_name', '')
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null
on conflict (id) do nothing;
