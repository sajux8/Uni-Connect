-- 0006: community — spaces, membership, tags, posts, replies, votes, follows
-- Every table: RLS + explicit grants.
-- Visibility model: space rows (name, description) are visible to every approved member so
-- private spaces can be discovered; their *content* is visible only to active members.

-- Tables ---------------------------------------------------------------------------

create table public.spaces (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name          text not null check (char_length(name) between 2 and 60),
  description   text check (char_length(description) <= 500),
  type          public.space_type not null,
  department_id uuid references public.departments (id) on delete set null,
  year_of_study smallint check (year_of_study between 0 and 5),
  module_code   text check (char_length(module_code) <= 20),
  icon          text check (char_length(icon) <= 40),
  join_policy   public.join_policy not null default 'open',
  rules         text check (char_length(rules) <= 4000),
  is_archived   boolean not null default false,
  member_count  int not null default 0,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index spaces_type_idx on public.spaces (type) where not is_archived;
create index spaces_department_idx on public.spaces (department_id);
create index spaces_created_by_idx on public.spaces (created_by);
create trigger spaces_set_updated_at before update on public.spaces
  for each row execute function public.set_updated_at();

create table public.space_members (
  space_id     uuid not null references public.spaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.member_role not null default 'member',
  status       public.member_status not null default 'active',
  notify_level public.notify_level not null default 'important',
  joined_at    timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index space_members_user_idx on public.space_members (user_id, status);

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  name        extensions.citext not null unique check (char_length(name) between 2 and 30),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 200),
  usage_count int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.tag_follows (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  tag_id     uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tag_id)
);
create index tag_follows_tag_idx on public.tag_follows (tag_id);

