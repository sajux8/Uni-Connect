-- 0021: reports, moderation and administration (Feature 12, O8)
-- Anyone can report what they can see; moderators and admins
-- review reports and act through moderate_report(), which applies the effect, writes the
-- append-only moderation log (now linked to the report), resolves every open report on the
-- same target and tells the people involved. Also: user search and detail for admins,
-- automatic end of timed suspensions, dashboard statistics, tag merging, space settings for
-- space moderators, and posting rate limits.

insert into public.notification_types (type, in_app_default, email_default, email_available, locked, sort_order) values
  ('report_submitted',   true, false, false, false, 100),
  ('report_resolved',    true, false, false, false, 101),
  ('moderation_warning', true, true,  true,  true,  102);

-- Reports ------------------------------------------------------------------------------------------

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid references public.profiles (id) on delete set null,
  target_type      public.report_target not null,
  target_id        uuid not null,
  -- Who wrote the reported thing (null for spaces), and where it lives.
  target_author_id uuid references public.profiles (id) on delete set null,
  space_id         uuid references public.spaces (id) on delete set null,
  reason           public.report_reason not null,
  details          text check (char_length(details) <= 1000),
  -- What it said when reported: moderators can't otherwise read private messages, and
  -- content may be edited or deleted later.
  snapshot         jsonb not null default '{}',
  status           public.report_status not null default 'open',
  action           public.moderation_action_type,
  handled_by       uuid references public.profiles (id) on delete set null,
  handled_at       timestamptz,
  resolution_note  text check (char_length(resolution_note) <= 1000),
  created_at       timestamptz not null default now()
);
-- One open report per person per target.
create unique index reports_open_once_idx on public.reports (reporter_id, target_type, target_id)
  where status = 'open';
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_target_idx on public.reports (target_type, target_id);
create index reports_author_idx on public.reports (target_author_id);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);
create index reports_handled_by_idx on public.reports (handled_by);
create index reports_space_idx on public.reports (space_id);

alter table public.moderation_actions add column report_id uuid references public.reports (id);
create index moderation_actions_report_idx on public.moderation_actions (report_id);

