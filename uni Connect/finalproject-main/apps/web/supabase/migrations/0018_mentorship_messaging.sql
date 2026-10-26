-- 0018: mentorship and private messaging (Feature 4, O6, O9)
-- Mentor profiles are visible to approved members; requests,
-- conversations and messages only to the two people involved. Requests, answers and
-- conversations go through SECURITY DEFINER RPCs; messages are written directly (RLS).
-- Messages are plain text and are never indexed for search or AI.

insert into public.notification_types (type, in_app_default, email_default, email_available, locked, sort_order) values
  ('mentorship_request',  true, true,  true,  false, 90),
  ('mentorship_accepted', true, true,  true,  false, 91),
  ('mentorship_declined', true, false, false, false, 92),
  ('mentorship_ended',    true, false, false, false, 93),
  ('new_message',         true, false, false, false, 94);

-- Tables -----------------------------------------------------------------------------------

create table public.mentor_profiles (
  user_id             uuid primary key references public.profiles (id) on delete cascade,
  headline            text not null check (char_length(btrim(headline)) between 3 and 100),
  about               text not null default '' check (char_length(about) <= 1000),
  subjects            text[] not null default '{}' check (cardinality(subjects) between 1 and 8),
  skills              text[] not null default '{}' check (cardinality(skills) <= 8),
  availability_note   text check (char_length(availability_note) <= 200),
  max_active_mentees  smallint not null default 3 check (max_active_mentees between 1 and 10),
  is_accepting        boolean not null default true,
  -- Kept up to date by a trigger on mentorship_requests.
  active_mentee_count int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index mentor_profiles_subjects_idx on public.mentor_profiles using gin (subjects);

create table public.mentorship_requests (
  id              uuid primary key default gen_random_uuid(),
  mentee_id       uuid not null references public.profiles (id) on delete cascade,
  mentor_id       uuid not null references public.profiles (id) on delete cascade,
  topic           text not null check (char_length(btrim(topic)) between 3 and 100),
  message         text not null check (char_length(btrim(message)) between 30 and 500),
  status          public.mentorship_status not null default 'pending',
  response_note   text check (char_length(response_note) <= 300),
  conversation_id uuid,
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  ended_at        timestamptz,
  ended_by        uuid references public.profiles (id) on delete set null,
  check (mentee_id <> mentor_id)
);
-- One open request (or active mentorship) per pair.
create unique index mentorship_requests_open_idx on public.mentorship_requests (mentee_id, mentor_id)
  where status in ('pending', 'accepted');
create index mentorship_requests_mentor_idx on public.mentorship_requests (mentor_id, status);
create index mentorship_requests_mentee_idx on public.mentorship_requests (mentee_id, status);
create index mentorship_requests_ended_by_idx on public.mentorship_requests (ended_by);

create table public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  mentorship_request_id uuid not null unique references public.mentorship_requests (id) on delete cascade,
  created_at            timestamptz not null default now(),
  last_message_at       timestamptz not null default now()
);
alter table public.mentorship_requests
  add constraint mentorship_requests_conversation_fk
  foreign key (conversation_id) references public.conversations (id) on delete set null;
create index mentorship_requests_conversation_idx on public.mentorship_requests (conversation_id);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  -- null until they first open the conversation
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid references public.profiles (id) on delete set null,
  body            text not null default '',
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz,
  -- A deleted message keeps its place in the thread but loses its text.
  check ((deleted_at is not null and body = '')
         or (deleted_at is null and char_length(btrim(body)) between 1 and 2000))
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);

-- Helpers ------------------------------------------------------------------------------------

-- Trims, drops blanks and case-insensitive duplicates, keeps the first spelling and order.
create or replace function public.clean_text_list(p_items text[], p_max_len int)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(d.item order by d.first_pos), '{}')
  from (
    select min(s.pos) as first_pos, (array_agg(s.item order by s.pos))[1] as item
    from (
      select btrim(x) as item, pos
      from unnest(coalesce(p_items, '{}')) with ordinality as u (x, pos)
    ) s
    where s.item <> '' and char_length(s.item) <= p_max_len
    group by lower(s.item)
  ) d;
$$;

-- Used by the RLS policies below, so it reads the participants table without RLS.
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = (select auth.uid())
  );
$$;

