-- 0014: events, registrations, waitlists, change log and reminders
-- Published and cancelled events are
-- visible to every approved member; drafts to their organizer and admins. Registering and
-- cancelling go through SECURITY DEFINER RPCs that lock the event row, so capacity is never
-- exceeded. Changes to a published event's time, place or deadline are logged in
-- event_changes and sent to everyone registered or waitlisted.

-- Tables -------------------------------------------------------------------------------

create table public.events (
  id                         uuid primary key default gen_random_uuid(),
  organizer_id               uuid references public.profiles (id) on delete set null,
  organizing_unit            text not null check (char_length(organizing_unit) between 2 and 60),
  title                      text not null check (char_length(title) between 5 and 150),
  description_html           text not null check (char_length(description_html) <= 40000),
  description_text           text not null check (char_length(description_text) between 1 and 20000),
  category                   public.event_category not null default 'other',
  format                     public.event_format not null default 'in_person',
  venue                      text check (char_length(venue) <= 120),
  location_details           text check (char_length(location_details) <= 200),
  online_url                 text check (char_length(online_url) <= 500 and online_url ~ '^https://'),
  starts_at                  timestamptz not null,
  ends_at                    timestamptz not null,
  registration_deadline      timestamptz,
  capacity                   int check (capacity between 1 and 10000),
  waitlist_enabled           boolean not null default true,
  eligibility_department_ids uuid[] not null default '{}' check (cardinality(eligibility_department_ids) <= 20),
  eligibility_years          smallint[] not null default '{}'
                               check (eligibility_years <@ array[0, 1, 2, 3, 4, 5]::smallint[]),
  eligibility_note           text check (char_length(eligibility_note) <= 200),
  cover_url                  text check (char_length(cover_url) <= 500),
  space_id                   uuid references public.spaces (id) on delete set null,
  status                     public.event_status not null default 'draft',
  cancel_reason              text check (char_length(cancel_reason) <= 500),
  published_at               timestamptz,
  cancelled_at               timestamptz,
  registered_count           int not null default 0,
  waitlist_count             int not null default 0,
  tsv                        tsvector generated always as (
                               setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
                               setweight(to_tsvector('english'::regconfig, coalesce(description_text, '')), 'B') ||
                               setweight(to_tsvector('english'::regconfig, coalesce(venue, '')), 'C')
                             ) stored,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  check (ends_at > starts_at),
  check (registration_deadline is null or registration_deadline <= starts_at),
  check (format = 'online' or venue is not null),
  check (format = 'in_person' or online_url is not null),
  check (status <> 'cancelled' or cancel_reason is not null)
);
create index events_status_start_idx on public.events (status, starts_at);
create index events_organizer_idx on public.events (organizer_id);
create index events_space_idx on public.events (space_id);
create index events_tsv_idx on public.events using gin (tsv);
create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_registrations (
  event_id          uuid not null references public.events (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  status            public.registration_status not null,
  waitlist_position int check (waitlist_position > 0),
  registered_at     timestamptz not null default now(),
  cancelled_at      timestamptz,
  reminder_24h_sent boolean not null default false,
  reminder_1h_sent  boolean not null default false,
  primary key (event_id, user_id),
  check ((status = 'waitlisted') = (waitlist_position is not null))
);
create index event_registrations_user_idx on public.event_registrations (user_id, status);
create index event_registrations_waitlist_idx on public.event_registrations (event_id, status, waitlist_position);

create table public.event_changes (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  changed_by uuid references public.profiles (id) on delete set null,
  summary    text not null check (char_length(summary) <= 500),
  changes    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index event_changes_event_idx on public.event_changes (event_id, created_at desc);
create index event_changes_changed_by_idx on public.event_changes (changed_by);

-- New notification types (delivery defaults; labels in src/lib/notifications.ts).
-- Type names may now contain digits ("event_reminder_24h").
alter table public.notification_types drop constraint notification_types_type_check;
alter table public.notification_types add constraint notification_types_type_check check (type ~ '^[a-z0-9_]{3,40}$');
insert into public.notification_types (type, in_app_default, email_default, email_available, locked, sort_order) values
  ('event_registered',   true, false, false, false, 70),
  ('event_waitlisted',   true, false, false, false, 71),
  ('waitlist_promoted',  true, true,  true,  false, 72),
  ('event_reminder_24h', true, true,  true,  false, 73),
  ('event_reminder_1h',  true, false, false, false, 74),
  ('event_updated',      true, true,  true,  false, 75),
  ('event_cancelled',    true, true,  true,  false, 76);

-- Helpers --------------------------------------------------------------------------------

-- Can this user register? Empty department and year lists mean "everyone"; otherwise
-- departments AND years must match (same rule as announcement audiences).
create or replace function public.event_eligible(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select public.audience_includes(false, e.eligibility_department_ids, e.eligibility_years,
                                    p.department_id, p.year_of_study)
    from public.events e, public.profiles p
    where e.id = p_event_id and p.id = p_user_id
  ), false);
$$;

create or replace function public.can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('admin')
      or exists (select 1 from public.events e
                 where e.id = p_event_id and e.organizer_id = auth.uid() and public.has_role('organizer', 'admin'));
$$;

-- Campus-time label used in notification text, e.g. "Tue 14 Oct, 10:00".
create or replace function public.campus_time_label(p_at timestamptz)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select to_char(p_at at time zone 'Asia/Colombo', 'Dy DD Mon, HH24:MI');
$$;

revoke execute on function public.event_eligible(uuid, uuid) from public, anon;
revoke execute on function public.can_manage_event(uuid) from public, anon;
grant execute on function public.event_eligible(uuid, uuid) to authenticated;
grant execute on function public.can_manage_event(uuid) to authenticated;

-- Counters and waitlist ------------------------------------------------------------------

create or replace function public.update_event_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.events e
  set registered_count = (select count(*) from public.event_registrations r where r.event_id = e.id and r.status = 'registered'),
      waitlist_count   = (select count(*) from public.event_registrations r where r.event_id = e.id and r.status = 'waitlisted')
  where e.id = coalesce(new.event_id, old.event_id);
  return null;
end;
$$;
create trigger event_registrations_counts after insert or update of status or delete on public.event_registrations
  for each row execute function public.update_event_counts();

-- Waitlist positions as 1..n in their current order.
create or replace function public.renumber_waitlist(p_event_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.event_registrations r
  set waitlist_position = n.position
  from (
    select user_id, row_number() over (order by waitlist_position, registered_at)::int as position
    from public.event_registrations
    where event_id = p_event_id and status = 'waitlisted'
  ) n
  where r.event_id = p_event_id and r.user_id = n.user_id and r.waitlist_position is distinct from n.position;
$$;

-- Fill free seats from the front of the waitlist (after a cancellation or a bigger capacity).
create or replace function public.promote_waitlist(p_event_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event    public.events%rowtype;
  v_user     uuid;
  v_promoted int := 0;
begin
  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null or v_event.status <> 'published' or v_event.starts_at <= now() then
    return 0;
  end if;

  loop
    exit when v_event.capacity is not null
      and (select count(*) from public.event_registrations
           where event_id = p_event_id and status = 'registered') >= v_event.capacity;
    select user_id into v_user from public.event_registrations
    where event_id = p_event_id and status = 'waitlisted'
    order by waitlist_position
    limit 1;
    exit when v_user is null;

    update public.event_registrations
    set status = 'registered', waitlist_position = null, registered_at = now()
    where event_id = p_event_id and user_id = v_user;
    v_promoted := v_promoted + 1;

    perform public.notify(
      array[v_user], 'waitlist_promoted', 'You have a place at ' || v_event.title,
      'A seat opened up, so you''re now registered. ' || public.campus_time_label(v_event.starts_at)
        || coalesce(' · ' || v_event.venue, ''),
      '/events/' || p_event_id, null, 'event', p_event_id, true,
      jsonb_build_object('when', public.campus_time_label(v_event.starts_at), 'where', v_event.venue));
    v_user := null;
  end loop;

  perform public.renumber_waitlist(p_event_id);
  return v_promoted;
end;
$$;

-- Registration RPCs ------------------------------------------------------------------------

create or replace function public.register_for_event(p_event_id uuid)
returns table (status public.registration_status, waitlist_position int)
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
  if v_event.id is null or v_event.status = 'draft' then
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

create or replace function public.cancel_registration(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user  uuid := auth.uid();
  v_event public.events%rowtype;
begin
  select * into v_event from public.events e where e.id = p_event_id for update;
  if v_event.id is null then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if v_event.starts_at <= now() then
    raise exception 'This event has already started' using errcode = '22023';
  end if;

  update public.event_registrations r
  set status = 'cancelled', waitlist_position = null, cancelled_at = now()
  where r.event_id = p_event_id and r.user_id = v_user and r.status in ('registered', 'waitlisted');
  if not found then
    raise exception 'You''re not registered for this event' using errcode = 'P0002';
  end if;

  perform public.promote_waitlist(p_event_id);
end;
$$;

-- Attendee list for the organizer (names, department, year: needed to run the event;
-- no email, phone or student ID).
create or replace function public.event_attendees(p_event_id uuid)
returns table (
  user_id uuid,
  full_name text,
  username text,
  department_name text,
  year_of_study smallint,
  status public.registration_status,
  waitlist_position int,
  registered_at timestamptz,
  cancelled_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not public.can_manage_event(p_event_id) then
    raise exception 'Only the organizer can see the attendee list' using errcode = '42501';
  end if;
  return query
    select r.user_id, p.full_name, p.username::text, d.name, p.year_of_study, r.status,
           r.waitlist_position, r.registered_at, r.cancelled_at
    from public.event_registrations r
    join public.profiles p on p.id = r.user_id
    left join public.departments d on d.id = p.department_id
    where r.event_id = p_event_id
    order by case r.status when 'registered' then 0 when 'waitlisted' then 1 else 2 end,
             r.waitlist_position nulls first, r.registered_at;
end;
$$;

revoke execute on function public.update_event_counts() from public, anon, authenticated;
revoke execute on function public.renumber_waitlist(uuid) from public, anon, authenticated;
revoke execute on function public.promote_waitlist(uuid) from public, anon, authenticated;
revoke execute on function public.register_for_event(uuid) from public, anon;
revoke execute on function public.cancel_registration(uuid) from public, anon;
revoke execute on function public.event_attendees(uuid) from public, anon;
grant execute on function public.register_for_event(uuid) to authenticated;
grant execute on function public.cancel_registration(uuid) to authenticated;
grant execute on function public.event_attendees(uuid) to authenticated;

-- Lifecycle: publish, changes, cancellation, capacity --------------------------------------

create or replace function public.prepare_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  if new.status = 'cancelled' and (tg_op = 'INSERT' or old.status <> 'cancelled') then
    new.cancelled_at := now();
  end if;
  if new.format = 'online' then
    new.venue := null;
    new.location_details := null;
  elsif new.format = 'in_person' then
    new.online_url := null;
  end if;
  return new;
end;
$$;
create trigger events_prepare before insert or update on public.events
  for each row execute function public.prepare_event();

-- Log what changed on a published event and tell everyone registered or waitlisted.
create or replace function public.log_event_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parts      text[] := '{}';
  v_changes    jsonb := '{}';
  v_summary    text;
  v_recipients uuid[];
  v_type       text;
  v_title      text;
begin
  if old.status = 'draft' then
    return null; -- nobody could register yet
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    v_type := 'event_cancelled';
    v_summary := 'Event cancelled: ' || new.cancel_reason;
    v_changes := jsonb_build_object('status', jsonb_build_object('from', old.status, 'to', new.status));
    v_title := 'Cancelled: ' || new.title;
  elsif new.status = 'published' and old.status = 'published' then
    if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
      v_parts := v_parts || ('Time changed to ' || public.campus_time_label(new.starts_at) || '–'
                             || to_char(new.ends_at at time zone 'Asia/Colombo', 'HH24:MI'));
      v_changes := v_changes || jsonb_build_object('time', jsonb_build_object(
        'from', jsonb_build_array(old.starts_at, old.ends_at), 'to', jsonb_build_array(new.starts_at, new.ends_at)));
    end if;
    if new.format is distinct from old.format then
      v_parts := v_parts || ('Now ' || replace(new.format::text, '_', ' '));
      v_changes := v_changes || jsonb_build_object('format', jsonb_build_object('from', old.format, 'to', new.format));
    end if;
    if new.venue is distinct from old.venue and new.venue is not null then
      v_parts := v_parts || ('Venue changed to ' || new.venue);
      v_changes := v_changes || jsonb_build_object('venue', jsonb_build_object('from', old.venue, 'to', new.venue));
    end if;
    if new.location_details is distinct from old.location_details and new.location_details is not null then
      v_parts := v_parts || 'Location details updated'::text;
      v_changes := v_changes || jsonb_build_object('location_details', jsonb_build_object('from', old.location_details, 'to', new.location_details));
    end if;
    if new.online_url is distinct from old.online_url and new.online_url is not null then
      v_parts := v_parts || 'Online link updated'::text;
      v_changes := v_changes || jsonb_build_object('online_url', jsonb_build_object('from', old.online_url, 'to', new.online_url));
    end if;
    if new.registration_deadline is distinct from old.registration_deadline then
      v_parts := v_parts || ('Registration now closes ' || public.campus_time_label(coalesce(new.registration_deadline, new.starts_at)));
      v_changes := v_changes || jsonb_build_object('registration_deadline', jsonb_build_object('from', old.registration_deadline, 'to', new.registration_deadline));
    end if;
    if cardinality(v_parts) = 0 then
      return null;
    end if;
    v_type := 'event_updated';
    v_summary := array_to_string(v_parts, ' · ');
    v_title := 'Updated: ' || new.title;
  else
    return null;
  end if;

  insert into public.event_changes (event_id, changed_by, summary, changes)
  values (new.id, auth.uid(), left(v_summary, 500), v_changes);

  select coalesce(array_agg(r.user_id), '{}') into v_recipients
  from public.event_registrations r
  where r.event_id = new.id and r.status in ('registered', 'waitlisted');

  perform public.notify(
    v_recipients, v_type, v_title, left(v_summary, 400), '/events/' || new.id, auth.uid(), 'event', new.id, true,
    jsonb_build_object('event_title', new.title, 'when', public.campus_time_label(new.starts_at), 'where', new.venue));
  return null;
end;
$$;
create trigger events_log_changes after update on public.events
  for each row execute function public.log_event_changes();

-- More seats (or none) → move people up from the waitlist.
create or replace function public.event_capacity_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.promote_waitlist(new.id);
  return null;
end;
$$;
create trigger events_capacity_changed after update of capacity, waitlist_enabled on public.events
  for each row when (new.capacity is null or old.capacity is null or new.capacity > old.capacity)
  execute function public.event_capacity_changed();

-- Organizers can't cut capacity below the people already registered.
create or replace function public.check_event_capacity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.capacity is not null and new.capacity < new.registered_count then
    raise exception '% people are already registered. Capacity can''t be lower than that.', new.registered_count
      using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger events_check_capacity before update of capacity on public.events
  for each row execute function public.check_event_capacity();

revoke execute on function public.prepare_event() from public, anon, authenticated;
revoke execute on function public.log_event_changes() from public, anon, authenticated;
revoke execute on function public.event_capacity_changed() from public, anon, authenticated;
revoke execute on function public.check_event_capacity() from public, anon, authenticated;

-- Reminders (scheduled every 10 minutes below) ---------------------------------------------

create or replace function public.enqueue_event_reminders()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_users uuid[];
  v_total int := 0;
begin
  -- 1 hour before (also marks the 24h one so nobody gets both late).
  for v_event in
    select e.* from public.events e
    where e.status = 'published' and e.starts_at > now() and e.starts_at <= now() + interval '1 hour'
      and exists (select 1 from public.event_registrations r
                  where r.event_id = e.id and r.status = 'registered' and not r.reminder_1h_sent)
  loop
    with marked as (
      update public.event_registrations r set reminder_1h_sent = true, reminder_24h_sent = true
      where r.event_id = v_event.id and r.status = 'registered' and not r.reminder_1h_sent
      returning r.user_id
    )
    select coalesce(array_agg(user_id), '{}') into v_users from marked;
    perform public.notify(v_users, 'event_reminder_1h', 'Starting soon: ' || v_event.title,
      'Starts at ' || to_char(v_event.starts_at at time zone 'Asia/Colombo', 'HH24:MI')
        || coalesce(' · ' || v_event.venue, ' · Online'),
      '/events/' || v_event.id, null, 'event', v_event.id);
    v_total := v_total + cardinality(v_users);
  end loop;

  -- 24 hours before.
  for v_event in
    select e.* from public.events e
    where e.status = 'published' and e.starts_at > now() + interval '1 hour' and e.starts_at <= now() + interval '24 hours'
      and exists (select 1 from public.event_registrations r
                  where r.event_id = e.id and r.status = 'registered' and not r.reminder_24h_sent)
  loop
    with marked as (
      update public.event_registrations r set reminder_24h_sent = true
      where r.event_id = v_event.id and r.status = 'registered' and not r.reminder_24h_sent
      returning r.user_id
    )
    select coalesce(array_agg(user_id), '{}') into v_users from marked;
    perform public.notify(v_users, 'event_reminder_24h', 'Tomorrow: ' || v_event.title,
      public.campus_time_label(v_event.starts_at) || coalesce(' · ' || v_event.venue, ' · Online'),
      '/events/' || v_event.id, null, 'event', v_event.id, true,
      jsonb_build_object('event_title', v_event.title, 'when', public.campus_time_label(v_event.starts_at),
                         'where', coalesce(v_event.venue, 'Online')));
    v_total := v_total + cardinality(v_users);
  end loop;
  return v_total;
end;
$$;
revoke execute on function public.enqueue_event_reminders() from public, anon, authenticated;
grant execute on function public.enqueue_event_reminders() to service_role; -- tests trigger it directly

select cron.schedule('event-reminders', '*/10 * * * *', 'select public.enqueue_event_reminders()');

-- Row-level security -----------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.event_changes enable row level security;

create policy events_select on public.events for select to authenticated
  using (
    (select public.is_approved())
    and (status <> 'draft' or organizer_id = (select auth.uid()) or (select public.has_role('admin')))
  );
create policy events_insert on public.events for insert to authenticated
  with check (organizer_id = (select auth.uid()) and (select public.has_role('organizer', 'admin')));
create policy events_update on public.events for update to authenticated
  using (
    (organizer_id = (select auth.uid()) and (select public.has_role('organizer', 'admin')))
    or (select public.has_role('admin'))
  )
  with check (
    (organizer_id = (select auth.uid()) and (select public.has_role('organizer', 'admin')))
    or (select public.has_role('admin'))
  );
-- Admins delete anything; organizers only drafts that were never published.
create policy events_delete on public.events for delete to authenticated
  using (
    (select public.has_role('admin'))
    or (organizer_id = (select auth.uid()) and published_at is null and (select public.has_role('organizer', 'admin')))
  );

-- Your own registrations; organizers see their events' registrations. Writes only via the RPCs.
create policy event_registrations_select on public.event_registrations for select to authenticated
  using (user_id = (select auth.uid()) or public.can_manage_event(event_id));

create policy event_changes_select on public.event_changes for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));

-- Grants (no default privileges in this project; see 0004) -----------------------------------

grant select, delete on public.events to authenticated;
grant insert (organizer_id, organizing_unit, title, description_html, description_text, category, format, venue,
              location_details, online_url, starts_at, ends_at, registration_deadline, capacity, waitlist_enabled,
              eligibility_department_ids, eligibility_years, eligibility_note, cover_url, space_id, status)
  on public.events to authenticated;
grant update (organizing_unit, title, description_html, description_text, category, format, venue, location_details,
              online_url, starts_at, ends_at, registration_deadline, capacity, waitlist_enabled,
              eligibility_department_ids, eligibility_years, eligibility_note, cover_url, space_id, status,
              cancel_reason)
  on public.events to authenticated;
grant select on public.event_registrations, public.event_changes to authenticated;

grant select, insert, update, delete on public.events, public.event_registrations, public.event_changes to service_role;

-- Covers bucket: public read; organizers and admins upload into their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-covers', 'event-covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy event_covers_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-covers' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.has_role('organizer', 'admin'))
  );
create policy event_covers_update on storage.objects for update to authenticated
  using (bucket_id = 'event-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy event_covers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'event-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
