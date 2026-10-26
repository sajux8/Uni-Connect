-- 0016: resource library, bookmarks and global search
-- Students' uploads wait for
-- a moderator; staff uploads are published straight away. Files live in a private bucket
-- and are only handed out as short-lived signed URLs after an RLS check on the resource.
-- search_all runs as the caller, so it can only ever return what they may already read.

-- Resources ---------------------------------------------------------------------------------

create table public.resources (
  id             uuid primary key default gen_random_uuid(),
  uploader_id    uuid references public.profiles (id) on delete set null,
  title          text not null check (char_length(title) between 5 and 150),
  description    text check (char_length(description) <= 1000),
  kind           public.resource_kind not null,
  file_path      text check (char_length(file_path) <= 300),
  file_name      text check (char_length(file_name) <= 200),
  file_size      bigint check (file_size between 1 and 26214400),
  mime_type      text check (char_length(mime_type) <= 120),
  url            text check (char_length(url) <= 1000 and url ~ '^https?://'),
  department_id  uuid references public.departments (id) on delete set null,
  module_code    text check (char_length(module_code) <= 20),
  space_id       uuid references public.spaces (id) on delete set null,
  status         public.review_status not null default 'pending',
  reviewed_by    uuid references public.profiles (id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text check (char_length(review_note) <= 500),
  download_count int not null default 0,
  tsv            tsvector generated always as (
                   setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
                   setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'B') ||
                   setweight(to_tsvector('simple'::regconfig, coalesce(module_code, '') || ' ' || coalesce(file_name, '')), 'C')
                 ) stored,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check ((kind = 'file' and file_path is not null and file_name is not null) or (kind = 'link' and url is not null))
);
create index resources_status_created_idx on public.resources (status, created_at desc);
create index resources_uploader_idx on public.resources (uploader_id);
create index resources_space_idx on public.resources (space_id);
create index resources_department_idx on public.resources (department_id);
create index resources_reviewed_by_idx on public.resources (reviewed_by);
create index resources_tsv_idx on public.resources using gin (tsv);
create trigger resources_set_updated_at before update on public.resources
  for each row execute function public.set_updated_at();

create table public.resource_tags (
  resource_id uuid not null references public.resources (id) on delete cascade,
  tag_id      uuid not null references public.tags (id) on delete cascade,
  primary key (resource_id, tag_id)
);
create index resource_tags_tag_idx on public.resource_tags (tag_id);

-- New notification types.
insert into public.notification_types (type, in_app_default, email_default, email_available, locked, sort_order) values
  ('resource_submitted', true, false, false, false, 80),
  ('resource_reviewed',  true, false, false, false, 81);

-- Can the caller see this resource? Approved ones like the space they belong to;
-- pending/rejected ones only to the uploader and moderators.
create or replace function public.can_view_resource(p_resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and exists (
    select 1 from public.resources r
    where r.id = p_resource_id
      and (
        r.uploader_id = auth.uid()
        or public.has_role('moderator', 'admin')
        or (r.status = 'approved' and (r.space_id is null or public.can_view_space(r.space_id)))
      )
  );
$$;
revoke execute on function public.can_view_resource(uuid) from public, anon;
grant execute on function public.can_view_resource(uuid) to authenticated;

-- Staff uploads skip review; anything a student edits goes back for review.
create or replace function public.prepare_resource()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff boolean := public.has_role('organizer', 'moderator', 'admin');
begin
  if tg_op = 'INSERT' then
    if v_staff then
      new.status := 'approved';
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    elsif auth.uid() is not null then
      new.status := 'pending';
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.review_note := null;
    end if;
  elsif auth.uid() = old.uploader_id and not v_staff
        and (new.title, new.description, new.url, new.file_path)
            is distinct from (old.title, old.description, old.url, old.file_path) then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;
create trigger resources_prepare before insert or update on public.resources
  for each row execute function public.prepare_resource();

-- Tell moderators about new submissions (grouped like account approvals).
create or replace function public.notify_resource_submitted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mods uuid[];
begin
  if new.status <> 'pending' then
    return null;
  end if;
  select coalesce(array_agg(p.id), '{}') into v_mods
  from public.profiles p where p.status = 'approved' and p.role in ('moderator', 'admin');
  perform public.notify(v_mods, 'resource_submitted',
                        public.display_name(new.uploader_id) || ' shared a resource for review',
                        new.title, '/admin/resources', new.uploader_id, 'resource', new.id);
  return null;
end;
$$;
create trigger resources_notify_submitted after insert on public.resources
  for each row execute function public.notify_resource_submitted();

-- Approve or reject (moderators/admins). Logged; the uploader is told.
create or replace function public.review_resource(p_resource_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_res  public.resources%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.has_role('moderator', 'admin') then
    raise exception 'Only moderators can review resources' using errcode = '42501';
  end if;
  if not p_approve and v_note is null then
    raise exception 'Say why it was rejected' using errcode = '22023';
  end if;
  select * into v_res from public.resources where id = p_resource_id for update;
  if v_res.id is null then
    raise exception 'Resource not found' using errcode = 'P0002';
  end if;

  update public.resources
  set status = case when p_approve then 'approved' else 'rejected' end::public.review_status,
      reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(v_note, 500)
  where id = p_resource_id;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), case when p_approve then 'approve_resource' else 'reject_resource' end::public.moderation_action_type,
          'resource', p_resource_id, v_note);

  if v_res.uploader_id is not null then
    perform public.notify(array[v_res.uploader_id], 'resource_reviewed',
      case when p_approve then 'Your resource is now live: ' else 'Your resource wasn''t approved: ' end || v_res.title,
      coalesce(v_note, case when p_approve then 'Everyone who can see it can now download it.' end),
      '/resources/' || p_resource_id, auth.uid(), 'resource', p_resource_id);
  end if;