-- Can the caller send messages here? A participant, the mentorship is still active, the
-- other person is still an approved member and neither has blocked the other.
create or replace function public.can_message(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and exists (
    select 1
    from public.conversations c
    join public.mentorship_requests r on r.id = c.mentorship_request_id
    join public.conversation_participants me
      on me.conversation_id = c.id and me.user_id = (select auth.uid())
    join public.conversation_participants other
      on other.conversation_id = c.id and other.user_id <> me.user_id
    join public.profiles op on op.id = other.user_id
    where c.id = p_conversation_id
      and r.status = 'accepted'
      and op.status = 'approved'
      and not public.is_blocked(me.user_id, other.user_id)
  );
$$;

-- Why the caller can't ask this person for mentorship (null = they can). Shown on the
-- Request button, and re-checked by request_mentorship(). Blocks are never named as such.
create or replace function public.mentor_request_block_reason(p_mentor_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_me     public.profiles%rowtype;
  v_mentor public.profiles%rowtype;
  v_mp     public.mentor_profiles%rowtype;
  v_open   public.mentorship_status;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.id is null or v_me.status <> 'approved' then
    return 'Only approved members can request mentorship';
  end if;
  if p_mentor_id = v_me.id then
    return 'This is your own mentor profile';
  end if;
  select * into v_mentor from public.profiles where id = p_mentor_id;
  select * into v_mp from public.mentor_profiles where user_id = p_mentor_id;
  if v_mentor.id is null or v_mentor.status <> 'approved' or v_mp.user_id is null then
    return 'This person isn''t mentoring at the moment';
  end if;
  if public.is_blocked(v_me.id, p_mentor_id) then
    return 'You can''t send a request to this person';
  end if;
  select r.status into v_open from public.mentorship_requests r
  where r.mentee_id = v_me.id and r.mentor_id = p_mentor_id and r.status in ('pending', 'accepted');
  if v_open = 'pending' then
    return 'Your request is waiting for an answer';
  elsif v_open = 'accepted' then
    return 'Already your mentor';
  end if;
  if v_mentor.mentorship_requests_from = 'nobody' then
    return 'Not taking requests right now';
  end if;
  if v_mentor.mentorship_requests_from = 'department'
     and v_mentor.department_id is distinct from v_me.department_id then
    return 'Only takes requests from their own department';
  end if;
  if not v_mp.is_accepting then
    return 'Not accepting new mentees right now';
  end if;
  if v_mp.active_mentee_count >= v_mp.max_active_mentees then
    return 'No free mentee places right now';
  end if;
  return null;
end;
$$;

revoke execute on function public.clean_text_list(text[], int) from public, anon;
revoke execute on function public.is_conversation_participant(uuid) from public, anon;
revoke execute on function public.can_message(uuid) from public, anon;
revoke execute on function public.mentor_request_block_reason(uuid) from public, anon;
grant execute on function public.clean_text_list(text[], int) to authenticated;
grant execute on function public.is_conversation_participant(uuid) to authenticated;
grant execute on function public.can_message(uuid) to authenticated;
grant execute on function public.mentor_request_block_reason(uuid) to authenticated;

-- Mentor profiles ------------------------------------------------------------------------------

create or replace function public.prepare_mentor_profile()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce((select year_of_study from public.profiles where id = new.user_id), -1) < 2 then
      raise exception 'Mentor profiles are for students in Year 2 or above' using errcode = '42501';
    end if;
    new.active_mentee_count := 0;
    new.created_at := now();
  end if;
  new.headline := btrim(new.headline);
  new.about := btrim(coalesce(new.about, ''));
  new.availability_note := nullif(btrim(coalesce(new.availability_note, '')), '');
  new.subjects := public.clean_text_list(new.subjects, 40);
  new.skills := public.clean_text_list(new.skills, 40);
  new.updated_at := now();
  return new;
end;
$$;
create trigger mentor_profiles_prepare before insert or update on public.mentor_profiles
  for each row execute function public.prepare_mentor_profile();

-- Turning the profile off declines the requests still waiting for an answer.
create or replace function public.mentor_profile_removed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mentees uuid[];
begin
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
create trigger mentor_profiles_removed after delete on public.mentor_profiles
  for each row execute function public.mentor_profile_removed();

-- Mentorship requests ----------------------------------------------------------------------------

create or replace function public.update_mentee_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.mentor_profiles mp
  set active_mentee_count = (
    select count(*) from public.mentorship_requests r
    where r.mentor_id = mp.user_id and r.status = 'accepted'
  )
  where mp.user_id = new.mentor_id;
  return null;
end;
$$;
create trigger mentorship_requests_count after insert or update of status on public.mentorship_requests
  for each row execute function public.update_mentee_count();

create or replace function public.request_mentorship(p_mentor_id uuid, p_topic text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user   uuid := auth.uid();
  v_reason text;
  v_id     uuid;
  v_topic  text := btrim(coalesce(p_topic, ''));
begin
  if not public.is_approved() then
    raise exception 'Only approved members can request mentorship' using errcode = '42501';
  end if;
  -- Serialise requests to the same mentor.
  perform 1 from public.mentor_profiles where user_id = p_mentor_id for update;
  v_reason := public.mentor_request_block_reason(p_mentor_id);
  if v_reason is not null then
    raise exception '%', v_reason using errcode = '22023';
  end if;
  if (select count(*) from public.mentorship_requests
      where mentee_id = v_user and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You can send up to 5 mentorship requests a day. Try again tomorrow.' using errcode = '22023';
  end if;

  insert into public.mentorship_requests (mentee_id, mentor_id, topic, message)
  values (v_user, p_mentor_id, v_topic, btrim(coalesce(p_message, '')))
  returning id into v_id;

  perform public.notify(array[p_mentor_id], 'mentorship_request',
                        public.display_name(v_user) || ' asked you to be their mentor',
                        v_topic, '/mentorship?tab=incoming', v_user, 'mentorship', v_id, true);
  return v_id;
end;
$$;

-- The mentor accepts (creating the private conversation) or declines.
create or replace function public.respond_mentorship_request(p_request_id uuid, p_accept boolean, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req  public.mentorship_requests%rowtype;
  v_mp   public.mentor_profiles%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_conv uuid;
begin
  if not public.is_approved() then
    raise exception 'Only approved members can answer requests' using errcode = '42501';
  end if;
  select * into v_req from public.mentorship_requests where id = p_request_id for update;
  if v_req.id is null or v_req.mentor_id <> auth.uid() then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request has already been answered' using errcode = '22023';
  end if;

  if p_accept then
    select * into v_mp from public.mentor_profiles where user_id = v_req.mentor_id for update;
    if v_mp.user_id is null then
      raise exception 'Turn your mentor profile back on to accept requests' using errcode = '22023';
    end if;
    if v_mp.active_mentee_count >= v_mp.max_active_mentees then
      raise exception 'You''re at your limit of % mentees. End a mentorship or raise your limit first.',
        v_mp.max_active_mentees using errcode = '22023';
    end if;
    if public.is_blocked(v_req.mentor_id, v_req.mentee_id)
       or not exists (select 1 from public.profiles where id = v_req.mentee_id and status = 'approved') then
      raise exception 'This request can''t be accepted any more' using errcode = '22023';
    end if;

    insert into public.conversations (mentorship_request_id) values (v_req.id) returning id into v_conv;
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conv, v_req.mentor_id), (v_conv, v_req.mentee_id);
    update public.mentorship_requests
    set status = 'accepted', responded_at = now(), response_note = left(v_note, 300), conversation_id = v_conv
    where id = v_req.id;

    perform public.notify(array[v_req.mentee_id], 'mentorship_accepted',
                          public.display_name(v_req.mentor_id) || ' accepted your mentorship request',
                          coalesce(left(v_note, 300), 'Say hello and tell them how they can help.'),
                          '/messages/' || v_conv, v_req.mentor_id, 'mentorship', v_req.id, true);
  else
    update public.mentorship_requests
    set status = 'declined', responded_at = now(), response_note = left(v_note, 300)
    where id = v_req.id;

    perform public.notify(array[v_req.mentee_id], 'mentorship_declined',
                          public.display_name(v_req.mentor_id) || ' can''t mentor you right now',
                          coalesce(left(v_note, 300), 'You can ask another mentor.'),
                          '/mentorship?tab=outgoing', v_req.mentor_id, 'mentorship', v_req.id);
  end if;

  -- The request notification has been dealt with.
  update public.notifications set read_at = now()
  where user_id = v_req.mentor_id and type = 'mentorship_request' and entity_id = v_req.id and read_at is null;
  return v_conv;
end;
$$;

-- The mentee withdraws a request that hasn't been answered yet.
create or replace function public.cancel_mentorship_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.mentorship_requests%rowtype;
begin
  select * into v_req from public.mentorship_requests where id = p_request_id for update;
  if v_req.id is null or v_req.mentee_id <> auth.uid() then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request has already been answered' using errcode = '22023';
  end if;
  update public.mentorship_requests set status = 'cancelled', responded_at = now() where id = v_req.id;
  delete from public.notifications
  where user_id = v_req.mentor_id and type = 'mentorship_request' and entity_id = v_req.id;
end;
$$;

-- Either person ends an active mentorship. The conversation stays readable but closes.
create or replace function public.end_mentorship(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user  uuid := auth.uid();
  v_req   public.mentorship_requests%rowtype;
  v_other uuid;
begin
  select * into v_req from public.mentorship_requests where id = p_request_id for update;
  if v_req.id is null or v_user not in (v_req.mentee_id, v_req.mentor_id) then
    raise exception 'Mentorship not found' using errcode = 'P0002';
  end if;
  if v_req.status <> 'accepted' then
    raise exception 'This mentorship isn''t active' using errcode = '22023';
  end if;
  update public.mentorship_requests
  set status = 'ended', ended_at = now(), ended_by = v_user
  where id = v_req.id;

  v_other := case when v_user = v_req.mentor_id then v_req.mentee_id else v_req.mentor_id end;
  perform public.notify(array[v_other], 'mentorship_ended',
                        public.display_name(v_user) || ' ended your mentorship',
                        'You can still read your conversation: ' || v_req.topic,
                        coalesce('/messages/' || v_req.conversation_id, '/mentorship?tab=active'),
                        v_user, 'mentorship', v_req.id);
end;
$$;

-- Blocking someone closes anything open between you, without telling them.
create or replace function public.close_mentorships_on_block()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.mentorship_requests
  set status = case when status = 'pending' then 'cancelled' else 'ended' end::public.mentorship_status,
      responded_at = case when status = 'pending' then now() else responded_at end,
      ended_at = case when status = 'accepted' then now() else ended_at end,
      ended_by = case when status = 'accepted' then new.blocker_id else ended_by end
  where status in ('pending', 'accepted')
    and ((mentee_id = new.blocker_id and mentor_id = new.blocked_id)
      or (mentee_id = new.blocked_id and mentor_id = new.blocker_id));
  delete from public.notifications
  where type = 'mentorship_request' and read_at is null
    and user_id in (new.blocker_id, new.blocked_id) and actor_id in (new.blocker_id, new.blocked_id);
  return null;
end;
$$;
create trigger user_blocks_close_mentorships after insert on public.user_blocks
  for each row execute function public.close_mentorships_on_block();

-- Messages -------------------------------------------------------------------------------------------

create or replace function public.prepare_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.messages
        where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
      raise exception 'You''re sending messages too quickly. Wait a moment and try again.' using errcode = '22023';
    end if;
    new.body := btrim(new.body);
    new.created_at := now();
    new.edited_at := null;
    new.deleted_at := null;
    return new;
  end if;

  if old.deleted_at is not null then
    raise exception 'This message was deleted' using errcode = '22023';
  end if;
  new.id := old.id;
  new.conversation_id := old.conversation_id;
  new.sender_id := old.sender_id;
  new.created_at := old.created_at;
  if new.deleted_at is not null then
    new.deleted_at := now();
    new.body := '';
    new.edited_at := old.edited_at;
  elsif new.body is distinct from old.body then
    if old.created_at < now() - interval '15 minutes' then
      raise exception 'Messages can only be edited for 15 minutes after sending' using errcode = '22023';
    end if;
    new.body := btrim(new.body);
    new.edited_at := now();
  end if;
  return new;
end;
$$;
create trigger messages_prepare before insert or update on public.messages
  for each row execute function public.prepare_message();

-- Bumps the conversation and tells the other person, one grouped notification per
-- conversation (skipped while they're reading it).
create or replace function public.message_sent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recipient uuid;
  v_last_read timestamptz;
  v_existing  uuid;
  v_name      text := public.display_name(new.sender_id);
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_participants set last_read_at = now()
  where conversation_id = new.conversation_id and user_id = new.sender_id;

  select user_id, last_read_at into v_recipient, v_last_read
  from public.conversation_participants
  where conversation_id = new.conversation_id and user_id <> new.sender_id;
  if v_recipient is null or coalesce(v_last_read > now() - interval '1 minute', false) then
    return null;
  end if;

  select id into v_existing from public.notifications
  where user_id = v_recipient and type = 'new_message' and entity_id = new.conversation_id and read_at is null
  limit 1;
  if v_existing is not null then
    update public.notifications
    set title = left(v_name || ' sent you new messages', 200), body = left(new.body, 140), created_at = now()
    where id = v_existing;
  else
    perform public.notify(array[v_recipient], 'new_message', v_name || ' sent you a message',
                          left(new.body, 140), '/messages/' || new.conversation_id, new.sender_id,
                          'conversation', new.conversation_id);
  end if;
  return null;
end;
$$;
create trigger messages_sent after insert on public.messages
  for each row execute function public.message_sent();

-- Marks the conversation read (and its message notifications).
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.conversation_participants set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = (select auth.uid());
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and type = 'new_message'
    and entity_id = p_conversation_id and read_at is null;
$$;

-- Lists (security invoker: RLS decides what's visible) -------------------------------------------------

create or replace function public.my_conversations()
returns table (
  conversation_id   uuid,
  partner_id        uuid,
  partner_name      text,
  partner_username  text,
  partner_avatar    text,
  request_id        uuid,
  topic             text,
  mentorship_status public.mentorship_status,
  i_am_mentor       boolean,
  last_message_at   timestamptz,
  last_body         text,
  last_sender_id    uuid,
  last_deleted      boolean,
  unread_count      int
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select c.id, other.user_id, pc.full_name, pc.username, pc.avatar_url,
         r.id, r.topic, r.status, r.mentor_id = me.user_id,
         c.last_message_at, lm.body, lm.sender_id, lm.deleted_at is not null,
         (select count(*)::int from public.messages m
          where m.conversation_id = c.id and m.sender_id is distinct from me.user_id
            and m.created_at > coalesce(me.last_read_at, '-infinity') and m.deleted_at is null)
  from public.conversation_participants me
  join public.conversations c on c.id = me.conversation_id
  join public.mentorship_requests r on r.id = c.mentorship_request_id
  join public.conversation_participants other
    on other.conversation_id = c.id and other.user_id <> me.user_id
  left join public.profile_cards pc on pc.id = other.user_id
  left join lateral (
    select m.body, m.sender_id, m.deleted_at from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = (select auth.uid())
  order by c.last_message_at desc;
$$;

-- Conversations with something unread (the Messages badge).
create or replace function public.unread_conversation_count()
returns int
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.conversation_participants me
  where me.user_id = (select auth.uid())
    and exists (
      select 1 from public.messages m
      where m.conversation_id = me.conversation_id and m.sender_id is distinct from me.user_id
        and m.created_at > coalesce(me.last_read_at, '-infinity') and m.deleted_at is null
    );
$$;

create or replace function public.list_mentors(
  p_query      text default null,
  p_subject    text default null,
  p_department uuid default null,
  p_year       int default null,
  p_accepting  boolean default false
)
returns table (
  user_id              uuid,
  full_name            text,
  username             text,
  avatar_url           text,
  department_id        uuid,
  department_name      text,
  year_of_study        smallint,
  headline             text,
  about                text,
  subjects             text[],
  skills               text[],
  availability_note    text,
  max_active_mentees   smallint,
  active_mentee_count  int,
  is_accepting         boolean,
  my_request_status    public.mentorship_status,
  request_block_reason text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (
    select '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
    where nullif(btrim(coalesce(p_query, '')), '') is not null
  )
  select mp.user_id, pc.full_name, pc.username, pc.avatar_url, pc.department_id, pc.department_name,
         pc.year_of_study, mp.headline, mp.about, mp.subjects, mp.skills, mp.availability_note,
         mp.max_active_mentees, mp.active_mentee_count, mp.is_accepting, mine.status,
         public.mentor_request_block_reason(mp.user_id)
  from public.mentor_profiles mp
  join public.profile_cards pc on pc.id = mp.user_id
  left join lateral (
    select r.status from public.mentorship_requests r
    where r.mentee_id = (select auth.uid()) and r.mentor_id = mp.user_id and r.status in ('pending', 'accepted')
    limit 1
  ) mine on true
  where (not exists (select 1 from q) or exists (
           select 1 from q
           where pc.full_name ilike q.pattern or mp.headline ilike q.pattern or mp.about ilike q.pattern
              or array_to_string(mp.subjects || mp.skills, ' ') ilike q.pattern))
    and (nullif(btrim(coalesce(p_subject, '')), '') is null
         or exists (select 1 from unnest(mp.subjects || mp.skills) s where lower(s) = lower(btrim(p_subject))))
    and (p_department is null or pc.department_id = p_department)
    and (p_year is null or pc.year_of_study = p_year)
    and (not p_accepting or (mp.is_accepting and mp.active_mentee_count < mp.max_active_mentees))
  order by (mp.is_accepting and mp.active_mentee_count < mp.max_active_mentees) desc, mp.updated_at desc
  limit 60;
$$;

-- The most common subjects, for the directory's filter chips.
create or replace function public.mentor_subjects(p_limit int default 16)
returns table (subject text, mentors int)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select min(s), count(*)::int
  from public.mentor_profiles mp, unnest(mp.subjects) s
  group by lower(s)
  order by count(*) desc, min(s)
  limit least(greatest(p_limit, 1), 50);
$$;

revoke execute on function public.prepare_mentor_profile() from public, anon, authenticated;
revoke execute on function public.mentor_profile_removed() from public, anon, authenticated;
revoke execute on function public.update_mentee_count() from public, anon, authenticated;
revoke execute on function public.close_mentorships_on_block() from public, anon, authenticated;
revoke execute on function public.prepare_message() from public, anon, authenticated;
revoke execute on function public.message_sent() from public, anon, authenticated;
revoke execute on function public.request_mentorship(uuid, text, text) from public, anon;
revoke execute on function public.respond_mentorship_request(uuid, boolean, text) from public, anon;
revoke execute on function public.cancel_mentorship_request(uuid) from public, anon;
revoke execute on function public.end_mentorship(uuid) from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.my_conversations() from public, anon;
revoke execute on function public.unread_conversation_count() from public, anon;
revoke execute on function public.list_mentors(text, text, uuid, int, boolean) from public, anon;
revoke execute on function public.mentor_subjects(int) from public, anon;
grant execute on function public.request_mentorship(uuid, text, text) to authenticated;
grant execute on function public.respond_mentorship_request(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_mentorship_request(uuid) to authenticated;
grant execute on function public.end_mentorship(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.unread_conversation_count() to authenticated;
grant execute on function public.list_mentors(text, text, uuid, int, boolean) to authenticated;
grant execute on function public.mentor_subjects(int) to authenticated;

-- Row-level security ----------------------------------------------------------------------------------

alter table public.mentor_profiles enable row level security;
alter table public.mentorship_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- mentor_profiles: approved members see them (minus people they've blocked or who blocked
-- them); owners manage their own.
create policy mentor_profiles_select on public.mentor_profiles
  for select to authenticated
  using ((select public.is_approved()) and not public.is_blocked((select auth.uid()), user_id));
create policy mentor_profiles_insert on public.mentor_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_approved()));
create policy mentor_profiles_update on public.mentor_profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy mentor_profiles_delete on public.mentor_profiles
  for delete to authenticated using (user_id = (select auth.uid()));

-- mentorship_requests: the two people involved. Writes go through the RPCs.
create policy mentorship_requests_select on public.mentorship_requests
  for select to authenticated
  using (mentee_id = (select auth.uid()) or mentor_id = (select auth.uid()));

-- conversations and participants: participants only. Created by respond_mentorship_request().
create policy conversations_select on public.conversations
  for select to authenticated using (public.is_conversation_participant(id));
create policy conversation_participants_select on public.conversation_participants
  for select to authenticated using (public.is_conversation_participant(conversation_id));

-- messages: participants read; you send as yourself while the mentorship is active and
-- nobody is blocked; you edit (15 minutes, enforced by the trigger) or delete your own.
create policy messages_select on public.messages
  for select to authenticated using (public.is_conversation_participant(conversation_id));
create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.can_message(conversation_id));
create policy messages_update on public.messages
  for update to authenticated
  using (sender_id = (select auth.uid()) and deleted_at is null)
  with check (sender_id = (select auth.uid()));

grant select, delete on public.mentor_profiles to authenticated;
grant insert (user_id, headline, about, subjects, skills, availability_note, max_active_mentees, is_accepting)
  on public.mentor_profiles to authenticated;
grant update (headline, about, subjects, skills, availability_note, max_active_mentees, is_accepting)
  on public.mentor_profiles to authenticated;
grant select on public.mentorship_requests, public.conversations, public.conversation_participants
  to authenticated;
grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
grant update (body, deleted_at) on public.messages to authenticated;
grant select, insert, update, delete on public.mentor_profiles, public.mentorship_requests,
  public.conversations, public.conversation_participants, public.messages to service_role;

-- Realtime: the chat thread (new, edited, deleted messages) and read markers.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_participants;
