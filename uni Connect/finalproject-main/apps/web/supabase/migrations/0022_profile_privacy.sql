-- 0022: profile privacy enforced by the database, not just the UI (part 1 of 2)
-- Until now approved members could select every column of public.profiles, so the
-- visibility settings applied by profile_cards could be bypassed by querying the table
-- directly (bio, interests, year, suspension reason, last seen…). Other people now get only
-- the columns every screen shows anyway; the rest comes through:
--   my_profile()                 your own full row (session, settings)
--   profile_visible_details(id)  bio, interests, expertise and year, blanked by the owner's
--                                visibility settings (used by profile_cards)
-- This part only adds those and switches the readers over; 0023 removes the column access
-- once the app no longer reads those columns directly.

create or replace function public.my_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.profiles where id = (select auth.uid());
$$;

create or replace function public.profile_visible_details(p_user_id uuid)
returns table (year_of_study smallint, bio text, interests text[], expertise text[])
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    case when vis.full and p.show_year then p.year_of_study end,
    case when vis.full then p.bio end,
    case when vis.full then p.interests else '{}'::text[] end,
    case when vis.full then p.expertise else '{}'::text[] end
  from public.profiles p
  cross join lateral (
    select (
      p.id = (select auth.uid())
      or p.profile_visibility = 'everyone'
      or (p.profile_visibility = 'department'
          and p.department_id is not null
          and p.department_id = (select cp.department_id from public.current_profile() cp))
    ) as full
  ) vis
  where p.id = p_user_id
    -- the same rows profiles' RLS shows the caller
    and (p.id = (select auth.uid())
         or (public.is_approved() and p.status = 'approved')
         or public.has_role('admin'));
$$;

revoke execute on function public.my_profile() from public, anon;
revoke execute on function public.profile_visible_details(uuid) from public, anon;
grant execute on function public.my_profile() to authenticated;
grant execute on function public.profile_visible_details(uuid) to authenticated;

-- Same columns as before (0003); the optional ones now come from the definer helper.
create or replace view public.profile_cards
with (security_invoker = true) as
select
  p.id,
  p.full_name,
  p.username::text as username,
  p.avatar_url,
  p.role,
  p.department_id,
  d.name as department_name,
  x.year_of_study,
  x.bio,
  x.interests,
  x.expertise,
  p.profile_visibility,
  p.created_at
from public.profiles p
left join public.departments d on d.id = p.department_id
left join lateral public.profile_visible_details(p.id) x on true;

-- Functions that read the caller's own year or approval date go through my_profile().
create or replace function public.announcement_for_me(a public.announcements)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce((
    select public.audience_includes(a.audience_all, a.audience_department_ids, a.audience_years,
                                    p.department_id, p.year_of_study)
    from public.my_profile() p
  ), false);
$$;

create or replace function public.unread_announcement_count()
returns int
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.announcements a
  where a.status = 'published'
    and a.publisher_id is distinct from (select auth.uid())
    and a.published_at > greatest(
      now() - interval '30 days',
      coalesce((select p.approved_at from public.my_profile() p), now())
    )
    and public.announcement_for_me(a)
    and not exists (
      select 1 from public.announcement_reads r where r.announcement_id = a.id and r.user_id = (select auth.uid())
    );
$$;