create table public.posts (
  id                uuid primary key default gen_random_uuid(),
  space_id          uuid not null references public.spaces (id) on delete cascade,
  author_id         uuid references public.profiles (id) on delete set null,
  type              public.post_type not null,
  title             text not null check (char_length(title) between 10 and 150),
  body_html         text not null check (char_length(body_html) <= 40000),
  body_text         text not null check (char_length(body_text) <= 20000),
  accepted_reply_id uuid,
  is_pinned         boolean not null default false,
  is_locked         boolean not null default false,
  status            public.content_status not null default 'visible',
  reply_count       int not null default 0,
  helpful_count     int not null default 0,
  vote_score        int not null default 0,
  last_activity_at  timestamptz not null default now(),
  edited_at         timestamptz,
  tsv               tsvector generated always as (
                      setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
                      setweight(to_tsvector('english'::regconfig, coalesce(body_text, '')), 'B')
                    ) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index posts_tsv_idx on public.posts using gin (tsv);
create index posts_space_activity_idx on public.posts (space_id, status, last_activity_at desc);
create index posts_activity_idx on public.posts (status, last_activity_at desc);
create index posts_unanswered_idx on public.posts (type, accepted_reply_id) where type = 'question';
create index posts_author_idx on public.posts (author_id);
create trigger posts_set_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create table public.post_tags (
  post_id uuid not null references public.posts (id) on delete cascade,
  tag_id  uuid not null references public.tags (id) on delete cascade,
  primary key (post_id, tag_id)
);
create index post_tags_tag_idx on public.post_tags (tag_id);

create table public.post_follows (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index post_follows_post_idx on public.post_follows (post_id);

create table public.replies (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.posts (id) on delete cascade,
  author_id       uuid references public.profiles (id) on delete set null,
  parent_reply_id uuid references public.replies (id) on delete cascade,
  body_html       text not null check (char_length(body_html) <= 20000),
  body_text       text not null check (char_length(body_text) between 1 and 10000),
  status          public.content_status not null default 'visible',
  helpful_count   int not null default 0,
  edited_at       timestamptz,
  tsv             tsvector generated always as (to_tsvector('english'::regconfig, coalesce(body_text, ''))) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index replies_post_idx on public.replies (post_id, created_at);
create index replies_author_idx on public.replies (author_id);
create index replies_parent_idx on public.replies (parent_reply_id);
create index replies_tsv_idx on public.replies using gin (tsv);
create trigger replies_set_updated_at before update on public.replies
  for each row execute function public.set_updated_at();

alter table public.posts
  add constraint posts_accepted_reply_fkey foreign key (accepted_reply_id) references public.replies (id) on delete set null;
create index posts_accepted_reply_idx on public.posts (accepted_reply_id);

create table public.reply_votes (
  reply_id   uuid not null references public.replies (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);
create index reply_votes_user_idx on public.reply_votes (user_id);

create table public.post_votes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  value      smallint not null default 1 check (value = 1),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_votes_user_idx on public.post_votes (user_id);

-- Access helpers ----------------------------------------------------------------------

create or replace function public.is_space_moderator(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('moderator', 'admin')
      or (
        public.is_approved()
        and exists (
          select 1 from public.space_members m
          where m.space_id = p_space_id and m.user_id = auth.uid()
            and m.role = 'moderator' and m.status = 'active'
        )
      );
$$;

-- Can the caller read this space's content?
create or replace function public.can_view_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and exists (
    select 1 from public.spaces s
    where s.id = p_space_id
      and (not s.is_archived or public.has_role('admin'))
      and (
        s.join_policy = 'open'
        or public.has_role('moderator', 'admin')
        or exists (
          select 1 from public.space_members m
          where m.space_id = s.id and m.user_id = auth.uid() and m.status = 'active'
        )
      )
  );
$$;

-- Can the caller post or reply here? (active member of a live space)
create or replace function public.can_post_in_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and exists (
    select 1 from public.spaces s
    join public.space_members m on m.space_id = s.id
    where s.id = p_space_id and not s.is_archived
      and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

-- Is this post's content visible to the caller? (used by child tables' policies)
create or replace function public.can_view_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id
      and public.can_view_space(p.space_id)
      and (p.status = 'visible' or p.author_id = auth.uid() or public.is_space_moderator(p.space_id))
  );
$$;

revoke execute on function public.is_space_moderator(uuid) from public, anon;
revoke execute on function public.can_view_space(uuid) from public, anon;
revoke execute on function public.can_post_in_space(uuid) from public, anon;
revoke execute on function public.can_view_post(uuid) from public, anon;
grant execute on function public.is_space_moderator(uuid) to authenticated;
grant execute on function public.can_view_space(uuid) to authenticated;
grant execute on function public.can_post_in_space(uuid) to authenticated;
grant execute on function public.can_view_post(uuid) to authenticated;

-- Integrity triggers --------------------------------------------------------------------

-- Replies nest one level only, and a child must belong to the same post.
create or replace function public.check_reply_parent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_parent public.replies%rowtype;
begin
  if new.parent_reply_id is null then
    return new;
  end if;
  select * into v_parent from public.replies where id = new.parent_reply_id;
  if not found or v_parent.post_id <> new.post_id then
    raise exception 'The reply you are answering is not in this thread' using errcode = '22023';
  end if;
  if v_parent.parent_reply_id is not null then
    new.parent_reply_id := v_parent.parent_reply_id; -- flatten to one level
  end if;
  return new;
end;
$$;
create trigger replies_check_parent before insert on public.replies
  for each row execute function public.check_reply_parent();

create or replace function public.prevent_self_reply_vote()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.replies where id = new.reply_id and author_id = new.user_id) then
    raise exception 'You cannot mark your own reply as helpful' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger reply_votes_no_self before insert on public.reply_votes
  for each row execute function public.prevent_self_reply_vote();

create or replace function public.prevent_self_post_vote()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.posts where id = new.post_id and author_id = new.user_id) then
    raise exception 'You cannot vote on your own post' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger post_votes_no_self before insert on public.post_votes
  for each row execute function public.prevent_self_post_vote();

-- Counters (SECURITY DEFINER: they update rows the voter/replier can't write) -----------

create or replace function public.update_member_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.spaces s
  set member_count = (select count(*) from public.space_members m where m.space_id = s.id and m.status = 'active')
  where s.id = coalesce(new.space_id, old.space_id);
  return null;
end;
$$;
create trigger space_members_count after insert or update of status or delete on public.space_members
  for each row execute function public.update_member_count();

create or replace function public.update_post_reply_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post uuid := coalesce(new.post_id, old.post_id);
begin
  update public.posts p
  set reply_count = (select count(*) from public.replies r where r.post_id = p.id and r.status = 'visible'),
      helpful_count = (select coalesce(sum(r.helpful_count), 0) from public.replies r where r.post_id = p.id and r.status = 'visible'),
      last_activity_at = case when tg_op = 'INSERT' then now() else p.last_activity_at end
  where p.id = v_post;
  return null;
end;
$$;
create trigger replies_stats after insert or update of status, helpful_count or delete on public.replies
  for each row execute function public.update_post_reply_stats();

create or replace function public.update_reply_helpful_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.replies r
  set helpful_count = (select count(*) from public.reply_votes v where v.reply_id = r.id)
  where r.id = coalesce(new.reply_id, old.reply_id);
  return null;
end;
$$;
create trigger reply_votes_count after insert or delete on public.reply_votes
  for each row execute function public.update_reply_helpful_count();

create or replace function public.update_post_vote_score()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.posts p
  set vote_score = (select coalesce(sum(v.value), 0) from public.post_votes v where v.post_id = p.id)
  where p.id = coalesce(new.post_id, old.post_id);
  return null;
end;
$$;
create trigger post_votes_score after insert or delete on public.post_votes
  for each row execute function public.update_post_vote_score();

create or replace function public.update_tag_usage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.tags t
  set usage_count = (select count(*) from public.post_tags pt where pt.tag_id = t.id)
  where t.id = coalesce(new.tag_id, old.tag_id);
  return null;
end;
$$;
create trigger post_tags_usage after insert or delete on public.post_tags
  for each row execute function public.update_tag_usage();

-- The author follows their own thread (notifications arrive in M3).
create or replace function public.follow_own_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.author_id is not null then
    insert into public.post_follows (user_id, post_id) values (new.author_id, new.id) on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger posts_follow_own after insert on public.posts
  for each row execute function public.follow_own_post();

-- RPCs: actions that need checks across tables ---------------------------------------

-- Accept (or un-accept) an answer. Question author or space moderator only.
create or replace function public.accept_reply(p_reply_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reply public.replies%rowtype;
  v_post  public.posts%rowtype;
begin
  select * into v_reply from public.replies where id = p_reply_id and status = 'visible';
  if not found then
    raise exception 'Reply not found' using errcode = 'P0002';
  end if;
  select * into v_post from public.posts where id = v_reply.post_id for update;
  if v_post.type <> 'question' then
    raise exception 'Only questions have accepted answers' using errcode = '22023';
  end if;
  if not (v_post.author_id = auth.uid() and public.is_approved()) and not public.is_space_moderator(v_post.space_id) then
    raise exception 'Only the person who asked can accept an answer' using errcode = '42501';
  end if;

  update public.posts
  set accepted_reply_id = case when accepted_reply_id = p_reply_id then null else p_reply_id end
  where id = v_post.id;
  return case when v_post.accepted_reply_id = p_reply_id then null else p_reply_id end;
end;
$$;

-- Soft-delete your own post or reply (moderators can too). Keeps the thread readable.
create or replace function public.delete_content(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_author uuid;
  v_space  uuid;
begin
  if p_kind = 'post' then
    select author_id, space_id into v_author, v_space from public.posts where id = p_id;
  elsif p_kind = 'reply' then
    select r.author_id, p.space_id into v_author, v_space
    from public.replies r join public.posts p on p.id = r.post_id where r.id = p_id;
  else
    raise exception 'Unknown content type' using errcode = '22023';
  end if;
  if v_space is null then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  if not ((v_author = auth.uid() and public.is_approved()) or public.is_space_moderator(v_space)) then
    raise exception 'You can only delete your own posts' using errcode = '42501';
  end if;

  if p_kind = 'post' then
    update public.posts set status = 'deleted' where id = p_id;
  else
    update public.replies set status = 'deleted' where id = p_id;
    update public.posts set accepted_reply_id = null where accepted_reply_id = p_id;
  end if;
end;
$$;

-- Moderator actions on a post: pin, unpin, lock, unlock, hide, restore, move. Logged.
create or replace function public.moderate_post(
  p_post_id uuid,
  p_action  text,
  p_reason  text default null,
  p_space_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post   public.posts%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_action public.moderation_action_type;
begin
  select * into v_post from public.posts where id = p_post_id for update;
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if not public.is_space_moderator(v_post.space_id) then
    raise exception 'Only moderators can do that' using errcode = '42501';
  end if;
  if p_action in ('hide', 'move') and v_reason is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  case p_action
    when 'pin' then update public.posts set is_pinned = true where id = p_post_id; v_action := 'pin_post';
    when 'unpin' then update public.posts set is_pinned = false where id = p_post_id; v_action := 'unpin_post';
    when 'lock' then update public.posts set is_locked = true where id = p_post_id; v_action := 'lock_post';
    when 'unlock' then update public.posts set is_locked = false where id = p_post_id; v_action := 'unlock_post';
    when 'hide' then update public.posts set status = 'hidden' where id = p_post_id; v_action := 'hide_content';
    when 'restore' then update public.posts set status = 'visible' where id = p_post_id; v_action := 'restore_content';
    when 'move' then
      if p_space_id is null or not exists (select 1 from public.spaces where id = p_space_id and not is_archived) then
        raise exception 'Choose a space to move the post to' using errcode = '22023';
      end if;
      if not public.is_space_moderator(p_space_id) then
        raise exception 'You can only move posts into spaces you moderate' using errcode = '42501';
      end if;
      update public.posts set space_id = p_space_id where id = p_post_id;
      v_action := 'move_post';
    else
      raise exception 'Unknown action' using errcode = '22023';
  end case;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason, metadata)
  values (auth.uid(), v_action, 'post', p_post_id, v_reason,
          case when p_action = 'move' then jsonb_build_object('from_space', v_post.space_id, 'to_space', p_space_id) else '{}'::jsonb end);
end;
$$;

-- Hide or restore a reply (moderators). Logged.
create or replace function public.moderate_reply(p_reply_id uuid, p_action text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_space  uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select p.space_id into v_space from public.replies r join public.posts p on p.id = r.post_id where r.id = p_reply_id;
  if v_space is null then
    raise exception 'Reply not found' using errcode = 'P0002';
  end if;
  if not public.is_space_moderator(v_space) then
    raise exception 'Only moderators can do that' using errcode = '42501';
  end if;
  if p_action = 'hide' and v_reason is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if p_action not in ('hide', 'restore') then
    raise exception 'Unknown action' using errcode = '22023';
  end if;

  update public.replies set status = case when p_action = 'hide' then 'hidden' else 'visible' end::public.content_status
  where id = p_reply_id;
  if p_action = 'hide' then
    update public.posts set accepted_reply_id = null where accepted_reply_id = p_reply_id;
  end if;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), case when p_action = 'hide' then 'hide_content' else 'restore_content' end::public.moderation_action_type,
          'reply', p_reply_id, v_reason);
end;
$$;

-- Approve or reject a request to join an approval-only space. Space moderators only.
create or replace function public.decide_join_request(p_space_id uuid, p_user_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_space_moderator(p_space_id) then
    raise exception 'Only this space''s moderators can decide join requests' using errcode = '42501';
  end if;
  if not exists (select 1 from public.space_members where space_id = p_space_id and user_id = p_user_id and status = 'pending') then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;

  if p_approve then
    update public.space_members set status = 'active', joined_at = now()
    where space_id = p_space_id and user_id = p_user_id;
  else
    delete from public.space_members where space_id = p_space_id and user_id = p_user_id;
  end if;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), case when p_approve then 'approve_member' else 'reject_member' end::public.moderation_action_type,
          'user', p_user_id, jsonb_build_object('space_id', p_space_id));
end;
$$;

revoke execute on function public.accept_reply(uuid) from public, anon;
revoke execute on function public.delete_content(text, uuid) from public, anon;
revoke execute on function public.moderate_post(uuid, text, text, uuid) from public, anon;
revoke execute on function public.moderate_reply(uuid, text, text) from public, anon;
revoke execute on function public.decide_join_request(uuid, uuid, boolean) from public, anon;
grant execute on function public.accept_reply(uuid) to authenticated;
grant execute on function public.delete_content(text, uuid) to authenticated;
grant execute on function public.moderate_post(uuid, text, text, uuid) to authenticated;
grant execute on function public.moderate_reply(uuid, text, text) to authenticated;
grant execute on function public.decide_join_request(uuid, uuid, boolean) to authenticated;

-- Row-level security -----------------------------------------------------------------

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.tags enable row level security;
alter table public.tag_follows enable row level security;
alter table public.posts enable row level security;
alter table public.post_tags enable row level security;
alter table public.post_follows enable row level security;
alter table public.replies enable row level security;
alter table public.reply_votes enable row level security;
alter table public.post_votes enable row level security;

-- spaces: discoverable by approved members; managed by admins.
create policy spaces_select on public.spaces for select to authenticated
  using ((select public.is_approved()) and (not is_archived or (select public.has_role('admin'))));
create policy spaces_insert on public.spaces for insert to authenticated
  with check ((select public.has_role('admin')));
create policy spaces_update on public.spaces for update to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));
create policy spaces_delete on public.spaces for delete to authenticated
  using ((select public.has_role('admin')));

-- space_members: see your own memberships and the members of spaces you can read.
create policy space_members_select on public.space_members for select to authenticated
  using (user_id = (select auth.uid()) or public.can_view_space(space_id) or public.is_space_moderator(space_id));
-- Join as yourself: active in open spaces, pending in approval spaces; never as moderator.
create policy space_members_insert on public.space_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_approved())
    and role = 'member'
    and status = (
      select case when s.join_policy = 'open' then 'active' else 'pending' end::public.member_status
      from public.spaces s where s.id = space_id and not s.is_archived
    )
  );
