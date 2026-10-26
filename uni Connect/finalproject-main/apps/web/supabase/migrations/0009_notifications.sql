-- 0009: notifications, preferences and the email outbox
-- Notifications are only ever created by
-- SECURITY DEFINER code (triggers and RPCs) through notify(); users can read, mark read
-- and delete their own. Emails are queued in email_outbox and sent by /api/cron/outbox.

-- Notification types and their default delivery (labels live in src/lib/notifications.ts).
create table public.notification_types (
  type            text primary key check (type ~ '^[a-z_]{3,40}$'),
  in_app_default  boolean not null default true,
  email_default   boolean not null default false,
  -- false = this type is never emailed, so settings don't offer it
  email_available boolean not null default false,
  -- true = users can't switch it off (account decisions)
  locked          boolean not null default false,
  sort_order      smallint not null default 0
);

insert into public.notification_types (type, in_app_default, email_default, email_available, locked, sort_order) values
  ('account_approved',     true, true,  true,  true,  10),
  ('account_rejected',     true, true,  true,  true,  11),
  ('new_account_pending',  true, false, false, false, 12),
  ('announcement',         true, true,  true,  false, 20),
  ('reply_to_post',        true, false, false, false, 30),
  ('reply_to_reply',       true, false, false, false, 31),
  ('answer_accepted',      true, false, false, false, 32),
  ('new_post_in_space',    true, false, false, false, 40),
  ('new_post_with_tag',    true, false, false, false, 41),
  ('join_request',         true, false, false, false, 50),
  ('join_request_decided', true, false, false, false, 51),
  ('content_moderated',    true, true,  true,  false, 60);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null references public.notification_types (type) on update cascade,
  title       text not null check (char_length(title) <= 200),
  body        text check (char_length(body) <= 500),
  link        text check (char_length(link) <= 500 and link ~ '^/'),
  actor_id    uuid references public.profiles (id) on delete set null,
  entity_type text check (char_length(entity_type) <= 30),
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_entity_idx on public.notifications (entity_id);
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_type_idx on public.notifications (type);

-- A missing row means "use the type's defaults".
create table public.notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  type    text not null references public.notification_types (type) on update cascade on delete cascade,
  in_app  boolean not null,
  email   boolean not null,
  primary key (user_id, type)
);
create index notification_preferences_type_idx on public.notification_preferences (type);

-- Outgoing email, written by notify() and processed in batches by the app (service role only).
create table public.email_outbox (
  id         uuid primary key default gen_random_uuid(),
  to_user_id uuid references public.profiles (id) on delete cascade,
  to_email   text not null check (char_length(to_email) <= 320),
  template   text not null check (char_length(template) <= 40),
  payload    jsonb not null default '{}',
  status     public.email_status not null default 'queued',
  attempts   smallint not null default 0,
  last_error text check (char_length(last_error) <= 1000),
  send_after timestamptz not null default now(),
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);
create index email_outbox_queue_idx on public.email_outbox (send_after) where status = 'queued';
create index email_outbox_user_idx on public.email_outbox (to_user_id);

-- notify(): the single way notifications are created ------------------------------------

