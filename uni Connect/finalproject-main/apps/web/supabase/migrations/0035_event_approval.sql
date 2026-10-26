-- 0035: event approval and placement (Phase C).
--
-- * Any approved member can create an event and place it in their batch, their department, a club
--   they belong to, or (super admins) campus-wide. space_id is the placement; null means campus-wide.
-- * Publishing an event you can't approve yourself sends it for review instead: club events to the
--   club captain, batch and department events to the department's coordinator, everything else to
--   the super admins. Reviewers approve or reject with a reason through review_event().
-- * Events placed in a batch or department are only visible there.

alter table public.events
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text check (review_note is null or char_length(review_note) <= 500);

-- Who approves events placed in this space (null = campus-wide).
create or replace function public.can_review_event_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('super_admin')
      or (p_space_id is not null and public.is_approved() and exists (
            select 1 from public.spaces s
            where s.id = p_space_id
              and (
                (s.type in ('department', 'batch') and public.manages_department(s.department_id))
                or (s.type = 'club' and (
                      public.manages_department(s.department_id)
                      or exists (select 1 from public.space_members m
                                 where m.space_id = s.id and m.user_id = auth.uid()
                                   and m.role = 'captain' and m.status = 'active')))
              )));
$$;

-- Where this member may place an event: their department or batch spaces (or ones they look after),
-- clubs they belong to. Campus-wide and general spaces are for super admins.
create or replace function public.can_place_event_in(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('super_admin')
      or (p_space_id is not null and public.is_approved() and exists (
            select 1 from public.spaces s
            where s.id = p_space_id and not s.is_archived
              and (
                (s.type in ('department', 'batch') and public.can_view_space(s.id))
                or (s.type = 'club' and (
                      public.can_review_event_space(s.id)
                      or exists (select 1 from public.space_members m
                                 where m.space_id = s.id and m.user_id = auth.uid() and m.status = 'active')))
              )));
$$;

-- Runs before prepare_event (trigger names fire in order): publishing without the right to approve
-- turns into a request for review.
create or replace function public.route_event_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
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
create trigger events_a_route_review
  before insert or update of status, space_id on public.events
  for each row execute function public.route_event_review();

-- Tell the reviewers when an event waits for them.
create or replace function public.notify_event_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_space     public.spaces%rowtype;
  v_reviewers uuid[];
begin
  if new.status <> 'pending_review' or (tg_op = 'UPDATE' and old.status = 'pending_review') then
    return null;
  end if;
  select * into v_space from public.spaces where id = new.space_id;

  if v_space.type = 'club' then
    select coalesce(array_agg(m.user_id), '{}') into v_reviewers
    from public.space_members m
    where m.space_id = v_space.id and m.role = 'captain' and m.status = 'active';
  end if;
  if coalesce(cardinality(v_reviewers), 0) = 0 and v_space.type in ('department', 'batch', 'club') then
    select coalesce(array_agg(p.id), '{}') into v_reviewers
    from public.profiles p
    where p.role = 'coordinator' and p.status = 'approved' and p.department_id = v_space.department_id;
  end if;
  if coalesce(cardinality(v_reviewers), 0) = 0 then
    select coalesce(array_agg(p.id), '{}') into v_reviewers
    from public.profiles p where p.role = 'super_admin' and p.status = 'approved';
  end if;

  perform public.notify(v_reviewers, 'event_submitted',
                        public.display_name(new.organizer_id) || ' submitted an event for approval',
                        new.title || coalesce(' · ' || v_space.name, ' · campus-wide'),
                        '/events/review', new.organizer_id, 'event', new.id);
  return null;
end;
$$;
create trigger events_notify_review
  after insert or update of status on public.events
  for each row execute function public.notify_event_review();

-- Approve (publishes the event) or reject (with a reason the organizer sees).
create or replace function public.review_event(p_event_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if not public.can_review_event_space(v_event.space_id) then
    raise exception 'You can''t review this event' using errcode = '42501';
  end if;
  if v_event.status <> 'pending_review' then
    raise exception 'This event isn''t waiting for approval' using errcode = '22023';
  end if;
  if not p_approve and v_note is null then
    raise exception 'Give the organizer a reason' using errcode = '22023';
  end if;

  update public.events
  set status      = case when p_approve then 'published' else 'rejected' end::public.event_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = left(v_note, 500)
  where id = p_event_id;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason, metadata)
  values (auth.uid(), case when p_approve then 'approve_event' else 'reject_event' end::public.moderation_action_type,
          'event', p_event_id, v_note, jsonb_build_object('title', v_event.title));

  perform public.notify(array[v_event.organizer_id], 'event_reviewed',
                        case when p_approve then 'Your event is published: ' || v_event.title
                             else 'Your event wasn''t approved: ' || v_event.title end,
                        v_note, '/events/' || p_event_id, auth.uid(), 'event', p_event_id);
end;
$$;

-- Notification types (delivery defaults; labels in lib/notifications.ts).
insert into public.notification_types (type, in_app_default, email_default, email_available, locked, sort_order)
values ('event_submitted', true, false, true, false, 76),
       ('event_reviewed', true, true, true, false, 77)
on conflict (type) do nothing;

-- Who manages an event: its organizer and super admins.
create or replace function public.can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('super_admin')
      or exists (select 1 from public.events e where e.id = p_event_id and e.organizer_id = auth.uid());
$$;

-- Policies: anyone approved can create events where they may place them; published events are seen
-- only by people who can see their space; reviewers see what waits for them.
drop policy events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (
    organizer_id = (select auth.uid())
    and (select public.is_approved())
    and public.can_place_event_in(space_id)
  );

drop policy events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (
    (select public.is_approved())
    and (
      (status in ('published', 'cancelled') and (space_id is null or public.can_view_space(space_id)))
      or organizer_id = (select auth.uid())
      or (status = 'pending_review' and public.can_review_event_space(space_id))
      or (select public.has_role('super_admin'))
    )
  );

drop policy events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (
    (organizer_id = (select auth.uid()) and (select public.is_approved()))
    or (select public.has_role('super_admin'))
  )
  with check (
    (organizer_id = (select auth.uid()) and (select public.is_approved()))
    or (select public.has_role('super_admin'))
  );

drop policy events_delete on public.events;
create policy events_delete on public.events for delete to authenticated
  using (
    (select public.has_role('super_admin'))
    or (organizer_id = (select auth.uid()) and published_at is null)
  );

-- Anyone who can create an event can upload its cover.
drop policy event_covers_insert on storage.objects;
create policy event_covers_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_approved())
  );

