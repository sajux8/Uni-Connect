-- 0002: people and access
-- departments, profiles, profile_private, user_blocks, account_deletion_requests,
-- a minimal moderation_actions log (extended in M7), the access helpers that every
-- RLS policy uses, and the trigger that creates a profile for each new auth user.

-- Tables ---------------------------------------------------------------------------

create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(name) between 2 and 80),
  code       text not null unique check (code ~ '^[A-Z]{2,6}$'),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per auth user. There is deliberately no phone column (objective O9).
create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  full_name                text not null check (char_length(full_name) between 2 and 80),
  username                 extensions.citext not null unique
                             check (username ~ '^[a-z0-9_]{3,30}$'),
  avatar_url               text,
  requested_role           public.requested_role not null default 'student',
  role                     public.user_role not null default 'student',
  status                   public.account_status not null default 'pending',
  department_id            uuid references public.departments (id) on delete set null,
  -- 0 = Foundation, 1-3 = Year 1-3, 4 = Final year / Top-up, 5 = Postgraduate; null for staff
  year_of_study            smallint check (year_of_study between 0 and 5),
  bio                      text check (char_length(bio) <= 160),
  interests                text[] not null default '{}' check (cardinality(interests) <= 15),
  expertise                text[] not null default '{}' check (cardinality(expertise) <= 15),
  profile_visibility       public.visibility_level not null default 'everyone',
  show_year                boolean not null default true,
  mentorship_requests_from public.request_permission not null default 'everyone',
  onboarding_completed     boolean not null default false,
  approved_by              uuid references public.profiles (id) on delete set null,
  approved_at              timestamptz,
  status_reason            text check (char_length(status_reason) <= 500),
  suspended_until          timestamptz,
  last_seen_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index profiles_status_idx on public.profiles (status);
create index profiles_role_idx on public.profiles (role);
create index profiles_department_year_idx on public.profiles (department_id, year_of_study);
create index profiles_full_name_trgm_idx on public.profiles using gin (full_name extensions.gin_trgm_ops);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Details only the owner and admins may see (student/staff ID, application note).
create table public.profile_private (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  id_number        text check (char_length(id_number) <= 40),
  application_note text check (char_length(application_note) <= 300),
  updated_at       timestamptz not null default now()
);
create trigger profile_private_set_updated_at before update on public.profile_private
  for each row execute function public.set_updated_at();

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

create table public.account_deletion_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  reason     text check (char_length(reason) <= 500),
  status     text not null default 'pending' check (status in ('pending', 'completed', 'declined')),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index account_deletion_requests_one_open_idx
  on public.account_deletion_requests (user_id) where status = 'pending';
create index account_deletion_requests_handled_by_idx on public.account_deletion_requests (handled_by);

-- Append-only audit log of moderator and admin actions (M1 uses the account actions).
create table public.moderation_actions (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      public.moderation_action_type not null,
  target_type text not null,
  target_id   uuid not null,
  reason      text check (char_length(reason) <= 1000),
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index moderation_actions_target_idx on public.moderation_actions (target_type, target_id);
create index moderation_actions_actor_idx on public.moderation_actions (actor_id);
create index moderation_actions_created_idx on public.moderation_actions (created_at desc);

create or replace function public.prevent_moderation_log_changes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'moderation_actions is append-only';
end;
$$;
create trigger moderation_actions_append_only before update or delete on public.moderation_actions
  for each row execute function public.prevent_moderation_log_changes();

create index profiles_approved_by_idx on public.profiles (approved_by);

-- Access helpers ----------------------------------------------------------------------
-- SECURITY DEFINER so policies on profiles can read the caller's own row without
-- recursing into profiles' RLS. They only ever expose the caller's own role/status.

create or replace function public.current_profile()
returns table (role public.user_role, status public.account_status, department_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role, p.status, p.department_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select status = 'approved' from public.current_profile()), false);
$$;

create or replace function public.has_role(variadic roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select status = 'approved' and role = any (roles) from public.current_profile()), false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('organizer', 'moderator', 'admin');
$$;

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

revoke execute on function public.current_profile() from public, anon;
revoke execute on function public.is_approved() from public, anon;
revoke execute on function public.has_role(public.user_role[]) from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_blocked(uuid, uuid) from public, anon;
grant execute on function public.current_profile() to authenticated;
grant execute on function public.is_approved() to authenticated;
grant execute on function public.has_role(public.user_role[]) to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