-- Only your own notify level (column grant below); join decisions go through decide_join_request.
create policy space_members_update_own on public.space_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy space_members_delete on public.space_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_space_moderator(space_id));

-- tags: readable by approved members; admins manage.
create policy tags_select on public.tags for select to authenticated using ((select public.is_approved()));
create policy tags_insert on public.tags for insert to authenticated with check ((select public.has_role('admin')));
create policy tags_update on public.tags for update to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));
create policy tags_delete on public.tags for delete to authenticated using ((select public.has_role('admin')));

create policy tag_follows_select on public.tag_follows for select to authenticated using (user_id = (select auth.uid()));
create policy tag_follows_insert on public.tag_follows for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_approved()));
create policy tag_follows_delete on public.tag_follows for delete to authenticated using (user_id = (select auth.uid()));

-- posts
create policy posts_select on public.posts for select to authenticated
  using (
    public.can_view_space(space_id)
    and (status = 'visible' or author_id = (select auth.uid()) or public.is_space_moderator(space_id))
  );
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_post_in_space(space_id));
-- Authors edit title/body (column grant) while the post is visible and unlocked.
create policy posts_update_author on public.posts for update to authenticated
  using (author_id = (select auth.uid()) and status = 'visible' and not is_locked and (select public.is_approved()))
  with check (author_id = (select auth.uid()));

