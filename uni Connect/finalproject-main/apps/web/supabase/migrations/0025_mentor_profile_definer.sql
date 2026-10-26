-- 0025: prepare_mentor_profile checks the mentor's year of study, which signed-in users can
-- no longer select from profiles (0023). Run the trigger as its owner instead.
alter function public.prepare_mentor_profile() security definer;
revoke execute on function public.prepare_mentor_profile() from public, anon, authenticated;
