-- 0038: timetables and attendance (Phase D).
--
-- * Coordinators build each batch's weekly timetable (`timetable_entries`) for a term. Saving an
--   entry generates one `class_sessions` row per class from today on; a single class can be
--   cancelled, restored or moved, and the batch is told.
-- * Students mark themselves present only while the class is running (server time). Absence is
--   the lack of a row once the class has ended.
-- * The session's lecturer and the department's coordinator can correct the register, with a reason;
--   every correction is logged in `attendance_changes` (append-only) and the student is told.
-- * Every 15 minutes `check_attendance_streaks()` finds students who missed the last 3 classes of
--   their batch in a row and alerts the department's coordinators and the super admins, once per
--   streak (`attendance_alerts`). Attending a class starts a new streak.
-- * All writes go through the RPCs below; the tables only grant select.

-- When a student was placed in their current batch: classes before that never count as missed.
alter table public.profiles add column batch_assigned_at timestamptz;
update public.profiles set batch_assigned_at = coalesce(approved_at, now()) where batch_id is not null;

create or replace function public.stamp_batch_assigned()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.batch_id is distinct from old.batch_id then
    new.batch_assigned_at := case when new.batch_id is null then null else now() end;
  end if;
  return new;
end;
$$;
create trigger profiles_stamp_batch_assigned
  before update of batch_id on public.profiles
  for each row execute function public.stamp_batch_assigned();

-- Tables ---------------------------------------------------------------------------------------

create table public.timetable_entries (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references public.batches (id) on delete cascade,
  module_code text check (module_code is null or char_length(module_code) between 2 and 20),
  module_name text not null check (char_length(module_name) between 2 and 120),
  lecturer_id uuid references public.profiles (id) on delete set null,
  weekday     smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  start_time  time not null,
  end_time    time not null,
  room        text check (room is null or char_length(room) <= 80),
  starts_on   date not null,
  ends_on     date not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_time > start_time),
  check (ends_on >= starts_on and ends_on <= starts_on + 366)
);
create index timetable_entries_batch_idx on public.timetable_entries (batch_id);
create index timetable_entries_lecturer_idx on public.timetable_entries (lecturer_id);

create table public.class_sessions (
  id            uuid primary key default gen_random_uuid(),
  -- Null once the timetable entry is deleted (past classes and their attendance stay).
  entry_id      uuid references public.timetable_entries (id) on delete set null,
  batch_id      uuid not null references public.batches (id) on delete cascade,
  session_date  date not null, -- the campus day it was scheduled for
  module_code   text,
  module_name   text not null,
  lecturer_id   uuid references public.profiles (id) on delete set null,
  room          text,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  change_reason text check (change_reason is null or char_length(change_reason) <= 300),
  moved_from    timestamptz, -- the original start, once moved
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (entry_id, session_date)
);
create index class_sessions_batch_idx on public.class_sessions (batch_id, starts_at);
create index class_sessions_lecturer_idx on public.class_sessions (lecturer_id, starts_at);

create table public.attendance (
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  marked_at  timestamptz not null default now(),
  source     text not null check (source in ('self', 'lecturer', 'coordinator')),
  marked_by  uuid references public.profiles (id) on delete set null,
  primary key (session_id, student_id)
);
create index attendance_student_idx on public.attendance (student_id);