create policy post_tags_select on public.post_tags for select to authenticated using (public.can_view_post(post_id));
create policy post_tags_insert on public.post_tags for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));
create policy post_tags_delete on public.post_tags for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

create policy post_follows_select on public.post_follows for select to authenticated using (user_id = (select auth.uid()));
create policy post_follows_insert on public.post_follows for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_post(post_id));
create policy post_follows_delete on public.post_follows for delete to authenticated using (user_id = (select auth.uid()));

-- replies
create policy replies_select on public.replies for select to authenticated
  using (
    public.can_view_post(post_id)
    and (
      status = 'visible' or author_id = (select auth.uid())
      or exists (select 1 from public.posts p where p.id = post_id and public.is_space_moderator(p.space_id))
    )
  );
create policy replies_insert on public.replies for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'visible' and not p.is_locked and public.can_post_in_space(p.space_id)
    )
  );
create policy replies_update_author on public.replies for update to authenticated
  using (author_id = (select auth.uid()) and status = 'visible' and (select public.is_approved()))
  with check (author_id = (select auth.uid()));

-- votes: counts are public to members who can see the content; you add/remove only your own.
create policy reply_votes_select on public.reply_votes for select to authenticated
  using (exists (select 1 from public.replies r where r.id = reply_id and public.can_view_post(r.post_id)));
