-- 0003: account administration, public profile view, avatars, departments
-- Admin RPCs (approve / reject / suspend / change role), the username check used by
-- onboarding, the profile_cards view every UI uses to show a person, the avatars
-- bucket, Realtime on profiles (/pending redirects on approval) and the departments.

-- Admin: list applications with the details needed to verify them ---------------------
-- Emails live in auth.users, which the API can't read, so admins get them through here.

create or replace function public.admin_list_accounts(p_status public.account_status, p_limit int default 100)
returns table (
  id uuid,
  full_name text,
  username text,
  email text,
  requested_role public.requested_role,
  role public.user_role,
  status public.account_status,
  department_name text,
  year_of_study smallint,
  id_number text,
  application_note text,
  status_reason text,
  created_at timestamptz,
  approved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Only administrators can review accounts' using errcode = '42501';
  end if;

  return query
    select p.id, p.full_name, p.username::text, u.email::text, p.requested_role, p.role, p.status,
           d.name, p.year_of_study, pp.id_number, pp.application_note, p.status_reason,
           p.created_at, p.approved_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.departments d on d.id = p.department_id
    left join public.profile_private pp on pp.user_id = p.id
    where p.status = p_status
    order by case when p_status = 'pending' then p.created_at end asc,
             p.updated_at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

-- Admin: change an account's status (approve, reject, suspend, reinstate) -------------

create or replace function public.admin_set_user_status(
  p_user_id uuid,
  p_status  public.account_status,
  p_reason  text default null,
  p_role    public.user_role default null,
  p_until   timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old    public.profiles%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_action public.moderation_action_type;
begin
  if not public.has_role('admin') then
    raise exception 'Only administrators can change account status' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change the status of your own account' using errcode = '42501';
  end if;
  if p_status = 'pending' then
    raise exception 'An account cannot be moved back to pending' using errcode = '22023';
  end if;
  if p_status in ('rejected', 'suspended') and v_reason is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;

  v_action := case
    when p_status = 'approved' and v_old.status = 'suspended' then 'unsuspend_user'
    when p_status = 'approved' then 'approve_account'
    when p_status = 'rejected' then 'reject_account'
    else 'suspend_user'
  end;

  update public.profiles
  set status          = p_status,
      role            = coalesce(case when p_status = 'approved' then p_role end, role),
      status_reason   = case when p_status = 'approved' then null else left(v_reason, 500) end,
      suspended_until = case when p_status = 'suspended' then p_until end,
      approved_by     = case when p_status = 'approved' and v_old.approved_at is null then auth.uid() else approved_by end,
      approved_at     = case when p_status = 'approved' and v_old.approved_at is null then now() else approved_at end
  where id = p_user_id;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason, metadata)
  values (
    auth.uid(), v_action, 'user', p_user_id, v_reason,
    jsonb_build_object('from_status', v_old.status, 'to_status', p_status)
      || case when p_status = 'approved' and p_role is not null and p_role <> v_old.role
              then jsonb_build_object('role', p_role) else '{}'::jsonb end
      || case when p_until is not null then jsonb_build_object('until', p_until) else '{}'::jsonb end
  );
end;
$$;

-- Admin: change an approved account's role --------------------------------------------

create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.user_role;
begin
  if not public.has_role('admin') then
    raise exception 'Only administrators can change roles' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;

  select role into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if v_old = p_role then
    return;
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'change_role', 'user', p_user_id, jsonb_build_object('from', v_old, 'to', p_role));
end;
$$;

revoke execute on function public.admin_list_accounts(public.account_status, int) from public, anon;
revoke execute on function public.admin_set_user_status(uuid, public.account_status, text, public.user_role, timestamptz) from public, anon;
revoke execute on function public.admin_set_user_role(uuid, public.user_role) from public, anon;
grant execute on function public.admin_list_accounts(public.account_status, int) to authenticated;
grant execute on function public.admin_set_user_status(uuid, public.account_status, text, public.user_role, timestamptz) to authenticated;
grant execute on function public.admin_set_user_role(uuid, public.user_role) to authenticated;

-- Username availability (onboarding and profile settings) ------------------------------
-- SECURITY DEFINER because pending users can't read other profiles; it only returns a boolean.

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_username ~ '^[a-z0-9_]{3,30}$'
     and not exists (
       select 1 from public.profiles
       where username = p_username::extensions.citext and id <> auth.uid()
     );
$$;
revoke execute on function public.is_username_available(text) from public, anon;
grant execute on function public.is_username_available(text) to authenticated;

-- profile_cards: how every screen shows a person ---------------------------------------
-- Security invoker, so profiles' RLS still decides which rows are visible. Optional
-- fields are blanked according to the owner's privacy settings. Never includes email,
-- student ID or anything from profile_private.

create or replace view public.profile_cards
with (security_invoker = true) as
select
  p.id,
  p.full_name,
  p.username::text as username,
  p.avatar_url,
  p.role,
  p.department_id,
  d.name as department_name,
  case when vis.full and p.show_year then p.year_of_study end as year_of_study,
  case when vis.full then p.bio end as bio,
  case when vis.full then p.interests else '{}'::text[] end as interests,
  case when vis.full then p.expertise else '{}'::text[] end as expertise,
  p.profile_visibility,
  p.created_at
from public.profiles p
left join public.departments d on d.id = p.department_id
cross join lateral (
  select (
    p.id = (select auth.uid())
    or p.profile_visibility = 'everyone'
    or (p.profile_visibility = 'department'
        and p.department_id is not null
        and p.department_id = (select cp.department_id from public.current_profile() cp))
  ) as full
) vis;

grant select on public.profile_cards to authenticated;
revoke select on public.profile_cards from anon;

-- Realtime: /pending listens to the user's own profile row --------------------------------
alter publication supabase_realtime add table public.profiles;

-- Avatars bucket: public read, users write only inside their own folder -----------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Departments (reference data; admins manage them later in /admin/departments) ----------
insert into public.departments (name, code) values
  ('Computing', 'COM'),
  ('Business & Management', 'BUS'),
  ('Engineering', 'ENG'),
  ('English & Languages', 'ENL'),
  ('Law', 'LAW')
on conflict (name) do nothing;
