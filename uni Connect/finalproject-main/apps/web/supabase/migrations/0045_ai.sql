-- 0045: AI features (M8).
--
-- * `content_chunks` is the search index for Ask AI: pieces of posts, replies, announcements,
--   events and resources with a 768-dimension embedding. A member can read a chunk only if they can
--   read its source: the select policy looks the source up, so each source table's own RLS decides
--   (private spaces, departments, batches, hidden content, pending events…). Private messages,
--   profiles, tickets and feedback answers are never indexed.
-- * Changed content is queued by triggers (`ai_index_queue`); the app embeds it with the service
--   role (after content actions, after AI requests, and from /api/cron/reindex). Deleted sources
--   lose their chunks at once.
-- * `match_chunks` runs as the caller (RLS applies). No approximate index yet: at this size an
--   exact scan takes milliseconds and never misses rows that RLS would have allowed. Add HNSW when
--   the table passes ~50k chunks.
-- * `ai_summaries` (threads) and `ai_form_summaries` (written feedback answers) cache generated
--   summaries; `ai_usage` counts each member's AI requests per campus day.

create table public.content_chunks (
  id           uuid primary key default gen_random_uuid(),
  source_type  text not null check (source_type in ('post', 'reply', 'announcement', 'event', 'resource')),
  source_id    uuid not null,
  -- The post a reply belongs to (for links and for grouping a thread's chunks).
  parent_id    uuid,
  chunk_index  smallint not null,
  title        text not null,
  content      text not null,
  content_hash text not null,
  embedding    extensions.vector(768) not null,
  source_date  timestamptz,
  updated_at   timestamptz not null default now(),
  unique (source_type, source_id, chunk_index)
);
create index content_chunks_source_idx on public.content_chunks (source_type, source_id);
create index content_chunks_parent_idx on public.content_chunks (parent_id);

alter table public.content_chunks enable row level security;
grant select on public.content_chunks to authenticated;
grant select, insert, update, delete on public.content_chunks to service_role;

create policy content_chunks_select on public.content_chunks for select to authenticated
  using (
    (source_type = 'post' and exists (
      select 1 from public.posts p where p.id = content_chunks.source_id and p.status = 'visible'))
    or (source_type = 'reply' and exists (
      select 1 from public.replies r where r.id = content_chunks.source_id and r.status = 'visible'))
    or (source_type = 'announcement' and exists (
      select 1 from public.announcements a where a.id = content_chunks.source_id and a.status = 'published'))
    or (source_type = 'event' and exists (
      select 1 from public.events e where e.id = content_chunks.source_id and e.status in ('published', 'cancelled')))
    or (source_type = 'resource' and exists (
      select 1 from public.resources r where r.id = content_chunks.source_id and r.status = 'approved'))
  );

-- Closest chunks to a question, among the ones the caller may read.
create or replace function public.match_chunks(
  p_embedding extensions.vector(768),
  p_count     integer default 20,
  p_types     text[] default null
)
returns table (
  id          uuid,
  source_type text,
  source_id   uuid,
  parent_id   uuid,
  chunk_index smallint,
  title       text,
  content     text,
  source_date timestamptz,
  similarity  double precision
)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $$
  select c.id, c.source_type, c.source_id, c.parent_id, c.chunk_index, c.title, c.content, c.source_date,
         1 - (c.embedding <=> p_embedding) as similarity
  from public.content_chunks c
  where p_types is null or c.source_type = any (p_types)
  order by c.embedding <=> p_embedding
  limit least(greatest(p_count, 1), 50);
$$;

-- Questions similar to a draft (by embedding) or to an existing post (by its first chunk).
create or replace function public.related_questions(
  p_embedding extensions.vector(768),
  p_exclude   uuid default null,
  p_count     integer default 5
)
returns table (post_id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $$
  select x.post_id, max(x.similarity) as similarity
  from (
    select c.source_id as post_id, 1 - (c.embedding <=> p_embedding) as similarity
    from public.content_chunks c
    join public.posts p on p.id = c.source_id and p.type = 'question' and p.status = 'visible'
    where c.source_type = 'post' and c.source_id is distinct from p_exclude
    order by c.embedding <=> p_embedding
    limit 40
  ) x
  group by x.post_id
  order by similarity desc
  limit least(greatest(p_count, 1), 10);
$$;

create or replace function public.related_to_post(p_post_id uuid, p_count integer default 5)
returns table (post_id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $$
  select r.post_id, r.similarity
  from public.content_chunks c,
       lateral public.related_questions(c.embedding, p_post_id, p_count) r
  where c.source_type = 'post' and c.source_id = p_post_id and c.chunk_index = 0;
$$;

-- Indexing queue ---------------------------------------------------------------------------------

create table public.ai_index_queue (
  source_type text not null,
  source_id   uuid not null,
  queued_at   timestamptz not null default now(),
  primary key (source_type, source_id)
);
alter table public.ai_index_queue enable row level security;
grant select, insert, update, delete on public.ai_index_queue to service_role;

create or replace function public.queue_ai_index()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.content_chunks where source_type = tg_argv[0] and source_id = old.id;
    delete from public.ai_index_queue where source_type = tg_argv[0] and source_id = old.id;
    return null;
  end if;
  insert into public.ai_index_queue (source_type, source_id) values (tg_argv[0], new.id)
  on conflict (source_type, source_id) do update set queued_at = now();
  return null;
end;
$$;
revoke execute on function public.queue_ai_index() from public, anon, authenticated;

create trigger posts_ai_index after insert or delete
  or update of title, body_text, status, type, space_id, accepted_reply_id on public.posts
  for each row execute function public.queue_ai_index('post');
create trigger replies_ai_index after insert or delete or update of body_text, status on public.replies
  for each row execute function public.queue_ai_index('reply');
create trigger announcements_ai_index after insert or delete
  or update of title, body_text, status, publish_at, publishing_unit on public.announcements
  for each row execute function public.queue_ai_index('announcement');
create trigger events_ai_index after insert or delete
  or update of title, description_text, status, starts_at, ends_at, venue, registration_deadline, space_id,
    eligibility_note, cancel_reason on public.events
  for each row execute function public.queue_ai_index('event');
create trigger resources_ai_index after insert or delete
  or update of title, description, status, module_code, space_id on public.resources
  for each row execute function public.queue_ai_index('resource');

-- Hands the app the oldest queued sources and removes them from the queue (service role).
create or replace function public.claim_ai_index_batch(p_limit integer default 50)
returns table (source_type text, source_id uuid)
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.ai_index_queue q
  where (q.source_type, q.source_id) in (
    select i.source_type, i.source_id from public.ai_index_queue i
    order by i.queued_at
    limit least(greatest(p_limit, 1), 200)
    for update skip locked
  )
  returning q.source_type, q.source_id;
$$;
revoke execute on function public.claim_ai_index_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_ai_index_batch(integer) to service_role;

-- Everything already on the platform gets indexed on the first run.
insert into public.ai_index_queue (source_type, source_id)
select 'post', id from public.posts where status = 'visible'
union all select 'reply', id from public.replies where status = 'visible'
union all select 'announcement', id from public.announcements where status = 'published'
union all select 'event', id from public.events where status in ('published', 'cancelled')
union all select 'resource', id from public.resources where status = 'approved'
on conflict do nothing;

-- Ask the app to index queued content (pg_cron, like the email outbox in 0012).
create or replace function public.request_reindex_run()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (select 1 from public.ai_index_queue) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/api/cron/reindex',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function public.request_reindex_run() from public, anon, authenticated;
select cron.schedule('ai-reindex', '*/5 * * * *', 'select public.request_reindex_run()');

-- Summaries --------------------------------------------------------------------------------------

create table public.ai_summaries (
  post_id                    uuid primary key references public.posts (id) on delete cascade,
  summary                    jsonb not null,
  reply_count_at_generation  integer not null,
  model                      text not null,
  generated_at               timestamptz not null default now()
);
alter table public.ai_summaries enable row level security;
grant select on public.ai_summaries to authenticated;
grant select, insert, update, delete on public.ai_summaries to service_role;
create policy ai_summaries_select on public.ai_summaries for select to authenticated
  using (exists (select 1 from public.posts p where p.id = ai_summaries.post_id and p.status = 'visible'));

-- Summary of a feedback form's written answers, for the people who can see its results (0041).
create table public.ai_form_summaries (
  form_id      uuid primary key references public.forms (id) on delete cascade,
  summary      jsonb not null,
  answer_count integer not null,
  model        text not null,
  generated_at timestamptz not null default now()
);
alter table public.ai_form_summaries enable row level security;
grant select on public.ai_form_summaries to authenticated;
grant select, insert, update, delete on public.ai_form_summaries to service_role;
create policy ai_form_summaries_select on public.ai_form_summaries for select to authenticated
  using (public.can_see_form_results(form_id));

-- Usage ------------------------------------------------------------------------------------------

create table public.ai_usage (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  day           date not null,
  ask_count     integer not null default 0,
  summary_count integer not null default 0,
  related_count integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
grant select on public.ai_usage to authenticated;
grant select, insert, update, delete on public.ai_usage to service_role;
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Counts one AI request for the caller today (campus time). Returns how many are left after it, or
-- -1 when the limit was already reached (nothing is counted then).
create or replace function public.consume_ai_quota(p_kind text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day date := (now() at time zone 'Asia/Colombo')::date;
  v_used integer;
begin
  if not public.is_approved() then
    raise exception 'Only approved members can use AI features' using errcode = '42501';
  end if;
  if p_kind not in ('ask', 'summary', 'related') then
    raise exception 'Unknown kind' using errcode = '22023';
  end if;
  insert into public.ai_usage (user_id, day) values (auth.uid(), v_day) on conflict do nothing;
  update public.ai_usage
  set ask_count = ask_count + (p_kind = 'ask')::integer,
      summary_count = summary_count + (p_kind = 'summary')::integer,
      related_count = related_count + (p_kind = 'related')::integer
  where user_id = auth.uid() and day = v_day
    and (case p_kind when 'ask' then ask_count when 'summary' then summary_count else related_count end) < p_limit
  returning (case p_kind when 'ask' then ask_count when 'summary' then summary_count else related_count end)
  into v_used;
  if v_used is null then
    return -1;
  end if;
  return greatest(p_limit - v_used, 0);
end;
$$;

revoke execute on function public.match_chunks(extensions.vector, integer, text[]) from public, anon;
revoke execute on function public.related_questions(extensions.vector, uuid, integer) from public, anon;
revoke execute on function public.related_to_post(uuid, integer) from public, anon;
revoke execute on function public.consume_ai_quota(text, integer) from public, anon;
grant execute on function public.match_chunks(extensions.vector, integer, text[]),
  public.related_questions(extensions.vector, uuid, integer), public.related_to_post(uuid, integer),
  public.consume_ai_quota(text, integer)
  to authenticated;
