-- 0011: where notifications come from
-- Triggers on the M1/M2 tables call notify(). All SECURITY DEFINER, all internal.
-- Space notify levels: "all" = every new post; "important" (default) = threads you follow;
-- "muted" = nothing from that space except direct replies to you.

-- Can this user (not necessarily the caller) read the space's content?
create or replace function public.user_can_view_space(p_user_id uuid, p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.spaces s
    where s.id = p_space_id and not s.is_archived
      and (
        s.join_policy = 'open'
        or exists (select 1 from public.space_members m
                   where m.space_id = s.id and m.user_id = p_user_id and m.status = 'active')
        or exists (select 1 from public.profiles p
                   where p.id = p_user_id and p.role in ('moderator', 'admin'))
      )
  );
$$;
revoke execute on function public.user_can_view_space(uuid, uuid) from public, anon, authenticated;

create or replace function public.display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select full_name from public.profiles where id = p_user_id), 'Someone');
$$;
revoke execute on function public.display_name(uuid) from public, anon, authenticated;

-- Replies → the parent reply's author, the post's author and thread followers -----------------

create or replace function public.notify_new_reply()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post          public.posts%rowtype;
  v_parent_author uuid;
  v_name          text := public.display_name(new.author_id);
  v_excerpt       text := left(regexp_replace(new.body_text, '\s+', ' ', 'g'), 200);
  v_link          text := '/posts/' || new.post_id || '#reply-' || new.id;
  v_followers     uuid[];
begin
  if new.status <> 'visible' then
    return null;
  end if;
  select * into v_post from public.posts where id = new.post_id;
  if v_post.id is null then
    return null;
  end if;

  if new.parent_reply_id is not null then
    select author_id into v_parent_author from public.replies where id = new.parent_reply_id;
    if v_parent_author is not null then
      perform public.notify(array[v_parent_author], 'reply_to_reply', v_name || ' replied to you',
                            v_excerpt, v_link, new.author_id, 'reply', new.id);
    end if;
  end if;

  select coalesce(array_agg(f.user_id), '{}') into v_followers
  from public.post_follows f
  where f.post_id = new.post_id
    and f.user_id is distinct from v_parent_author
    and public.user_can_view_space(f.user_id, v_post.space_id)
    and (
      f.user_id = v_post.author_id
      or not exists (select 1 from public.space_members m
                     where m.space_id = v_post.space_id and m.user_id = f.user_id and m.notify_level = 'muted')
    );

  perform public.notify(
    v_followers, 'reply_to_post',
    v_name || case when v_post.type = 'question' then ' answered “' else ' replied to “' end
      || left(v_post.title, 80) || case when char_length(v_post.title) > 80 then '…”' else '”' end,
    v_excerpt, v_link, new.author_id, 'reply', new.id);
  return null;
end;
$$;
create trigger replies_notify after insert on public.replies
  for each row execute function public.notify_new_reply();

-- New posts → members who chose "All posts" for the space ----------------------------------

create or replace function public.notify_new_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_space      public.spaces%rowtype;
  v_recipients uuid[];
begin
  if new.status <> 'visible' then
    return null;
  end if;
  select * into v_space from public.spaces where id = new.space_id;
  select coalesce(array_agg(m.user_id), '{}') into v_recipients
  from public.space_members m
  where m.space_id = new.space_id and m.status = 'active' and m.notify_level = 'all';

  perform public.notify(
    v_recipients, 'new_post_in_space',
    public.display_name(new.author_id) || case when new.type = 'question' then ' asked in ' else ' posted in ' end || v_space.name,
    new.title, '/posts/' || new.id, new.author_id, 'post', new.id);
  return null;
end;
$$;
create trigger posts_notify after insert on public.posts
  for each row execute function public.notify_new_post();

-- Tags on a new post → people following those tags (once per post) --------------------------

create or replace function public.notify_tag_followers()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post       public.posts%rowtype;
  v_tag        text;
  v_recipients uuid[];
begin
  select * into v_post from public.posts where id = new.post_id;
  if v_post.id is null or v_post.status <> 'visible' or v_post.created_at < now() - interval '1 day' then
    return null;
  end if;
  select name into v_tag from public.tags where id = new.tag_id;

  select coalesce(array_agg(f.user_id), '{}') into v_recipients
  from public.tag_follows f
  where f.tag_id = new.tag_id
    and public.user_can_view_space(f.user_id, v_post.space_id)
    and not exists (select 1 from public.notifications n where n.user_id = f.user_id and n.entity_id = v_post.id)
    and not exists (select 1 from public.space_members m
                    where m.space_id = v_post.space_id and m.user_id = f.user_id and m.notify_level = 'muted');

  perform public.notify(v_recipients, 'new_post_with_tag', 'New post tagged #' || v_tag,
                        v_post.title, '/posts/' || v_post.id, v_post.author_id, 'post', v_post.id);
  return null;
end;
$$;
create trigger post_tags_notify after insert on public.post_tags
  for each row execute function public.notify_tag_followers();

-- Accepted answer → the reply's author ---------------------------------------------------------

create or replace function public.notify_answer_accepted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_author uuid;
begin
  select author_id into v_author from public.replies where id = new.accepted_reply_id;
  if v_author is not null then
    perform public.notify(array[v_author], 'answer_accepted',
                          public.display_name(auth.uid()) || ' accepted your answer',
                          new.title, '/posts/' || new.id || '#reply-' || new.accepted_reply_id,
                          auth.uid(), 'reply', new.accepted_reply_id);
  end if;
  return null;