create table public.attendance_changes (
  id         bigint generated always as identity primary key,
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  present    boolean not null,
  reason     text not null check (char_length(reason) between 3 and 300),
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index attendance_changes_session_idx on public.attendance_changes (session_id);
create index attendance_changes_student_idx on public.attendance_changes (student_id);

create table public.attendance_alerts (
  id                      uuid primary key default gen_random_uuid(),
  student_id              uuid not null references public.profiles (id) on delete cascade,
  batch_id                uuid not null references public.batches (id) on delete cascade,
  first_missed_session_id uuid not null references public.class_sessions (id) on delete cascade,
  missed_count            smallint not null,
  created_at              timestamptz not null default now(),
  unique (student_id, first_missed_session_id)
);
create index attendance_alerts_batch_idx on public.attendance_alerts (batch_id, created_at desc);

-- Helpers --------------------------------------------------------------------------------------

-- The batch's department is run by the caller (its coordinator, or a super admin).
create or replace function public.manages_batch(p_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.batches b where b.id = p_batch_id and public.manages_department(b.department_id)
  );
$$;

-- A batch's timetable: its students, its lecturers, the department's coordinator, super admins.
create or replace function public.can_view_batch_timetable(p_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and (
    public.my_batch_id() = p_batch_id
    or public.teaches_batch(p_batch_id)
    or public.manages_batch(p_batch_id)
  );
$$;

-- A class's register: the class's lecturer, the department's coordinator, super admins.
create or replace function public.can_take_register(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and exists (
    select 1 from public.class_sessions s
    where s.id = p_session_id and (s.lecturer_id = auth.uid() or public.manages_batch(s.batch_id))
  );
$$;

-- Grants and RLS -------------------------------------------------------------------------------

alter table public.timetable_entries enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_changes enable row level security;
alter table public.attendance_alerts enable row level security;

grant select on public.timetable_entries, public.class_sessions, public.attendance,
  public.attendance_changes, public.attendance_alerts to authenticated;
grant select, insert, update, delete on public.timetable_entries, public.class_sessions,
  public.attendance, public.attendance_alerts to service_role;
grant select, insert on public.attendance_changes to service_role;

create policy timetable_entries_select on public.timetable_entries for select to authenticated
  using (lecturer_id = (select auth.uid()) or public.can_view_batch_timetable(batch_id));
create policy class_sessions_select on public.class_sessions for select to authenticated
  using (lecturer_id = (select auth.uid()) or public.can_view_batch_timetable(batch_id));
create policy attendance_select on public.attendance for select to authenticated
  using (student_id = (select auth.uid()) or public.can_take_register(session_id));
create policy attendance_changes_select on public.attendance_changes for select to authenticated
  using (student_id = (select auth.uid()) or public.can_take_register(session_id));
create policy attendance_alerts_select on public.attendance_alerts for select to authenticated
  using (public.manages_batch(batch_id));

-- Sessions -------------------------------------------------------------------------------------

-- (Re)creates an entry's future classes. Classes that have started are never touched; cancelled
-- or moved future classes stay while they still fit the pattern.
create or replace function public.generate_class_sessions(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.timetable_entries%rowtype;
  v_today date := (now() at time zone 'Asia/Colombo')::date;
begin
  select * into e from public.timetable_entries where id = p_entry_id;
  if not found then
    return;
  end if;

  delete from public.class_sessions s
  where s.entry_id = e.id and s.starts_at > now()
    and ((s.status = 'scheduled' and s.moved_from is null)
         or s.session_date not between e.starts_on and e.ends_on
         or extract(isodow from s.session_date) <> e.weekday);

  insert into public.class_sessions
    (entry_id, batch_id, session_date, module_code, module_name, lecturer_id, room, starts_at, ends_at)
  select e.id, e.batch_id, d::date, e.module_code, e.module_name, e.lecturer_id, e.room,
         (d::date + e.start_time) at time zone 'Asia/Colombo',
         (d::date + e.end_time) at time zone 'Asia/Colombo'
  from generate_series(greatest(e.starts_on, v_today)::timestamp, e.ends_on::timestamp, interval '1 day') d
  where extract(isodow from d) = e.weekday
    and ((d::date + e.start_time) at time zone 'Asia/Colombo') > now()
  on conflict (entry_id, session_date) do nothing;

  update public.class_sessions s
  set module_code = e.module_code, module_name = e.module_name, lecturer_id = e.lecturer_id,
      room = case when s.moved_from is null then e.room else s.room end, updated_at = now()
  where s.entry_id = e.id and s.starts_at > now();
end;
$$;

-- Tells the batch's students (and the lecturer) about a cancelled, restored or moved class.
create or replace function public.notify_class_change(p_session_id uuid, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.class_sessions%rowtype;
  v_recipients uuid[];
begin
  select * into s from public.class_sessions where id = p_session_id;
  select coalesce(array_agg(p.id), '{}') into v_recipients
  from public.profiles p
  where p.batch_id = s.batch_id and p.role = 'student' and p.status = 'approved';
  if s.lecturer_id is not null then
    v_recipients := v_recipients || s.lecturer_id;
  end if;
  perform public.notify(v_recipients, 'class_changed', p_title, p_body,
                        '/timetable/sessions/' || s.id, auth.uid(), 'class_session', s.id, true);
end;
$$;

-- Timetable RPCs (coordinators and super admins) ----------------------------------------------

create or replace function public.save_timetable_entry(
  p_entry_id    uuid,
  p_batch_id    uuid,
  p_module_code text,
  p_module_name text,
  p_lecturer_id uuid,
  p_weekday     integer,
  p_start_time  time,
  p_end_time    time,
  p_room        text,
  p_starts_on   date,
  p_ends_on     date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch uuid := p_batch_id;
  v_id uuid := p_entry_id;
  v_clash text;
begin
  if p_entry_id is not null then
    select batch_id into v_batch from public.timetable_entries where id = p_entry_id;
    if not found then
      raise exception 'That class isn''t in the timetable any more' using errcode = 'P0002';
    end if;
  end if;
  if not public.manages_batch(v_batch) then
    raise exception 'Only the department''s coordinator or a super admin can change the timetable' using errcode = '42501';
  end if;
  if p_weekday not between 1 and 7 or p_end_time <= p_start_time then
    raise exception 'The class must end after it starts' using errcode = '22023';
  end if;
  if p_ends_on < p_starts_on or p_ends_on > p_starts_on + 366 then
    raise exception 'The term must end after it starts and last at most a year' using errcode = '22023';
  end if;
  if p_lecturer_id is not null and not exists (
    select 1 from public.profiles where id = p_lecturer_id and status = 'approved' and role <> 'student'
  ) then
    raise exception 'Pick an approved lecturer' using errcode = '22023';
  end if;

  select t.module_name into v_clash
  from public.timetable_entries t
  where t.batch_id = v_batch and t.weekday = p_weekday and t.id is distinct from p_entry_id
    and t.starts_on <= p_ends_on and t.ends_on >= p_starts_on
    and t.start_time < p_end_time and t.end_time > p_start_time
  limit 1;
  if v_clash is not null then
    raise exception 'This batch already has % at that time', v_clash using errcode = '22023';
  end if;

  if p_entry_id is null then
    insert into public.timetable_entries
      (batch_id, module_code, module_name, lecturer_id, weekday, start_time, end_time, room, starts_on, ends_on, created_by)
    values (v_batch, nullif(upper(trim(p_module_code)), ''), trim(p_module_name), p_lecturer_id, p_weekday,
            p_start_time, p_end_time, nullif(trim(p_room), ''), p_starts_on, p_ends_on, auth.uid())
    returning id into v_id;
  else
    update public.timetable_entries
    set module_code = nullif(upper(trim(p_module_code)), ''), module_name = trim(p_module_name),
        lecturer_id = p_lecturer_id, weekday = p_weekday, start_time = p_start_time, end_time = p_end_time,
        room = nullif(trim(p_room), ''), starts_on = p_starts_on, ends_on = p_ends_on, updated_at = now()
    where id = p_entry_id;
  end if;

  perform public.generate_class_sessions(v_id);
  return v_id;
end;
$$;

-- Removes the entry and its future classes; past classes and their attendance stay.
create or replace function public.delete_timetable_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch uuid;
begin
  select batch_id into v_batch from public.timetable_entries where id = p_entry_id;
  if not found then
    return;
  end if;
  if not public.manages_batch(v_batch) then
    raise exception 'Only the department''s coordinator or a super admin can change the timetable' using errcode = '42501';
  end if;
  delete from public.class_sessions where entry_id = p_entry_id and starts_at > now();
  delete from public.timetable_entries where id = p_entry_id;
end;
$$;

-- Cancelling a past class is allowed too (e.g. the lecturer didn't come), so nobody is marked absent.
create or replace function public.cancel_class_session(p_session_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.class_sessions%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  select * into s from public.class_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;
  if not public.manages_batch(s.batch_id) then
    raise exception 'Only the department''s coordinator or a super admin can cancel a class' using errcode = '42501';
  end if;
  if s.status = 'cancelled' then
    raise exception 'This class is already cancelled' using errcode = '22023';
  end if;
  if char_length(v_reason) not between 3 and 300 then
    raise exception 'Give a short reason (3 to 300 characters)' using errcode = '22023';
  end if;

  update public.class_sessions
  set status = 'cancelled', change_reason = v_reason, updated_at = now()
  where id = p_session_id;

  if s.ends_at > now() then
    perform public.notify_class_change(p_session_id,
      'Cancelled: ' || s.module_name || ' on ' || public.campus_time_label(s.starts_at), v_reason);
  end if;
end;
$$;

create or replace function public.restore_class_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.class_sessions%rowtype;
begin
  select * into s from public.class_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;
  if not public.manages_batch(s.batch_id) then
    raise exception 'Only the department''s coordinator or a super admin can restore a class' using errcode = '42501';
  end if;
  if s.status <> 'cancelled' then
    return;
  end if;

  update public.class_sessions
  set status = 'scheduled', change_reason = null, updated_at = now()
  where id = p_session_id;

  if s.ends_at > now() then
    perform public.notify_class_change(p_session_id,
      'Back on: ' || s.module_name || ' on ' || public.campus_time_label(s.starts_at),
      'This class is no longer cancelled.');
  end if;
end;
$$;

create or replace function public.move_class_session(
  p_session_id uuid,
  p_starts_at  timestamptz,
  p_ends_at    timestamptz,
  p_room       text,
  p_reason     text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.class_sessions%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
  v_room text := nullif(trim(coalesce(p_room, '')), '');
begin
  select * into s from public.class_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;
  if not public.manages_batch(s.batch_id) then
    raise exception 'Only the department''s coordinator or a super admin can move a class' using errcode = '42501';
  end if;
  if s.starts_at <= now() then
    raise exception 'This class has already started' using errcode = '22023';
  end if;
  if p_starts_at <= now() or p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '12 hours' then
    raise exception 'Pick a future time; the class must end after it starts' using errcode = '22023';
  end if;
  if char_length(v_reason) not between 3 and 300 then
    raise exception 'Give a short reason (3 to 300 characters)' using errcode = '22023';
  end if;

  update public.class_sessions
  set starts_at = p_starts_at, ends_at = p_ends_at, room = coalesce(v_room, room),
      moved_from = coalesce(moved_from, s.starts_at), status = 'scheduled',
      change_reason = v_reason, updated_at = now()
  where id = p_session_id;

  perform public.notify_class_change(p_session_id,
    'Moved: ' || s.module_name || ' is now ' || public.campus_time_label(p_starts_at)
      || coalesce(' in ' || coalesce(v_room, s.room), ''),
    v_reason);
end;
$$;

-- Attendance RPCs ------------------------------------------------------------------------------

-- Students mark themselves present, only while the class is running.
create or replace function public.mark_attendance(p_session_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.class_sessions%rowtype;
  v_marked timestamptz;
begin
  select * into s from public.class_sessions where id = p_session_id;
  if not found or not public.is_approved() then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.batch_id = s.batch_id
  ) then
    raise exception 'Only students in this batch can mark attendance for this class' using errcode = '42501';
  end if;
  if s.status = 'cancelled' then
    raise exception 'This class is cancelled' using errcode = '22023';
  end if;
  if now() < s.starts_at then
    raise exception 'You can mark yourself present once the class starts' using errcode = '22023';
  end if;
  if now() > s.ends_at then
    raise exception 'This class has ended. If you were there, ask your lecturer to correct the register' using errcode = '22023';
  end if;

  insert into public.attendance (session_id, student_id, source, marked_by)
  values (p_session_id, auth.uid(), 'self', auth.uid())
  on conflict (session_id, student_id) do nothing;
  select marked_at into v_marked from public.attendance where session_id = p_session_id and student_id = auth.uid();
  return v_marked;
end;
$$;

-- The class's lecturer or the department's coordinator corrects one student's record.
create or replace function public.correct_attendance(
  p_session_id uuid,
  p_student_id uuid,
  p_present    boolean,
  p_reason     text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.class_sessions%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  select * into s from public.class_sessions where id = p_session_id;
  if not found then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;
  if not public.can_take_register(p_session_id) then
    raise exception 'Only the class''s lecturer or the department''s coordinator can correct the register' using errcode = '42501';
  end if;
  if s.status = 'cancelled' then
    raise exception 'This class was cancelled' using errcode = '22023';
  end if;
  if s.starts_at > now() then
    raise exception 'You can take the register once the class starts' using errcode = '22023';
  end if;
  if char_length(v_reason) not between 3 and 300 then
    raise exception 'Give a short reason (3 to 300 characters)' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_student_id and p.role = 'student' and p.batch_id = s.batch_id
  ) and not exists (
    select 1 from public.attendance a where a.session_id = p_session_id and a.student_id = p_student_id
  ) then
    raise exception 'That student isn''t in this batch' using errcode = '22023';
  end if;

  if p_present then
    insert into public.attendance (session_id, student_id, source, marked_by)
    values (p_session_id, p_student_id,
            case when s.lecturer_id = auth.uid() then 'lecturer' else 'coordinator' end, auth.uid())
    on conflict (session_id, student_id) do nothing;
  else
    delete from public.attendance where session_id = p_session_id and student_id = p_student_id;
  end if;
  if not found then
    return; -- already recorded that way
  end if;

  insert into public.attendance_changes (session_id, student_id, present, reason, changed_by)
  values (p_session_id, p_student_id, p_present, v_reason, auth.uid());

  perform public.notify(array[p_student_id], 'attendance_corrected',
    'Your attendance for ' || s.module_name || ' on ' || public.campus_time_label(s.starts_at)
      || ' was changed to ' || case when p_present then 'present' else 'absent' end,
    v_reason, '/attendance', auth.uid(), 'class_session', p_session_id);
end;
$$;

-- A student's own record: every class of their batch that has ended since they joined it.
create or replace function public.my_attendance()
returns table (
  session_id  uuid,
  module_code text,
  module_name text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  present     boolean,
  source      text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.module_code, s.module_name, s.starts_at, s.ends_at, a.student_id is not null, a.source
  from public.profiles p
  join public.class_sessions s on s.batch_id = p.batch_id
  left join public.attendance a on a.session_id = s.id and a.student_id = p.id
  where p.id = auth.uid() and p.role = 'student' and p.status = 'approved'
    and s.status = 'scheduled' and s.ends_at <= now()
    and s.starts_at >= coalesce(p.batch_assigned_at, '-infinity'::timestamptz)
  order by s.starts_at desc;
$$;

-- Per-student attendance for a batch (coordinators and super admins).
create or replace function public.batch_attendance_overview(p_batch_id uuid)
returns table (
  student_id     uuid,
  full_name      text,
  username       text,
  avatar_url     text,
  held           integer,
  attended       integer,
  current_streak integer,
  last_alert_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not public.manages_batch(p_batch_id) then
    raise exception 'Only the department''s coordinator or a super admin can see this' using errcode = '42501';
  end if;
  return query
  with held as (
    select s.id, s.starts_at from public.class_sessions s
    where s.batch_id = p_batch_id and s.status = 'scheduled' and s.ends_at <= now()
  ), students as (
    select p.id, p.full_name, p.username, p.avatar_url,
           coalesce(p.batch_assigned_at, '-infinity'::timestamptz) as since
    from public.profiles p
    where p.batch_id = p_batch_id and p.role = 'student' and p.status = 'approved'
  ), counted as (
    select st.*,
      (select count(*) from held h where h.starts_at >= st.since)::integer as held,
      (select count(*) from held h join public.attendance a on a.session_id = h.id and a.student_id = st.id
       where h.starts_at >= st.since)::integer as attended,
      (select max(h.starts_at) from held h join public.attendance a on a.session_id = h.id and a.student_id = st.id)
        as last_present
    from students st
  )
  select c.id, c.full_name, c.username, c.avatar_url, c.held, c.attended,
    (select count(*) from held h
     where h.starts_at >= c.since and h.starts_at > coalesce(c.last_present, '-infinity'::timestamptz))::integer,
    (select max(al.created_at) from public.attendance_alerts al
     where al.student_id = c.id and al.batch_id = p_batch_id)
  from counted c
  order by c.full_name;
end;
$$;

-- 3 missed classes in a row (pg_cron, every 15 minutes) -----------------------------------------

create or replace function public.check_attendance_streaks()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_last_present timestamptz;
  v_missed uuid[];
  v_alert uuid;
  v_recipients uuid[];
  v_count integer := 0;
begin
  for r in
    select p.id, p.batch_id, coalesce(p.batch_assigned_at, '-infinity'::timestamptz) as since,
           b.name as batch_name, b.department_id
    from public.profiles p
    join public.batches b on b.id = p.batch_id
    where p.role = 'student' and p.status = 'approved'
      and exists (
        select 1 from public.class_sessions s
        where s.batch_id = p.batch_id and s.status = 'scheduled'
          and s.ends_at <= now() and s.ends_at > now() - interval '2 days'
      )
  loop
    select max(s.starts_at) into v_last_present
    from public.attendance a
    join public.class_sessions s on s.id = a.session_id
    where a.student_id = r.id and s.batch_id = r.batch_id and s.status = 'scheduled';

    select array_agg(s.id order by s.starts_at) into v_missed
    from public.class_sessions s
    where s.batch_id = r.batch_id and s.status = 'scheduled' and s.ends_at <= now()
      and s.starts_at >= r.since
      and s.starts_at > coalesce(v_last_present, '-infinity'::timestamptz);

    if coalesce(array_length(v_missed, 1), 0) < 3 then
      continue;
    end if;

    v_alert := null;
    insert into public.attendance_alerts (student_id, batch_id, first_missed_session_id, missed_count)
    values (r.id, r.batch_id, v_missed[1], array_length(v_missed, 1))
    on conflict (student_id, first_missed_session_id) do nothing
    returning id into v_alert;
    if v_alert is null then
      continue; -- this streak was already reported
    end if;

    select coalesce(array_agg(p.id), '{}') into v_recipients
    from public.profiles p
    where p.status = 'approved'
      and (p.role = 'super_admin' or (p.role = 'coordinator' and p.department_id = r.department_id));

    perform public.notify(v_recipients, 'attendance_alert',
      public.display_name(r.id) || ' (' || r.batch_name || ') missed '
        || array_length(v_missed, 1) || ' classes in a row',
      case when v_last_present is null then 'They haven''t attended a class yet.'
           else 'Last attended: ' || public.campus_time_label(v_last_present) || '.' end,
      '/attendance?batch=' || r.batch_id, null, 'attendance_alert', v_alert, true);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

select cron.schedule('attendance-streaks', '*/15 * * * *', 'select public.check_attendance_streaks()');

-- Notification types (delivery defaults; labels in lib/notifications.ts).
insert into public.notification_types (type, in_app_default, email_default, email_available, locked, sort_order)
values ('class_changed', true, true, true, false, 78),
       ('attendance_corrected', true, false, true, false, 79),
       ('attendance_alert', true, true, true, false, 80)
on conflict (type) do nothing;

-- Function grants ------------------------------------------------------------------------------

revoke execute on function public.stamp_batch_assigned() from public, anon, authenticated;
revoke execute on function public.generate_class_sessions(uuid) from public, anon, authenticated;
revoke execute on function public.notify_class_change(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.check_attendance_streaks() from public, anon, authenticated;
grant execute on function public.check_attendance_streaks() to service_role;

revoke execute on function public.manages_batch(uuid) from public, anon;
revoke execute on function public.can_view_batch_timetable(uuid) from public, anon;
revoke execute on function public.can_take_register(uuid) from public, anon;
revoke execute on function public.save_timetable_entry(uuid, uuid, text, text, uuid, integer, time, time, text, date, date) from public, anon;
revoke execute on function public.delete_timetable_entry(uuid) from public, anon;
revoke execute on function public.cancel_class_session(uuid, text) from public, anon;
revoke execute on function public.restore_class_session(uuid) from public, anon;
revoke execute on function public.move_class_session(uuid, timestamptz, timestamptz, text, text) from public, anon;
revoke execute on function public.mark_attendance(uuid) from public, anon;
revoke execute on function public.correct_attendance(uuid, uuid, boolean, text) from public, anon;
revoke execute on function public.my_attendance() from public, anon;
revoke execute on function public.batch_attendance_overview(uuid) from public, anon;

grant execute on function public.manages_batch(uuid), public.can_view_batch_timetable(uuid),
  public.can_take_register(uuid), public.save_timetable_entry(uuid, uuid, text, text, uuid, integer, time, time, text, date, date),
  public.delete_timetable_entry(uuid), public.cancel_class_session(uuid, text),
  public.restore_class_session(uuid), public.move_class_session(uuid, timestamptz, timestamptz, text, text),
  public.mark_attendance(uuid), public.correct_attendance(uuid, uuid, boolean, text),
  public.my_attendance(), public.batch_attendance_overview(uuid)
  to authenticated;