end;
$$;

-- Counted when someone downloads or opens it (only if they can see it).
create or replace function public.record_resource_download(p_resource_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.can_view_resource(p_resource_id) then
    update public.resources set download_count = download_count + 1 where id = p_resource_id;
  end if;
end;
$$;

revoke execute on function public.prepare_resource() from public, anon, authenticated;
revoke execute on function public.notify_resource_submitted() from public, anon, authenticated;
revoke execute on function public.review_resource(uuid, boolean, text) from public, anon;
revoke execute on function public.record_resource_download(uuid) from public, anon;
grant execute on function public.review_resource(uuid, boolean, text) to authenticated;
grant execute on function public.record_resource_download(uuid) to authenticated;

alter table public.resources enable row level security;
alter table public.resource_tags enable row level security;

create policy resources_select on public.resources for select to authenticated
  using (public.can_view_resource(id));
create policy resources_insert on public.resources for insert to authenticated
  with check (
    uploader_id = (select auth.uid()) and (select public.is_approved())
    and (space_id is null or public.can_post_in_space(space_id))
    -- files must sit in the uploader's own storage folder
    and (file_path is null or split_part(file_path, '/', 1) = (select auth.uid())::text)
  );
create policy resources_update_own on public.resources for update to authenticated
  using (uploader_id = (select auth.uid()) and (select public.is_approved()))
  with check (uploader_id = (select auth.uid()));
create policy resources_delete on public.resources for delete to authenticated
  using (uploader_id = (select auth.uid()) or (select public.has_role('moderator', 'admin')));

create policy resource_tags_select on public.resource_tags for select to authenticated
  using (public.can_view_resource(resource_id));
create policy resource_tags_insert on public.resource_tags for insert to authenticated
  with check (exists (select 1 from public.resources r where r.id = resource_id and r.uploader_id = (select auth.uid())));
create policy resource_tags_delete on public.resource_tags for delete to authenticated
  using (exists (select 1 from public.resources r where r.id = resource_id and r.uploader_id = (select auth.uid())));

grant select, delete on public.resources to authenticated;
grant insert (uploader_id, title, description, kind, file_path, file_name, file_size, mime_type, url,
              department_id, module_code, space_id)
  on public.resources to authenticated;
grant update (title, description, url, department_id, module_code, space_id) on public.resources to authenticated;
grant select, insert, delete on public.resource_tags to authenticated;
grant select, insert, update, delete on public.resources, public.resource_tags to service_role;

-- Private bucket: uploads into your own folder; downloads only via signed URLs (service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resources', 'resources', false, 26214400, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png', 'image/jpeg', 'application/zip', 'application/x-zip-compressed'
])
on conflict (id) do nothing;

create policy resources_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resources' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_approved())
  );
create policy resources_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'resources' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Bookmarks --------------------------------------------------------------------------------

create table public.bookmarks (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  target_type public.bookmark_target not null,
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index bookmarks_user_created_idx on public.bookmarks (user_id, created_at desc);
create index bookmarks_target_idx on public.bookmarks (target_type, target_id);

alter table public.bookmarks enable row level security;
create policy bookmarks_select on public.bookmarks for select to authenticated using (user_id = (select auth.uid()));
create policy bookmarks_insert on public.bookmarks for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_approved()));
create policy bookmarks_delete on public.bookmarks for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.bookmarks to authenticated;
grant select, insert, update, delete on public.bookmarks to service_role;

-- Bookmarks of deleted things go too.
create or replace function public.delete_bookmarks_of()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.bookmarks where target_type = tg_argv[0]::public.bookmark_target and target_id = old.id;
  return null;
