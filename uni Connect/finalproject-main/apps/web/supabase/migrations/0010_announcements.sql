-- 0010: official announcements and read receipts
-- Every approved member can read published
-- announcements; targeting (departments and years) decides who is *notified* and what
-- shows under "For me". Only organizers and admins publish. Publishing (now, or later via
-- the scheduler in 0012) fans out notifications once, and emails the audience if important.

create table public.announcements (
  id                      uuid primary key default gen_random_uuid(),
  publisher_id            uuid references public.profiles (id) on delete set null,
  title                   text not null check (char_length(title) between 5 and 150),
  body_html               text not null check (char_length(body_html) <= 40000),
  body_text               text not null check (char_length(body_text) between 1 and 20000),
  category                public.announcement_category not null default 'general',
  publishing_unit         text not null check (char_length(publishing_unit) between 2 and 60),
  audience_all            boolean not null default true,
  audience_department_ids uuid[] not null default '{}' check (cardinality(audience_department_ids) <= 20),
  audience_years          smallint[] not null default '{}'
                            check (cardinality(audience_years) <= 6 and audience_years <@ array[0, 1, 2, 3, 4, 5]::smallint[]),
  is_pinned               boolean not null default false,
  pinned_until            timestamptz,
  is_important            boolean not null default false,
  status                  public.publish_status not null default 'draft',
  publish_at              timestamptz,
  -- Set once, the first time it goes live (drives the one-off notification fan-out).
  published_at            timestamptz,
  edited_at               timestamptz,
  tsv                     tsvector generated always as (
                            setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
                            setweight(to_tsvector('english'::regconfig, coalesce(body_text, '')), 'B')
                          ) stored,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (status <> 'scheduled' or publish_at is not null),
  check (audience_all or cardinality(audience_department_ids) > 0 or cardinality(audience_years) > 0)
);
create index announcements_feed_idx on public.announcements (status, published_at desc);
create index announcements_pinned_idx on public.announcements (is_pinned) where is_pinned;
create index announcements_scheduled_idx on public.announcements (publish_at) where status = 'scheduled';
create index announcements_publisher_idx on public.announcements (publisher_id);
create index announcements_tsv_idx on public.announcements using gin (tsv);
create trigger announcements_set_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
create index announcement_reads_user_idx on public.announcement_reads (user_id);

-- Targeting ---------------------------------------------------------------------------------