-- New user -> profile ----------------------------------------------------------------
-- Registration metadata (validated by the app before sign-up, re-checked here):
-- full_name, requested_role, department_id, year_of_study, id_number, note.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name      text := left(btrim(coalesce(meta ->> 'full_name', '')), 80);
  v_role      public.requested_role := case when meta ->> 'requested_role' = 'staff' then 'staff' else 'student' end;
  v_dept      uuid;
  v_year      smallint;
  v_base      text;
  v_username  text;
begin
  if char_length(v_name) < 2 then
    v_name := left(split_part(coalesce(new.email, ''), '@', 1), 80);
  end if;
  if char_length(v_name) < 2 then
    v_name := 'New member';
  end if;

  begin
    v_dept := nullif(meta ->> 'department_id', '')::uuid;
  exception when others then
    v_dept := null;
  end;
  if v_dept is not null and not exists (select 1 from public.departments where id = v_dept and is_active) then
    v_dept := null;
  end if;

  if v_role = 'student' and (meta ->> 'year_of_study') ~ '^[0-5]$' then
    v_year := (meta ->> 'year_of_study')::smallint;
  end if;

  -- Username: name in lowercase letters/digits/underscores + a 4-digit suffix; retried until unique.
  v_base := left(trim(both '_' from regexp_replace(lower(extensions.unaccent('extensions.unaccent', v_name)), '[^a-z0-9]+', '_', 'g')), 24);
  if char_length(v_base) < 3 then
    v_base := 'user';
  end if;
  loop
    v_username := v_base || '_' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where username = v_username);
  end loop;

  insert into public.profiles (id, full_name, username, requested_role, department_id, year_of_study)
  values (new.id, v_name, v_username, v_role, v_dept, v_year);

  insert into public.profile_private (user_id, id_number, application_note)
  values (
    new.id,
    nullif(left(btrim(coalesce(meta ->> 'id_number', '')), 40), ''),
    nullif(left(btrim(coalesce(meta ->> 'note', '')), 300), '')
  );

  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row-level security -----------------------------------------------------------------

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.user_blocks enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.moderation_actions enable row level security;

-- departments: everyone can read (the registration form needs them); admins manage.
create policy departments_select on public.departments
  for select to anon, authenticated using (true);
create policy departments_insert on public.departments
  for insert to authenticated with check ((select public.has_role('admin')));
create policy departments_update on public.departments
  for update to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));
create policy departments_delete on public.departments
  for delete to authenticated using ((select public.has_role('admin')));

-- profiles: your own row at any status; approved users see approved profiles; admins see all.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or ((select public.is_approved()) and status = 'approved')
    or (select public.has_role('admin'))
  );
-- Own row only, and only the columns granted below (never role, status or approval fields).
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (
  full_name, username, avatar_url, department_id, year_of_study, bio, interests, expertise,
  profile_visibility, show_year, mentorship_requests_from, onboarding_completed, last_seen_at
) on public.profiles to authenticated;

-- profile_private: owner and admins read; the owner may edit only while pending.
create policy profile_private_select on public.profile_private
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_role('admin')));
create policy profile_private_update_pending on public.profile_private
  for update to authenticated
  using (user_id = (select auth.uid()) and (select status from public.current_profile()) = 'pending')
  with check (user_id = (select auth.uid()));

revoke insert, update, delete on public.profile_private from anon, authenticated;
grant update (id_number, application_note) on public.profile_private to authenticated;

-- user_blocks: manage your own blocks.
create policy user_blocks_select on public.user_blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy user_blocks_insert on public.user_blocks
  for insert to authenticated
  with check (blocker_id = (select auth.uid()) and (select public.is_approved()));
create policy user_blocks_delete on public.user_blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- account_deletion_requests: users file their own; admins handle them.
create policy deletion_requests_select on public.account_deletion_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_role('admin')));
create policy deletion_requests_insert on public.account_deletion_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy deletion_requests_update on public.account_deletion_requests
  for update to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));

-- moderation_actions: readable by moderators and admins; written only by SECURITY DEFINER RPCs.
create policy moderation_actions_select on public.moderation_actions
  for select to authenticated using ((select public.has_role('moderator', 'admin')));
revoke insert, update, delete on public.moderation_actions from anon, authenticated;
