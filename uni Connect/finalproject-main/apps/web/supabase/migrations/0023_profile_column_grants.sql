-- 0023: profile privacy, part 2 (see 0022). Other people's optional profile fields are only
-- readable through profile_cards / profile_visible_details(), your own through my_profile().
-- Column-level read access for signed-in users (RLS still decides which rows).
revoke select on public.profiles from authenticated;
grant select (
  id, full_name, username, avatar_url, role, status, requested_role, department_id,
  profile_visibility, onboarding_completed, created_at, updated_at
) on public.profiles to authenticated;