-- Who gets a notification of this type, and by which channels, after preferences,
-- account status, blocks and the actor themselves are taken into account.
create or replace function public.notification_recipients(
  p_user_ids   uuid[],
  p_type       text,
  p_actor_id   uuid,
  p_any_status boolean
)
returns table (user_id uuid, in_app boolean, email boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         t.locked or coalesce(np.in_app, t.in_app_default),
         t.email_available and (t.locked or coalesce(np.email, t.email_default))
  from (select distinct unnest(p_user_ids) as id) u
  join public.profiles p on p.id = u.id
  join public.notification_types t on t.type = p_type
  left join public.notification_preferences np on np.user_id = p.id and np.type = p_type
  where (p_any_status or p.status = 'approved')
    and p.id is distinct from p_actor_id
    and (p_actor_id is null or not public.is_blocked(p.id, p_actor_id));
$$;

create or replace function public.notify(
  p_user_ids      uuid[],
  p_type          text,
  p_title         text,
  p_body          text default null,
  p_link          text default null,
  p_actor_id      uuid default null,
  p_entity_type   text default null,
  p_entity_id     uuid default null,
  p_allow_email   boolean default false,
  p_email_payload jsonb default '{}',
  p_any_status    boolean default false
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    return 0;
  end if;

  insert into public.notifications (user_id, type, title, body, link, actor_id, entity_type, entity_id)
  select r.user_id, p_type, left(p_title, 200), left(p_body, 500), p_link, p_actor_id, p_entity_type, p_entity_id
  from public.notification_recipients(p_user_ids, p_type, p_actor_id, p_any_status) r
  where r.in_app;
  get diagnostics v_count = row_count;

  if p_allow_email then
    insert into public.email_outbox (to_user_id, to_email, template, payload)
    select r.user_id, u.email, p_type,
           jsonb_build_object('title', left(p_title, 200), 'body', left(p_body, 500), 'link', p_link,
                              'name', pr.full_name)
             || coalesce(p_email_payload, '{}'::jsonb)
    from public.notification_recipients(p_user_ids, p_type, p_actor_id, p_any_status) r
    join auth.users u on u.id = r.user_id
    join public.profiles pr on pr.id = r.user_id
    where r.email and u.email is not null and u.email <> '';
  end if;

  return v_count;
end;
$$;

-- Internal only: called from triggers and other SECURITY DEFINER functions.
revoke execute on function public.notification_recipients(uuid[], text, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.notify(uuid[], text, text, text, text, uuid, text, uuid, boolean, jsonb, boolean) from public, anon, authenticated;

-- Outbox processing (service role) -------------------------------------------------------

-- Claims up to p_limit queued emails. Claimed rows are pushed back by a growing delay, so
-- a crashed run is retried later; the sender marks each one sent or failed.
create or replace function public.claim_email_batch(p_limit int default 25)
returns setof public.email_outbox
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.email_outbox o
  set attempts = o.attempts + 1,
      send_after = now() + make_interval(mins => 5 * (o.attempts + 1))
  where o.id in (
    select id from public.email_outbox
    where status = 'queued' and send_after <= now() and attempts < 3
    order by created_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  )
  returning o.*;
$$;
revoke execute on function public.claim_email_batch(int) from public, anon, authenticated;
grant execute on function public.claim_email_batch(int) to service_role;

-- Housekeeping (scheduled daily in 0012): old read notifications, sent and stale emails.
create or replace function public.cleanup_notifications()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.notifications where read_at is not null and read_at < now() - interval '90 days';
  delete from public.email_outbox where status = 'sent' and sent_at < now() - interval '30 days';
  update public.email_outbox
  set status = 'failed', last_error = coalesce(last_error, 'Not sent within 7 days')
  where status = 'queued' and created_at < now() - interval '7 days';
$$;
revoke execute on function public.cleanup_notifications() from public, anon, authenticated;

-- Mark everything read in one statement (the bell and /notifications).
create or replace function public.mark_all_notifications_read()
returns int
language sql
security invoker
set search_path = public, pg_temp
as $$
  with updated as (
    update public.notifications set read_at = now()
    where user_id = (select auth.uid()) and read_at is null
    returning 1
  )
  select count(*)::int from updated;
$$;
revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Row-level security ---------------------------------------------------------------------

alter table public.notification_types enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.email_outbox enable row level security;

create policy notification_types_select on public.notification_types
  for select to authenticated using (true);

create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not exists (select 1 from public.notification_types t where t.type = notification_preferences.type and t.locked)
  );
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and not exists (select 1 from public.notification_types t where t.type = notification_preferences.type and t.locked)
  );
create policy notification_preferences_delete_own on public.notification_preferences
  for delete to authenticated using (user_id = (select auth.uid()));

-- email_outbox: no policies, so only the service role can touch it.

-- Grants (no default privileges in this project; see 0004) --------------------------------

grant select on public.notification_types to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;

grant select, insert, update, delete on public.notification_types, public.notifications,
  public.notification_preferences, public.email_outbox to service_role;

-- Realtime: the bell listens for the user's own new notifications.
alter publication supabase_realtime add table public.notifications;