-- Details of something that can be reported, as seen by the caller. Returns no row when the
-- caller can't see it (so nobody can report, or learn about, things hidden from them).
create or replace function public.report_target_info(p_type public.report_target, p_id uuid)
returns table (author_id uuid, space_id uuid, title text, excerpt text, link text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
begin
  if p_type = 'post' then
    return query
      select p.author_id, p.space_id, p.title, left(p.body_text, 500), '/posts/' || p.id
      from public.posts p where p.id = p_id and public.can_view_post(p.id) and p.status <> 'deleted';
  elsif p_type = 'reply' then
    return query
      select r.author_id, p.space_id, p.title, left(r.body_text, 500), '/posts/' || p.id || '#reply-' || r.id
      from public.replies r join public.posts p on p.id = r.post_id
      where r.id = p_id and public.can_view_post(p.id) and r.status <> 'deleted';
  elsif p_type = 'resource' then
    return query
      select r.uploader_id, r.space_id, r.title, left(coalesce(r.description, r.url, r.file_name), 500),
             '/resources/' || r.id
      from public.resources r where r.id = p_id and public.can_view_resource(r.id);
  elsif p_type = 'event' then
    return query
      select e.organizer_id, e.space_id, e.title, left(e.description_text, 500), '/events/' || e.id
      from public.events e where e.id = p_id and (e.status <> 'draft' or e.organizer_id = v_me);
  elsif p_type = 'announcement' then
    return query
      select a.publisher_id, null::uuid, a.title, left(a.body_text, 500), '/announcements/' || a.id
      from public.announcements a where a.id = p_id and a.status = 'published';
  elsif p_type = 'message' then
    return query
      select m.sender_id, null::uuid, 'Private message'::text, left(m.body, 2000), null::text
      from public.messages m
      where m.id = p_id and m.deleted_at is null
        and exists (select 1 from public.conversation_participants cp
                    where cp.conversation_id = m.conversation_id and cp.user_id = v_me);
  elsif p_type = 'user' then
    return query
      select p.id, null::uuid, p.full_name, left(coalesce(p.bio, ''), 500), '/u/' || p.username
      from public.profiles p where p.id = p_id and p.status = 'approved';
  elsif p_type = 'space' then
    return query
      select null::uuid, s.id, s.name, left(coalesce(s.description, ''), 500), '/spaces/' || s.slug
      from public.spaces s where s.id = p_id and not s.is_archived;
  end if;
end;
$$;
revoke execute on function public.report_target_info(public.report_target, uuid) from public, anon, authenticated;

-- Moderators and admins who should hear about a new report.
create or replace function public.notify_moderators_of_report(p_report public.reports)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_open  int;
  v_mod   uuid;
  v_title text;
begin
  select count(*) into v_open from public.reports where status = 'open';
  v_title := case when v_open = 1 then '1 report is waiting for review'
                  else v_open || ' reports are waiting for review' end;
  -- One unread reminder per moderator, kept up to date (like account approvals).
  for v_mod in
    select id from public.profiles
    where role in ('moderator', 'admin') and status = 'approved' and id is distinct from p_report.reporter_id
  loop
    update public.notifications
    set title = v_title, body = 'Latest: ' || replace(p_report.reason::text, '_', ' ') || ' · ' || p_report.target_type,
        created_at = now(), entity_id = p_report.id, link = '/admin/reports/' || p_report.id
    where user_id = v_mod and type = 'report_submitted' and read_at is null;
    if not found then
      perform public.notify(array[v_mod], 'report_submitted', v_title,
                            'Latest: ' || replace(p_report.reason::text, '_', ' ') || ' · ' || p_report.target_type,
                            '/admin/reports/' || p_report.id, null, 'report', p_report.id);
    end if;
  end loop;
end;
$$;
revoke execute on function public.notify_moderators_of_report(public.reports) from public, anon, authenticated;

create or replace function public.report_content(
  p_target_type public.report_target,
  p_target_id   uuid,
  p_reason      public.report_reason,
  p_details     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me      uuid := auth.uid();
  v_info    record;
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_report  public.reports%rowtype;
begin
  if not public.is_approved() then
    raise exception 'Only approved members can report content' using errcode = '42501';
  end if;
  if (select count(*) from public.reports where reporter_id = v_me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You''ve sent a lot of reports today. Please try again tomorrow.' using errcode = '22023';
  end if;
  if p_reason = 'other' and v_details is null then
    raise exception 'Tell the moderators what''s wrong' using errcode = '22023';
  end if;

  select * into v_info from public.report_target_info(p_target_type, p_target_id);
  if not found then
    raise exception 'That content isn''t available' using errcode = 'P0002';
  end if;
  if v_info.author_id = v_me then
    raise exception 'You can''t report your own content' using errcode = '22023';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, target_author_id, space_id, reason, details, snapshot)
  values (v_me, p_target_type, p_target_id, v_info.author_id, v_info.space_id, p_reason, left(v_details, 1000),
          jsonb_build_object('title', v_info.title, 'excerpt', v_info.excerpt, 'link', v_info.link,
                             'author_name', (select full_name from public.profiles where id = v_info.author_id)))
  returning * into v_report;

  perform public.notify_moderators_of_report(v_report);
  return v_report.id;
end;
$$;

-- Act on a report. Effects by action:
--   dismiss          nothing changes; reporters hear "no action needed"
--   hide / remove    the content is hidden (post, reply), removed (post, reply), rejected
--                    (resource), cancelled (event), archived (announcement, space) or deleted
--                    (message); its author is told why
--   warn             the author gets a warning (in-app and email)
--   suspend          admins only: the author's account is suspended, optionally until a date
--   ban_from_space   the author is banned from the space the content was posted in
-- Every open report on the same target is resolved, and each reporter is told.
create or replace function public.moderate_report(
  p_report_id uuid,
  p_action    text,
  p_note      text,
  p_until     timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me      uuid := auth.uid();
  v_report  public.reports%rowtype;
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
  v_logged  public.moderation_action_type;
  v_author  uuid;
  v_status  public.report_status;
  v_reporters uuid[];
begin
  if not public.has_role('moderator', 'admin') then
    raise exception 'Only moderators can act on reports' using errcode = '42501';
  end if;
  if v_note is null or char_length(v_note) < 3 then
    raise exception 'Add a short note explaining your decision' using errcode = '22023';
  end if;
  select * into v_report from public.reports where id = p_report_id for update;
  if v_report.id is null then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if v_report.status <> 'open' then
    raise exception 'This report has already been handled' using errcode = '22023';
  end if;
  v_author := v_report.target_author_id;
  if v_author = v_me and p_action <> 'dismiss' then
    raise exception 'Another moderator should handle reports about your own content' using errcode = '42501';
  end if;

  if p_action = 'dismiss' then
    v_logged := 'dismiss_report';

  elsif p_action in ('hide', 'remove') then
    v_logged := case when p_action = 'hide' then 'hide_content' else 'remove_content' end;
    case v_report.target_type
      when 'post' then
        update public.posts set status = case when p_action = 'hide' then 'hidden' else 'removed' end::public.content_status
        where id = v_report.target_id;
      when 'reply' then
        update public.replies set status = case when p_action = 'hide' then 'hidden' else 'removed' end::public.content_status
        where id = v_report.target_id;
        update public.posts set accepted_reply_id = null where accepted_reply_id = v_report.target_id;
      when 'resource' then
        update public.resources
        set status = 'rejected', review_note = left(v_note, 500), reviewed_by = v_me, reviewed_at = now()
        where id = v_report.target_id;
      when 'event' then
        update public.events
        set status = 'cancelled', cancel_reason = left('Removed by a moderator: ' || v_note, 500)
        where id = v_report.target_id and status <> 'cancelled';
      when 'announcement' then
        update public.announcements set status = 'archived', is_pinned = false where id = v_report.target_id;
      when 'message' then
        update public.messages set deleted_at = now() where id = v_report.target_id and deleted_at is null;
      when 'space' then
        if not public.has_role('admin') then
          raise exception 'Only admins can archive spaces' using errcode = '42501';
        end if;
        update public.spaces set is_archived = true where id = v_report.target_id;
      else
        raise exception 'There''s no content to hide for this report. Warn or suspend instead.' using errcode = '22023';
    end case;

  elsif p_action = 'warn' then
    if v_author is null then
      raise exception 'There''s nobody to warn for this report' using errcode = '22023';
    end if;
    v_logged := 'warn_user';
    perform public.notify(array[v_author], 'moderation_warning', 'A moderator sent you a warning',
                          v_note, coalesce(v_report.snapshot ->> 'link', '/home'), v_me, 'report', v_report.id,
                          true, jsonb_build_object('reason', v_note, 'post_title', v_report.snapshot ->> 'title'));

  elsif p_action = 'suspend' then
    if not public.has_role('admin') then
      raise exception 'Only admins can suspend accounts' using errcode = '42501';
    end if;
    if v_author is null then
      raise exception 'There''s no account to suspend for this report' using errcode = '22023';
    end if;
    if p_until is not null and p_until <= now() then
      raise exception 'Choose an end date in the future' using errcode = '22023';
    end if;
    v_logged := 'suspend_user';
    update public.profiles
    set status = 'suspended', status_reason = left(v_note, 500), suspended_until = p_until
    where id = v_author and status = 'approved';

  elsif p_action = 'ban_from_space' then
    if v_author is null or v_report.space_id is null then
      raise exception 'This report isn''t about something in a space' using errcode = '22023';
    end if;
    v_logged := 'ban_from_space';
    insert into public.space_members (space_id, user_id, role, status)
    values (v_report.space_id, v_author, 'member', 'banned')
    on conflict (space_id, user_id) do update set status = 'banned', role = 'member';

  else
    raise exception 'Unknown action' using errcode = '22023';
  end if;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason, metadata, report_id)
  values (
    v_me, v_logged,
    case when p_action in ('warn', 'suspend') then 'user' else v_report.target_type::text end,
    case when p_action in ('warn', 'suspend') then v_author else v_report.target_id end,
    v_note,
    jsonb_build_object('report_target', v_report.target_type, 'report_target_id', v_report.target_id)
      || case when p_action = 'ban_from_space' then jsonb_build_object('space_id', v_report.space_id) else '{}'::jsonb end
      || case when p_action = 'suspend' and p_until is not null then jsonb_build_object('until', p_until) else '{}'::jsonb end,
    v_report.id
  );

  v_status := case when p_action = 'dismiss' then 'dismissed' else 'resolved' end;
  with handled as (
    update public.reports
    set status = v_status, action = v_logged, handled_by = v_me, handled_at = now(), resolution_note = left(v_note, 1000)
    where target_type = v_report.target_type and target_id = v_report.target_id and status = 'open'
    returning reporter_id
  )
  select coalesce(array_agg(distinct reporter_id) filter (where reporter_id is not null), '{}') into v_reporters from handled;

  -- Reporters learn the outcome, never details about the other person.
  perform public.notify(
    v_reporters, 'report_resolved',
    case when v_status = 'dismissed' then 'A moderator reviewed your report'
         else 'Action was taken on something you reported' end,
    case when v_status = 'dismissed' then 'They decided no action was needed this time. Thanks for helping keep the community safe.'
         else 'Thanks for reporting it. Moderators reviewed it and took action.' end,
    null, null, 'report', v_report.id);

  -- The moderators' "waiting for review" reminder goes once nothing is open.
  if not exists (select 1 from public.reports where status = 'open') then
    update public.notifications set read_at = now()
    where type = 'report_submitted' and read_at is null;
  end if;
end;
$$;

revoke execute on function public.report_content(public.report_target, uuid, public.report_reason, text) from public, anon;
revoke execute on function public.moderate_report(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.report_content(public.report_target, uuid, public.report_reason, text) to authenticated;
grant execute on function public.moderate_report(uuid, text, text, timestamptz) to authenticated;

-- Hidden or removed content → its author, with the reason (extends 0011 to every content type).
create or replace function public.notify_content_moderated()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_author uuid;
  v_title  text;
  v_link   text;
  v_what   text;
  v_verb   text := case when new.action = 'remove_content' then 'removed' else 'hid' end;
begin
  if new.action not in ('hide_content', 'remove_content') then
    return null;
  end if;
  case new.target_type
    when 'post' then
      select author_id, title, '/posts/' || id, 'post' into v_author, v_title, v_link, v_what
      from public.posts where id = new.target_id;
    when 'reply' then
      select r.author_id, p.title, '/posts/' || p.id, 'reply' into v_author, v_title, v_link, v_what
      from public.replies r join public.posts p on p.id = r.post_id where r.id = new.target_id;
    when 'resource' then
      select uploader_id, title, '/resources/' || id, 'resource' into v_author, v_title, v_link, v_what
      from public.resources where id = new.target_id;
    when 'event' then
      select organizer_id, title, '/events/' || id, 'event' into v_author, v_title, v_link, v_what
      from public.events where id = new.target_id;
    when 'announcement' then
      select publisher_id, title, '/announcements/' || id, 'announcement' into v_author, v_title, v_link, v_what
      from public.announcements where id = new.target_id;
    when 'message' then
      select sender_id, 'a private message', '/messages/' || conversation_id, 'message'
      into v_author, v_title, v_link, v_what
      from public.messages where id = new.target_id;
    else
      return null;
  end case;
  if v_author is null then
    return null;
  end if;

  perform public.notify(
    array[v_author], 'content_moderated',
    'A moderator ' || v_verb || ' your ' || v_what,
    coalesce('Reason: ' || new.reason, v_title), v_link, new.actor_id, new.target_type, new.target_id,
    true, jsonb_build_object('reason', new.reason, 'post_title', v_title));
  return null;
end;
$$;
revoke execute on function public.notify_content_moderated() from public, anon, authenticated;

alter table public.reports enable row level security;
-- Reporters see their own reports; moderators and admins see all. Writes go through the RPCs.
create policy reports_select on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.has_role('moderator', 'admin')));
grant select on public.reports to authenticated;
grant select, insert, update on public.reports to service_role;

-- Users ------------------------------------------------------------------------------------------------

-- Admin search across every account (emails live in auth.users, hence SECURITY DEFINER).
create or replace function public.admin_search_users(
  p_query      text default null,
  p_role       public.user_role default null,
  p_status     public.account_status default null,
  p_department uuid default null,
  p_limit      int default 50,
  p_offset     int default 0
)
returns table (
  id              uuid,
  full_name       text,
  username        text,
  email           text,
  avatar_url      text,
  role            public.user_role,
  status          public.account_status,
  department_name text,
  year_of_study   smallint,
  suspended_until timestamptz,
  created_at      timestamptz,
  total_count     bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_pattern text := '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not public.has_role('admin') then
    raise exception 'Only administrators can manage users' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.username::text, u.email::text, p.avatar_url, p.role, p.status, d.name,
           p.year_of_study, p.suspended_until, p.created_at, count(*) over ()
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.departments d on d.id = p.department_id
    where (nullif(btrim(coalesce(p_query, '')), '') is null
           or p.full_name ilike v_pattern or p.username::text ilike v_pattern or u.email::text ilike v_pattern)
      and (p_role is null or p.role = p_role)
      and (p_status is null or p.status = p_status)
      and (p_department is null or p.department_id = p_department)
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;

-- Everything the admin user page shows about one account.
create or replace function public.admin_user_detail(p_user_id uuid)
returns table (
  id                uuid,
  full_name         text,
  username          text,
  email             text,
  avatar_url        text,
  role              public.user_role,
  requested_role    public.requested_role,
  status            public.account_status,
  status_reason     text,
  suspended_until   timestamptz,
  department_name   text,
  year_of_study     smallint,
  id_number         text,
  application_note  text,
  created_at        timestamptz,
  approved_at       timestamptz,
  last_sign_in_at   timestamptz,
  post_count        int,
  reply_count       int,
  resource_count    int,
  reports_against   int,
  open_reports_against int,
  reports_made      int,
  deletion_request_id uuid,
  deletion_reason   text,
  deletion_requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Only administrators can manage users' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.username::text, u.email::text, p.avatar_url, p.role, p.requested_role, p.status,
           p.status_reason, p.suspended_until, d.name, p.year_of_study, pp.id_number, pp.application_note,
           p.created_at, p.approved_at, u.last_sign_in_at,
           (select count(*)::int from public.posts x where x.author_id = p.id and x.status <> 'deleted'),
           (select count(*)::int from public.replies x where x.author_id = p.id and x.status <> 'deleted'),
           (select count(*)::int from public.resources x where x.uploader_id = p.id),
           (select count(*)::int from public.reports x where x.target_author_id = p.id),
           (select count(*)::int from public.reports x where x.target_author_id = p.id and x.status = 'open'),
           (select count(*)::int from public.reports x where x.reporter_id = p.id),
           dr.id, dr.reason, dr.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.departments d on d.id = p.department_id
    left join public.profile_private pp on pp.user_id = p.id
    left join lateral (
      select r.id, r.reason, r.created_at from public.account_deletion_requests r
      where r.user_id = p.id and r.status = 'pending' order by r.created_at desc limit 1
    ) dr on true
    where p.id = p_user_id;
end;
$$;

-- Timed suspensions end on their own (scheduled below). Logged without an actor.
create or replace function public.end_suspensions()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  with ended as (
    update public.profiles
    set status = 'approved', status_reason = null, suspended_until = null
    where status = 'suspended' and suspended_until is not null and suspended_until <= now()
    returning id
  )
  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason, metadata)
  select null, 'unsuspend_user', 'user', id, 'Suspension period ended', '{"automatic": true}'::jsonb
  from ended;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.end_suspensions() from public, anon, authenticated;
grant execute on function public.end_suspensions() to service_role; -- tests trigger it directly
select cron.schedule('end-suspensions', '*/15 * * * *', 'select public.end_suspensions()');

-- Decide an account deletion request. Completing it (deleting the auth user) needs the
-- service role, so the app does that after this has logged the decision.
create or replace function public.decide_deletion_request(p_request_id uuid, p_approve boolean, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.account_deletion_requests%rowtype;
begin
  if not public.has_role('admin') then
    raise exception 'Only administrators can handle deletion requests' using errcode = '42501';
  end if;
  select * into v_req from public.account_deletion_requests where id = p_request_id for update;
  if v_req.id is null or v_req.status <> 'pending' then
    raise exception 'This request has already been handled' using errcode = '22023';
  end if;
  if v_req.user_id = auth.uid() then
    raise exception 'Another admin should handle your own deletion request' using errcode = '42501';
  end if;
  update public.account_deletion_requests
  set status = case when p_approve then 'completed' else 'declined' end, handled_by = auth.uid(), handled_at = now()
  where id = p_request_id;
  if p_approve then
    insert into public.moderation_actions (actor_id, action, target_type, target_id, reason, metadata)
    values (auth.uid(), 'delete_account', 'user', v_req.user_id, nullif(btrim(coalesce(p_note, '')), ''),
            jsonb_build_object('request_id', v_req.id));
  end if;
  return v_req.user_id;
end;
$$;

revoke execute on function public.admin_search_users(text, public.user_role, public.account_status, uuid, int, int) from public, anon;
revoke execute on function public.admin_user_detail(uuid) from public, anon;
revoke execute on function public.decide_deletion_request(uuid, boolean, text) from public, anon;
grant execute on function public.admin_search_users(text, public.user_role, public.account_status, uuid, int, int) to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
grant execute on function public.decide_deletion_request(uuid, boolean, text) to authenticated;

-- Dashboard ------------------------------------------------------------------------------------------

create or replace function public.admin_stats()
returns table (
  pending_approvals   int,
  open_reports        int,
  pending_resources   int,
  pending_deletions   int,
  new_users_7d        int,
  members             int,
  posts_7d            int,
  replies_7d          int,
  upcoming_events     int,
  active_mentorships  int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role('moderator', 'admin') then
    raise exception 'Only moderators and admins can see the dashboard' using errcode = '42501';
  end if;
  return query select
    (select count(*)::int from public.profiles where status = 'pending'),
    (select count(*)::int from public.reports where status = 'open'),
    (select count(*)::int from public.resources where status = 'pending'),
    (select count(*)::int from public.account_deletion_requests where status = 'pending'),
    (select count(*)::int from public.profiles where status = 'approved' and approved_at > now() - interval '7 days'),
    (select count(*)::int from public.profiles where status = 'approved'),
    (select count(*)::int from public.posts where status <> 'deleted' and created_at > now() - interval '7 days'),
    (select count(*)::int from public.replies where status <> 'deleted' and created_at > now() - interval '7 days'),
    (select count(*)::int from public.events where status = 'published' and starts_at > now()),
    (select count(*)::int from public.mentorship_requests where status = 'accepted');
end;
$$;

-- Weekly activity for the dashboard chart (campus weeks, oldest first).
create or replace function public.admin_weekly_activity(p_weeks int default 8)
returns table (week_start date, posts int, replies int, new_members int, registrations int)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role('moderator', 'admin') then
    raise exception 'Only moderators and admins can see the dashboard' using errcode = '42501';
  end if;
  return query
    with weeks as (
      select (date_trunc('week', (now() at time zone 'Asia/Colombo')) - (n || ' weeks')::interval)::date as w
      from generate_series(0, least(greatest(p_weeks, 1), 26) - 1) n
    )
    select w.w,
      (select count(*)::int from public.posts x
       where (x.created_at at time zone 'Asia/Colombo')::date >= w.w
         and (x.created_at at time zone 'Asia/Colombo')::date < w.w + 7 and x.status <> 'deleted'),
      (select count(*)::int from public.replies x
       where (x.created_at at time zone 'Asia/Colombo')::date >= w.w
         and (x.created_at at time zone 'Asia/Colombo')::date < w.w + 7 and x.status <> 'deleted'),
      (select count(*)::int from public.profiles x
       where (x.approved_at at time zone 'Asia/Colombo')::date >= w.w
         and (x.approved_at at time zone 'Asia/Colombo')::date < w.w + 7),
      (select count(*)::int from public.event_registrations x
       where (x.registered_at at time zone 'Asia/Colombo')::date >= w.w
         and (x.registered_at at time zone 'Asia/Colombo')::date < w.w + 7)
    from weeks w
    order by w.w;
end;
$$;

revoke execute on function public.admin_stats() from public, anon;
revoke execute on function public.admin_weekly_activity(int) from public, anon;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_weekly_activity(int) to authenticated;

-- Spaces and tags -------------------------------------------------------------------------------------

-- Space moderators may edit a space's description, rules and join policy (admins edit
-- everything directly through the table's RLS).
create or replace function public.update_space_details(
  p_space_id    uuid,
  p_description text,
  p_rules       text,
  p_join_policy public.join_policy
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_space_moderator(p_space_id) then
    raise exception 'Only this space''s moderators can change its settings' using errcode = '42501';
  end if;
  update public.spaces
  set description = nullif(btrim(coalesce(p_description, '')), ''),
      rules = nullif(btrim(coalesce(p_rules, '')), ''),
      join_policy = p_join_policy
  where id = p_space_id;
  if not found then
    raise exception 'Space not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Admins make someone a space moderator (joining them if needed) or take it away.
create or replace function public.set_space_moderator(p_space_id uuid, p_user_id uuid, p_moderator boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Only administrators can choose space moderators' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and status = 'approved') then
    raise exception 'That account isn''t active' using errcode = '22023';
  end if;
  if p_moderator then
    insert into public.space_members (space_id, user_id, role, status)
    values (p_space_id, p_user_id, 'moderator', 'active')
    on conflict (space_id, user_id) do update set role = 'moderator', status = 'active';
  else
    update public.space_members set role = 'member' where space_id = p_space_id and user_id = p_user_id;
  end if;
  insert into public.moderation_actions (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'change_role', 'user', p_user_id,
          jsonb_build_object('space_id', p_space_id, 'space_role', case when p_moderator then 'moderator' else 'member' end));
end;
$$;

-- Merge one tag into another: posts, resources and followers move across, then it's deleted.
create or replace function public.merge_tags(p_from uuid, p_into uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Only administrators can merge tags' using errcode = '42501';
  end if;
  if p_from = p_into then
    raise exception 'Choose two different tags' using errcode = '22023';
  end if;
  if (select count(*) from public.tags where id in (p_from, p_into)) <> 2 then
    raise exception 'Tag not found' using errcode = 'P0002';
  end if;
  insert into public.post_tags (post_id, tag_id)
  select post_id, p_into from public.post_tags where tag_id = p_from
  on conflict do nothing;
  insert into public.resource_tags (resource_id, tag_id)
  select resource_id, p_into from public.resource_tags where tag_id = p_from
  on conflict do nothing;
  insert into public.tag_follows (user_id, tag_id)
  select user_id, p_into from public.tag_follows where tag_id = p_from
  on conflict do nothing;
  delete from public.tags where id = p_from;
  update public.tags set usage_count = (select count(*) from public.post_tags where tag_id = p_into)
  where id = p_into;
end;
$$;

revoke execute on function public.update_space_details(uuid, text, text, public.join_policy) from public, anon;
revoke execute on function public.set_space_moderator(uuid, uuid, boolean) from public, anon;
revoke execute on function public.merge_tags(uuid, uuid) from public, anon;
grant execute on function public.update_space_details(uuid, text, text, public.join_policy) to authenticated;
grant execute on function public.set_space_moderator(uuid, uuid, boolean) to authenticated;
grant execute on function public.merge_tags(uuid, uuid) to authenticated;

-- Rate limits --------------------------------------------------------------------------------------------

-- At most 10 posts and 10 replies a minute per person (stops floods and scripts).
create or replace function public.limit_posting_rate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recent int;
begin
  if tg_table_name = 'posts' then
    select count(*) into v_recent from public.posts
    where author_id = new.author_id and created_at > now() - interval '1 minute';
  else
    select count(*) into v_recent from public.replies
    where author_id = new.author_id and created_at > now() - interval '1 minute';
  end if;
  if v_recent >= 10 then
    raise exception 'You''re posting very quickly. Wait a minute and try again.' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function public.limit_posting_rate() from public, anon, authenticated;
create trigger posts_rate_limit before insert on public.posts
  for each row execute function public.limit_posting_rate();
create trigger replies_rate_limit before insert on public.replies
  for each row execute function public.limit_posting_rate();
create index if not exists posts_author_created_idx on public.posts (author_id, created_at desc);
create index if not exists replies_author_created_idx on public.replies (author_id, created_at desc);