create policy reply_votes_insert on public.reply_votes for insert to authenticated
  with check (
    user_id = (select auth.uid()) and (select public.is_approved())
    and exists (select 1 from public.replies r where r.id = reply_id and r.status = 'visible' and public.can_view_post(r.post_id))
  );
create policy reply_votes_delete on public.reply_votes for delete to authenticated using (user_id = (select auth.uid()));

create policy post_votes_select on public.post_votes for select to authenticated using (public.can_view_post(post_id));
create policy post_votes_insert on public.post_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_approved()) and public.can_view_post(post_id));
create policy post_votes_delete on public.post_votes for delete to authenticated using (user_id = (select auth.uid()));

-- Grants (no default privileges in this project; see 0004) ------------------------------

grant select on public.spaces, public.space_members, public.tags, public.tag_follows, public.posts,
  public.post_tags, public.post_follows, public.replies, public.reply_votes, public.post_votes to authenticated;
grant insert, update, delete on public.spaces, public.tags to authenticated;
grant insert (space_id, user_id, role, status), delete on public.space_members to authenticated;
grant update (notify_level) on public.space_members to authenticated;
grant insert, delete on public.tag_follows, public.post_tags, public.post_follows, public.reply_votes, public.post_votes to authenticated;
grant insert (space_id, author_id, type, title, body_html, body_text) on public.posts to authenticated;
grant update (title, body_html, body_text, edited_at) on public.posts to authenticated;
grant insert (post_id, author_id, parent_reply_id, body_html, body_text) on public.replies to authenticated;
grant update (body_html, body_text, edited_at) on public.replies to authenticated;

grant select, insert, update, delete on public.spaces, public.space_members, public.tags, public.tag_follows,
  public.posts, public.post_tags, public.post_follows, public.replies, public.reply_votes, public.post_votes
to service_role;
