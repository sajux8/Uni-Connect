-- 0019: when a whole account is deleted, its mentor profile and requests go with it, so
-- there's nothing to decline or announce (and a notification naming the deleted account
-- as its actor would fail the foreign key).

create or replace function public.mentor_profile_removed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mentees uuid[];
begin
  if not exists (select 1 from public.profiles where id = old.user_id) then
    return null;
  end if;
  with declined as (
    update public.mentorship_requests
    set status = 'declined', responded_at = now(),
        response_note = 'This mentor stopped taking requests.'
    where mentor_id = old.user_id and status = 'pending'
    returning mentee_id
  )
  select coalesce(array_agg(mentee_id), '{}') into v_mentees from declined;
  perform public.notify(v_mentees, 'mentorship_declined',
                        public.display_name(old.user_id) || ' stopped taking mentorship requests',
                        'Your request was closed. You can ask another mentor.',
                        '/mentors', old.user_id, 'mentor', old.user_id);
  return null;
end;
$$;
revoke execute on function public.mentor_profile_removed() from public, anon, authenticated;
