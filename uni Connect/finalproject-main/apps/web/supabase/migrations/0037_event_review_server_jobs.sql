-- 0037: trusted server jobs (the service role, with no signed-in user) can create and edit events
-- anywhere without the placement check or the review step (0035), e.g. seed data and tests.

create or replace function public.route_event_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.space_id is distinct from old.space_id)
     and not public.can_place_event_in(new.space_id) then
    raise exception 'You can''t put an event there' using errcode = '42501';
  end if;
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status <> 'published')
     and not public.can_review_event_space(new.space_id) then
    new.status := 'pending_review';
    new.review_note := null;
  end if;
  return new;
end;
$$;
