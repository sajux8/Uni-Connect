-- 0040: profiles.username is citext, so batch_attendance_overview (0038) casts it to the declared text.

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
    select p.id, p.full_name, p.username::text as username, p.avatar_url,
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