end;
$$;
create trigger posts_notify_accepted after update of accepted_reply_id on public.posts
  for each row when (new.accepted_reply_id is not null and new.accepted_reply_id is distinct from old.accepted_reply_id)
  execute function public.notify_answer_accepted();

-- Join requests → the space's moderators (or admins); decisions → the requester ---------------

create or replace function public.notify_join_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_space public.spaces%rowtype;
  v_mods  uuid[];
begin
  select * into v_space from public.spaces where id = coalesce(new.space_id, old.space_id);
  if v_space.id is null then
    return null; -- the space itself is being deleted
  end if;

  if tg_op = 'INSERT' and new.status = 'pending' then
    select coalesce(array_agg(m.user_id), '{}') into v_mods
    from public.space_members m
    where m.space_id = new.space_id and m.role = 'moderator' and m.status = 'active';
    if cardinality(v_mods) = 0 then
      select coalesce(array_agg(p.id), '{}') into v_mods
      from public.profiles p where p.role = 'admin' and p.status = 'approved';
    end if;
    perform public.notify(v_mods, 'join_request',
                          public.display_name(new.user_id) || ' asked to join ' || v_space.name,
                          null, '/spaces/' || v_space.slug || '?tab=members', new.user_id, 'space', new.space_id);

  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    perform public.notify(array[new.user_id], 'join_request_decided', 'You''re in: ' || v_space.name,
                          'Your request to join was approved.', '/spaces/' || v_space.slug,
                          auth.uid(), 'space', new.space_id);

  elsif tg_op = 'DELETE' and old.status = 'pending' and auth.uid() is distinct from old.user_id then
    perform public.notify(array[old.user_id], 'join_request_decided',
                          'Your request to join ' || v_space.name || ' wasn''t approved',
                          null, '/spaces', auth.uid(), 'space', old.space_id);
  end if;
  return null;
end;
$$;
create trigger space_members_notify after insert or update of status or delete on public.space_members
  for each row execute function public.notify_join_request();

-- Content hidden by a moderator → its author (with the logged reason) --------------------------

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
begin
  if new.action <> 'hide_content' or new.target_type not in ('post', 'reply') then
    return null;
  end if;
  if new.target_type = 'post' then
    select author_id, title, '/posts/' || id into v_author, v_title, v_link
    from public.posts where id = new.target_id;
  else
    select r.author_id, p.title, '/posts/' || p.id into v_author, v_title, v_link
    from public.replies r join public.posts p on p.id = r.post_id where r.id = new.target_id;
  end if;
  if v_author is null then
    return null;
  end if;

  perform public.notify(
    array[v_author], 'content_moderated',
    case when new.target_type = 'post' then 'A moderator hid your post' else 'A moderator hid your reply' end,
    coalesce('Reason: ' || new.reason, v_title), v_link, new.actor_id, new.target_type, new.target_id,
    true, jsonb_build_object('reason', new.reason, 'post_title', v_title));
  return null;
end;
$$;
create trigger moderation_actions_notify after insert on public.moderation_actions
  for each row execute function public.notify_content_moderated();

-- Accounts: new sign-ups → admins (one grouped notification); decisions → the applicant -------

create or replace function public.notify_account_events()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pending int;
  v_admin   uuid;
  v_title   text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      return null;
    end if;
    select count(*) into v_pending from public.profiles where status = 'pending';
    v_title := case when v_pending = 1 then '1 account is waiting for approval'
                    else v_pending || ' accounts are waiting for approval' end;
    -- Keep one unread reminder per admin up to date instead of one per sign-up.
    for v_admin in select id from public.profiles where role = 'admin' and status = 'approved' loop
      update public.notifications
      set title = v_title, body = 'Latest: ' || new.full_name, created_at = now(), entity_id = new.id
      where user_id = v_admin and type = 'new_account_pending' and read_at is null;
      if not found then
        perform public.notify(array[v_admin], 'new_account_pending', v_title, 'Latest: ' || new.full_name,
                              '/admin/approvals', null, 'user', new.id);
      end if;
    end loop;
    return null;
  end if;

  if old.status = new.status then
    return null;
  end if;
  if old.status = 'pending' and new.status = 'approved' then
    perform public.notify(array[new.id], 'account_approved', 'Welcome to ICBT Connect!',
                          'Your account has been approved. Set up your profile to get started.',
                          '/onboarding', auth.uid(), 'user', new.id, true);
  elsif old.status = 'pending' and new.status = 'rejected' then
    perform public.notify(array[new.id], 'account_rejected', 'Your application wasn''t approved',
                          new.status_reason, '/rejected', auth.uid(), 'user', new.id, true,
                          jsonb_build_object('reason', new.status_reason), true);
  end if;
  return null;
end;
$$;
create trigger profiles_notify_insert after insert on public.profiles
  for each row execute function public.notify_account_events();
create trigger profiles_notify_status after update of status on public.profiles
  for each row execute function public.notify_account_events();

revoke execute on function public.notify_new_reply() from public, anon, authenticated;
revoke execute on function public.notify_new_post() from public, anon, authenticated;
revoke execute on function public.notify_tag_followers() from public, anon, authenticated;
revoke execute on function public.notify_answer_accepted() from public, anon, authenticated;
revoke execute on function public.notify_join_request() from public, anon, authenticated;
revoke execute on function public.notify_content_moderated() from public, anon, authenticated;
revoke execute on function public.notify_account_events() from public, anon, authenticated;