-- Does an audience (all / departments / years) include someone in p_department, p_year?
-- Departments and years combine with AND; an empty list means "any".
create or replace function public.audience_includes(
  p_all boolean, p_departments uuid[], p_years smallint[], p_department uuid, p_year smallint
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_all or (
    (cardinality(p_departments) = 0 or p_department = any (p_departments))
    and (cardinality(p_years) = 0 or p_year = any (p_years))
  );
$$;

-- Is this announcement aimed at the caller? (the "For me" filter and the unread badge)
create or replace function public.announcement_for_me(a public.announcements)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce((
    select public.audience_includes(a.audience_all, a.audience_department_ids, a.audience_years,
                                    p.department_id, p.year_of_study)
    from public.profiles p where p.id = (select auth.uid())
  ), false);
$$;

-- Lifecycle ----------------------------------------------------------------------------------

create or replace function public.prepare_announcement()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'published' then
    new.publish_at := coalesce(new.publish_at, now());
    if new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  if not new.is_pinned then
    new.pinned_until := null;
  end if;
  return new;
end;
$$;
create trigger announcements_prepare before insert or update on public.announcements
  for each row execute function public.prepare_announcement();

-- Notify the audience, once, when an announcement first goes live.
create or replace function public.fan_out_announcement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recipients uuid[];
begin
  select coalesce(array_agg(p.id), '{}') into v_recipients
  from public.profiles p
  where p.status = 'approved'
    and public.audience_includes(new.audience_all, new.audience_department_ids, new.audience_years,
                                 p.department_id, p.year_of_study);

  perform public.notify(
    v_recipients,
    'announcement',
    new.title,
    new.publishing_unit || ' · ' || left(new.body_text, 200),
    '/announcements/' || new.id,
    new.publisher_id,
    'announcement',
    new.id,
    new.is_important,
    jsonb_build_object('unit', new.publishing_unit, 'category', new.category, 'important', new.is_important,
                       'excerpt', left(new.body_text, 600))
  );
  return null;
end;
$$;
create trigger announcements_fan_out_insert after insert on public.announcements
  for each row when (new.published_at is not null)
  execute function public.fan_out_announcement();
create trigger announcements_fan_out_update after update on public.announcements
  for each row when (old.published_at is null and new.published_at is not null)
  execute function public.fan_out_announcement();

-- Scheduler jobs (scheduled with pg_cron in 0012).
create or replace function public.publish_scheduled_announcements()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  update public.announcements set status = 'published'
  where status = 'scheduled' and publish_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.unpin_expired_announcements()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  update public.announcements set is_pinned = false
  where is_pinned and pinned_until is not null and pinned_until < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.prepare_announcement() from public, anon, authenticated;
revoke execute on function public.fan_out_announcement() from public, anon, authenticated;
revoke execute on function public.publish_scheduled_announcements() from public, anon, authenticated;
revoke execute on function public.unpin_expired_announcements() from public, anon, authenticated;
revoke execute on function public.audience_includes(boolean, uuid[], smallint[], uuid, smallint) from public, anon;
revoke execute on function public.announcement_for_me(public.announcements) from public, anon;
grant execute on function public.audience_includes(boolean, uuid[], smallint[], uuid, smallint) to authenticated;
grant execute on function public.announcement_for_me(public.announcements) to authenticated;

-- Reading -------------------------------------------------------------------------------------

-- The /announcements list: published announcements with the publisher, whether the caller
-- has read each one and whether it's aimed at them. Security invoker: RLS still applies.
create or replace function public.list_announcements(
  p_scope    text default 'all',          -- all | for_me | unread
  p_category public.announcement_category default null,
  p_limit    int default 20,
  p_offset   int default 0
)
returns table (
  id uuid,
  title text,
  excerpt text,
  category public.announcement_category,
  publishing_unit text,
  audience_all boolean,
  audience_department_ids uuid[],
  audience_years smallint[],
  is_pinned boolean,
  is_important boolean,
  published_at timestamptz,
  edited_at timestamptz,
  publisher_id uuid,
  publisher_name text,
  publisher_role public.user_role,
  is_read boolean,
  for_me boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select a.id, a.title, left(a.body_text, 280), a.category, a.publishing_unit, a.audience_all,
         a.audience_department_ids, a.audience_years,
         a.is_pinned and (a.pinned_until is null or a.pinned_until > now()),
         a.is_important, a.published_at, a.edited_at, a.publisher_id, p.full_name, p.role,
         r.user_id is not null, public.announcement_for_me(a)
  from public.announcements a
  left join public.profiles p on p.id = a.publisher_id
  left join public.announcement_reads r on r.announcement_id = a.id and r.user_id = (select auth.uid())
  where a.status = 'published'
    and (p_category is null or a.category = p_category)
    and (p_scope <> 'for_me' or public.announcement_for_me(a))
    and (p_scope <> 'unread' or (r.user_id is null and public.announcement_for_me(a)))
  order by a.published_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;
revoke execute on function public.list_announcements(text, public.announcement_category, int, int) from public, anon;
grant execute on function public.list_announcements(text, public.announcement_category, int, int) to authenticated;

-- Unread announcements aimed at the caller from the last 30 days (sidebar badge).
-- Announcements from before the caller joined don't count.
create or replace function public.unread_announcement_count()
returns int
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.announcements a
  where a.status = 'published'
    and a.published_at > greatest(
      now() - interval '30 days',
      coalesce((select p.approved_at from public.profiles p where p.id = (select auth.uid())), now())
    )
    and public.announcement_for_me(a)
    and not exists (
      select 1 from public.announcement_reads r where r.announcement_id = a.id and r.user_id = (select auth.uid())
    );
$$;
revoke execute on function public.unread_announcement_count() from public, anon;
grant execute on function public.unread_announcement_count() to authenticated;

-- Marks every published announcement read for the caller (and their announcement notifications).
create or replace function public.mark_all_announcements_read()
returns int
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  insert into public.announcement_reads (announcement_id, user_id)
  select a.id, (select auth.uid()) from public.announcements a
  where a.status = 'published'
  on conflict do nothing;
  get diagnostics v_count = row_count;

  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and type = 'announcement' and read_at is null;
  return v_count;
end;
$$;
revoke execute on function public.mark_all_announcements_read() from public, anon;
grant execute on function public.mark_all_announcements_read() to authenticated;

-- Row-level security ----------------------------------------------------------------------------

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- Published: every approved member. Drafts/scheduled/archived: the publisher and admins.
create policy announcements_select on public.announcements for select to authenticated
  using (
    (select public.is_approved())
    and (status = 'published' or publisher_id = (select auth.uid()) or (select public.has_role('admin')))
  );
create policy announcements_insert on public.announcements for insert to authenticated
  with check (publisher_id = (select auth.uid()) and (select public.has_role('organizer', 'admin')));
create policy announcements_update on public.announcements for update to authenticated
  using (
    (publisher_id = (select auth.uid()) and (select public.has_role('organizer', 'admin')))
    or (select public.has_role('admin'))
  )
  with check (
    (publisher_id = (select auth.uid()) and (select public.has_role('organizer', 'admin')))
    or (select public.has_role('admin'))
  );
-- Admins delete anything; publishers only what never went live.
create policy announcements_delete on public.announcements for delete to authenticated
  using (
    (select public.has_role('admin'))
    or (publisher_id = (select auth.uid()) and published_at is null and (select public.has_role('organizer', 'admin')))
  );

create policy announcement_reads_select on public.announcement_reads for select to authenticated
  using (user_id = (select auth.uid()));
create policy announcement_reads_insert on public.announcement_reads for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.announcements a where a.id = announcement_id and a.status = 'published')
  );

-- Grants (no default privileges in this project; see 0004) -----------------------------------

grant select, delete on public.announcements to authenticated;
grant insert (publisher_id, title, body_html, body_text, category, publishing_unit, audience_all,
              audience_department_ids, audience_years, is_pinned, pinned_until, is_important, status, publish_at)
  on public.announcements to authenticated;
grant update (title, body_html, body_text, category, publishing_unit, audience_all, audience_department_ids,
              audience_years, is_pinned, pinned_until, is_important, status, publish_at, edited_at)
  on public.announcements to authenticated;
grant select, insert on public.announcement_reads to authenticated;

grant select, insert, update, delete on public.announcements, public.announcement_reads to service_role;