-- Registration: only published events the member can see.
create or replace function public.register_for_event(p_event_id uuid)
returns table (status public.registration_status, waitlist_position integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_user     uuid := auth.uid();
  v_event    public.events%rowtype;
  v_existing public.event_registrations%rowtype;
  v_taken    int;
  v_status   public.registration_status;
  v_position int;
begin
  if not public.is_approved() then
    raise exception 'Only approved members can register' using errcode = '42501';
  end if;
  -- Lock the event so two people can't take the last seat at once.
  select * into v_event from public.events e where e.id = p_event_id for update;
  if v_event.id is null or v_event.status in ('draft', 'pending_review', 'rejected')
     or (v_event.space_id is not null and not public.can_view_space(v_event.space_id)) then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if v_event.status = 'cancelled' then
    raise exception 'This event has been cancelled' using errcode = '22023';
  end if;
  if now() >= coalesce(v_event.registration_deadline, v_event.starts_at) then
    raise exception 'Registration for this event has closed' using errcode = '22023';
  end if;
  if not public.event_eligible(p_event_id, v_user) then
    raise exception 'This event isn''t open to your department or year' using errcode = '42501';
  end if;

  select * into v_existing from public.event_registrations r where r.event_id = p_event_id and r.user_id = v_user;
  if v_existing.status in ('registered', 'waitlisted') then
    return query select v_existing.status, v_existing.waitlist_position;
    return;
  end if;

  select count(*) into v_taken from public.event_registrations r
  where r.event_id = p_event_id and r.status = 'registered';
  if v_event.capacity is null or v_taken < v_event.capacity then
    v_status := 'registered';
  elsif v_event.waitlist_enabled then
    v_status := 'waitlisted';
    select coalesce(max(r.waitlist_position), 0) + 1 into v_position from public.event_registrations r
    where r.event_id = p_event_id and r.status = 'waitlisted';
  else
    raise exception 'This event is full' using errcode = '22023';
  end if;

  insert into public.event_registrations as r (event_id, user_id, status, waitlist_position, registered_at)
  values (p_event_id, v_user, v_status, v_position, now())
  on conflict (event_id, user_id) do update
    set status = excluded.status, waitlist_position = excluded.waitlist_position,
        registered_at = now(), cancelled_at = null, reminder_24h_sent = false, reminder_1h_sent = false;

  perform public.notify(
    array[v_user],
    case when v_status = 'registered' then 'event_registered' else 'event_waitlisted' end,
    case when v_status = 'registered' then 'You''re registered for ' || v_event.title
         else 'You''re #' || v_position || ' on the waitlist for ' || v_event.title end,
    public.campus_time_label(v_event.starts_at) || coalesce(' · ' || v_event.venue, ''),
    '/events/' || p_event_id, null, 'event', p_event_id);

  return query select v_status, v_position;
end;
$$;

grant select (reviewed_by, reviewed_at, review_note) on public.events to authenticated;

revoke all on function public.can_review_event_space(uuid) from public, anon;
revoke all on function public.can_place_event_in(uuid) from public, anon;
revoke all on function public.review_event(uuid, boolean, text) from public, anon;
grant execute on function public.can_review_event_space(uuid), public.can_place_event_in(uuid),
  public.review_event(uuid, boolean, text) to authenticated;
revoke all on function public.route_event_review() from public, anon, authenticated;
revoke all on function public.notify_event_review() from public, anon, authenticated;

-- Existing events without a space were published by staff for everyone: keep them campus-wide.