end;
$$;
revoke execute on function public.delete_bookmarks_of() from public, anon, authenticated;
create trigger posts_delete_bookmarks after delete on public.posts
  for each row execute function public.delete_bookmarks_of('post');
create trigger events_delete_bookmarks after delete on public.events
  for each row execute function public.delete_bookmarks_of('event');
create trigger announcements_delete_bookmarks after delete on public.announcements
  for each row execute function public.delete_bookmarks_of('announcement');
create trigger resources_delete_bookmarks after delete on public.resources
  for each row execute function public.delete_bookmarks_of('resource');

-- Search ------------------------------------------------------------------------------------

-- One ranked list across discussions, questions (incl. their replies), events, announcements,
-- resources and people. Security invoker: every branch is filtered by the caller's RLS.
-- Snippets mark matches with ⟦ ⟧ (the UI turns them into <mark>).
create or replace function public.search_all(
  p_query  text,
  p_types  text[] default null,     -- discussion, question, event, announcement, resource, person
  p_since  timestamptz default null,
  p_sort   text default 'relevance', -- relevance | date
  p_limit  int default 20,
  p_offset int default 0
)
returns table (
  kind       text,
  id         uuid,
  title      text,
  snippet    text,
  url        text,
  context    text,
  created_at timestamptz,
  rank       real
)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $$
  with q as (
    select websearch_to_tsquery('english', p_query) as tsq,
           'StartSel=⟦, StopSel=⟧, MaxWords=28, MinWords=12, ShortWord=2, MaxFragments=1' as opts
  ),
  hits as (
    -- posts (title/body), or posts whose replies match
    select p.type::text as kind, p.id, p.title,
           ts_headline('english', p.body_text, q.tsq, q.opts) as snippet,
           '/posts/' || p.id as url, s.name as context, p.created_at,
           ts_rank(p.tsv, q.tsq) * 1.2 as rank
    from public.posts p join public.spaces s on s.id = p.space_id, q
    where p.status = 'visible' and p.tsv @@ q.tsq
    union all
    select distinct on (p.id) p.type::text, p.id, p.title,
           ts_headline('english', r.body_text, q.tsq, q.opts),
           '/posts/' || p.id || '#reply-' || r.id, s.name, p.created_at,
           ts_rank(r.tsv, q.tsq) * 0.8
    from public.replies r join public.posts p on p.id = r.post_id join public.spaces s on s.id = p.space_id, q
    where r.status = 'visible' and p.status = 'visible' and r.tsv @@ q.tsq and not p.tsv @@ q.tsq
    union all
    select 'event', e.id, e.title, ts_headline('english', e.description_text, q.tsq, q.opts),
           '/events/' || e.id, e.organizing_unit, e.starts_at, ts_rank(e.tsv, q.tsq)
    from public.events e, q
    where e.status in ('published', 'cancelled') and e.tsv @@ q.tsq
    union all
    select 'announcement', a.id, a.title, ts_headline('english', a.body_text, q.tsq, q.opts),
           '/announcements/' || a.id, a.publishing_unit, a.published_at, ts_rank(a.tsv, q.tsq) * 1.1
    from public.announcements a, q
    where a.status = 'published' and a.tsv @@ q.tsq
    union all
    select 'resource', r.id, r.title, ts_headline('english', coalesce(r.description, r.title), q.tsq, q.opts),
           '/resources/' || r.id, coalesce(r.module_code, r.file_name, 'Link'), r.created_at, ts_rank(r.tsv, q.tsq)
    from public.resources r, q
    where r.status = 'approved' and r.tsv @@ q.tsq
    union all
    select 'person', c.id, c.full_name, coalesce(c.department_name, '') , '/u/' || c.username,
           '@' || c.username, c.created_at,
           greatest(extensions.similarity(c.full_name, p_query), extensions.similarity(c.username, p_query))
    from public.profile_cards c
    where char_length(p_query) >= 2
      and (c.full_name ilike '%' || p_query || '%' or c.username ilike '%' || p_query || '%'
           or extensions.similarity(c.full_name, p_query) > 0.3)
  )
  select h.kind, h.id, h.title, h.snippet, h.url, h.context, h.created_at, h.rank::real
  from hits h
  where (p_types is null or h.kind = any (p_types))
    and (p_since is null or h.created_at >= p_since)
  order by case when p_sort = 'date' then h.created_at end desc nulls last,
           h.rank desc, h.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
$$;
revoke execute on function public.search_all(text, text[], timestamptz, text, int, int) from public, anon;
grant execute on function public.search_all(text, text[], timestamptz, text, int, int) to authenticated;
