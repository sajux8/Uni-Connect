-- 0029: departments and batches (Phase B).
--
-- * Every student belongs to one department and, once approved, one batch (e.g. Computing Batch 17).
-- * Each department space gets a private sub-space per batch. Department and batch spaces are
--   isolated: only that department (or batch, its lecturers and the coordinator) can see them.
-- * Posts in a batch space are "batch only" or shared with the whole department.
-- * Coordinators manage their own department: approvals, batches, lecturers, class reps.
-- * Class rep (batches.rep_id) and club captain (space_members.role = 'captain') are positions.

-- Helpers --------------------------------------------------------------------------------------

-- Super admins manage every department; a coordinator manages their own.
create or replace function public.manages_department(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('super_admin')
      or (public.has_role('coordinator')
          and p_department_id is not null
          and p_department_id = (select cp.department_id from public.current_profile() cp));
$$;

-- Tables ---------------------------------------------------------------------------------------

create table public.batches (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  number        smallint not null check (number between 1 and 999),
  name          text not null check (char_length(name) between 2 and 80),
  space_id      uuid unique references public.spaces (id) on delete set null,
  rep_id        uuid references public.profiles (id) on delete set null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (department_id, number)
);
create index batches_rep_idx on public.batches (rep_id);

create table public.batch_lecturers (
  batch_id    uuid not null references public.batches (id) on delete cascade,
  lecturer_id uuid not null references public.profiles (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (batch_id, lecturer_id)
);
create index batch_lecturers_lecturer_idx on public.batch_lecturers (lecturer_id);

alter table public.profiles add column batch_id uuid references public.batches (id) on delete set null;
create index profiles_batch_idx on public.profiles (batch_id);

create or replace function public.my_batch_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select batch_id from public.profiles where id = auth.uid();
$$;

alter table public.spaces add column parent_id uuid references public.spaces (id) on delete cascade;
create index spaces_parent_idx on public.spaces (parent_id);

-- Only used in batch spaces: 'batch' = the batch only, 'department' = the whole department.
alter table public.posts add column audience text not null default 'department'
  check (audience in ('batch', 'department'));

create or replace function public.teaches_batch(p_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and exists (
    select 1 from public.batch_lecturers bl where bl.batch_id = p_batch_id and bl.lecturer_id = auth.uid()
  );
$$;

-- Grants and RLS: batches are visible to every approved member (names only); changes go through RPCs.
alter table public.batches enable row level security;
alter table public.batch_lecturers enable row level security;
grant select on public.batches, public.batch_lecturers to authenticated;
grant select, insert, update, delete on public.batches, public.batch_lecturers to service_role;
create policy batches_select on public.batches for select to authenticated
  using ((select public.is_approved()));
create policy batch_lecturers_select on public.batch_lecturers for select to authenticated
  using ((select public.is_approved()));

-- The batch is public like the department; a student can't move themselves between departments.
grant select (batch_id) on public.profiles to authenticated;
revoke update (department_id) on public.profiles from authenticated;
grant update (audience) on public.posts to authenticated;

-- A student's batch must be in their department; anyone who stops being a student leaves their batch.
create or replace function public.check_profile_batch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.batch_id is not null and new.role <> 'student' then
    new.batch_id := null;
  end if;
  if new.batch_id is not null and not exists (
    select 1 from public.batches b where b.id = new.batch_id and b.department_id = new.department_id
  ) then
    raise exception 'The batch must belong to the student''s department' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger profiles_check_batch
  before insert or update of batch_id, department_id, role on public.profiles
  for each row execute function public.check_profile_batch();

-- Posts outside batch spaces are always department-wide.
create or replace function public.normalize_post_audience()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.spaces s where s.id = new.space_id and s.type = 'batch') then
    new.audience := 'department';
  end if;
  return new;
end;
$$;
create trigger posts_normalize_audience
  before insert or update of audience, space_id on public.posts
  for each row execute function public.normalize_post_audience();

-- Visibility -----------------------------------------------------------------------------------

create or replace function public.can_view_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and exists (
    select 1 from public.spaces s
    left join public.batches b on b.space_id = s.id
    where s.id = p_space_id
      and (not s.is_archived or public.has_role('super_admin'))
      and case
        when s.type = 'department' then
          public.has_role('super_admin')
          or s.department_id = (select cp.department_id from public.current_profile() cp)
        when s.type = 'batch' then
          public.manages_department(s.department_id)
          or (b.id is not null and (b.id = public.my_batch_id() or public.teaches_batch(b.id)))
        else
          s.join_policy = 'open'
          or public.has_role('super_admin')
          or exists (
            select 1 from public.space_members m
            where m.space_id = s.id and m.user_id = auth.uid() and m.status = 'active'
          )
      end
  );
$$;

-- The same rule for another user (notification fan-out).
create or replace function public.user_can_view_space(p_user_id uuid, p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.spaces s
    join public.profiles p on p.id = p_user_id
    left join public.batches b on b.space_id = s.id
    where s.id = p_space_id and not s.is_archived and p.status = 'approved'
      and case
        when s.type = 'department' then
          p.role = 'super_admin' or s.department_id = p.department_id
        when s.type = 'batch' then
          p.role = 'super_admin'
          or (p.role = 'coordinator' and s.department_id = p.department_id)
          or (b.id is not null and (b.id = p.batch_id or exists (
                select 1 from public.batch_lecturers bl where bl.batch_id = b.id and bl.lecturer_id = p.id)))
        else
          s.join_policy = 'open'
          or p.role = 'super_admin'
          or exists (select 1 from public.space_members m
                     where m.space_id = s.id and m.user_id = p_user_id and m.status = 'active')
      end
  );
$$;

-- Moderators of a space: super admins; the coordinator for their department's spaces; lecturers and the
-- class rep for their batch; and members given the moderator or captain role.
create or replace function public.is_space_moderator(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('super_admin')
      or exists (
        select 1 from public.spaces s
        left join public.batches b on b.space_id = s.id
        where s.id = p_space_id
          and (
            (s.type in ('department', 'batch') and public.manages_department(s.department_id))
            or (b.id is not null and public.is_approved() and (public.teaches_batch(b.id) or b.rep_id = auth.uid()))
          )
      )
      or (
        public.is_approved()
        and exists (
          select 1 from public.space_members m
          where m.space_id = p_space_id and m.user_id = auth.uid()
            and m.role in ('moderator', 'captain') and m.status = 'active'
        )
      );
$$;

-- Department and batch spaces don't need joining: belonging to them is enough to post.
create or replace function public.can_post_in_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and exists (
    select 1 from public.spaces s
    where s.id = p_space_id and not s.is_archived
      and (
        exists (select 1 from public.space_members m
                where m.space_id = s.id and m.user_id = auth.uid() and m.status = 'active')
        or (s.type in ('department', 'batch') and public.can_view_space(s.id))
      )
  );
$$;

-- A department-wide post in a batch space is also visible to the parent department.
create or replace function public.can_view_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.posts p
    join public.spaces s on s.id = p.space_id
    where p.id = p_post_id
      and (public.can_view_space(p.space_id)
           or (p.audience = 'department' and public.can_view_space(s.parent_id)))
      and (p.status = 'visible' or p.author_id = auth.uid() or public.is_space_moderator(p.space_id))
  );
$$;

drop policy posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated
  using (
    (public.can_view_space(space_id)
     or (audience = 'department'
         and public.can_view_space((select s.parent_id from public.spaces s where s.id = posts.space_id))))
    and (status = 'visible' or author_id = (select auth.uid()) or public.is_space_moderator(space_id))
  );

-- The directory hides other departments' spaces (checked on the row's own columns, see 0017).
drop policy spaces_select on public.spaces;
create policy spaces_select on public.spaces for select to authenticated
  using (
    (select public.is_approved())
    and (not is_archived or (select public.has_role('super_admin')))
    and (
      type not in ('department', 'batch')
      or (select public.has_role('super_admin'))
      or (type = 'department' and department_id = (select cp.department_id from public.current_profile() cp))
      or (type = 'batch' and (
            public.manages_department(department_id)
            or exists (select 1 from public.batches b
                       where b.space_id = spaces.id
                         and (b.id = (select public.my_batch_id()) or public.teaches_batch(b.id)))))
    )
  );

-- Nobody joins or leaves department and batch spaces by hand; membership follows the profile.
drop policy space_members_insert on public.space_members;
create policy space_members_insert on public.space_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_approved())
    and role = 'member'
    and status = (
      select (case when s.join_policy = 'open' then 'active' else 'pending' end)::public.member_status
      from public.spaces s
      where s.id = space_members.space_id and not s.is_archived and s.type not in ('department', 'batch')
    )
  );

drop policy space_members_delete on public.space_members;
create policy space_members_delete on public.space_members for delete to authenticated
  using (
    (user_id = (select auth.uid())
     and not exists (select 1 from public.spaces s
                     where s.id = space_members.space_id and s.type in ('department', 'batch')))
    or public.is_space_moderator(space_id)
  );

-- Automatic membership -----------------------------------------------------------------------

create or replace function public.sync_auto_memberships(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.profiles%rowtype;
begin
  select * into v from public.profiles where id = p_user_id;
  if not found then
    return;
  end if;

  -- Leave department and batch spaces the user no longer belongs to.
  delete from public.space_members m
  using public.spaces s
  where m.space_id = s.id and m.user_id = p_user_id and s.type in ('department', 'batch')
    and not (
      v.status = 'approved'
      and (
        (s.type = 'department' and s.department_id = v.department_id)
        or (s.type = 'batch' and exists (
              select 1 from public.batches b
              where b.space_id = s.id
                and (b.id = v.batch_id or exists (
                      select 1 from public.batch_lecturers bl where bl.batch_id = b.id and bl.lecturer_id = p_user_id)))))
    );

  if v.status <> 'approved' then
    return;
  end if;

  insert into public.space_members (space_id, user_id, role, status)
  select s.id, p_user_id, 'member', 'active'
  from public.spaces s
  where not s.is_archived
    and (
      (s.type = 'department' and s.department_id = v.department_id)
      or (s.type = 'batch' and exists (
            select 1 from public.batches b
            where b.space_id = s.id
              and (b.id = v.batch_id or exists (
                    select 1 from public.batch_lecturers bl where bl.batch_id = b.id and bl.lecturer_id = p_user_id))))
    )
  on conflict (space_id, user_id) do update set status = 'active'
    where space_members.status = 'pending';
end;
$$;

create or replace function public.sync_profile_memberships()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- A student who leaves their batch stops being its class rep.
  if tg_op = 'UPDATE' and old.batch_id is distinct from new.batch_id and old.batch_id is not null then
    update public.batches set rep_id = null where id = old.batch_id and rep_id = new.id;
  end if;
  perform public.sync_auto_memberships(new.id);
  return null;
end;
$$;
create trigger profiles_sync_memberships
  after insert or update of department_id, batch_id, status, role on public.profiles
  for each row execute function public.sync_profile_memberships();

create or replace function public.sync_lecturer_memberships()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sync_auto_memberships(coalesce(new.lecturer_id, old.lecturer_id));
  return null;
end;
$$;
create trigger batch_lecturers_sync
  after insert or delete on public.batch_lecturers
  for each row execute function public.sync_lecturer_memberships();

-- Batch management RPCs ----------------------------------------------------------------------------

create or replace function public.create_batch(p_department_id uuid, p_number integer)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dept   public.departments%rowtype;
  v_parent public.spaces%rowtype;
  v_name   text;
  v_space  uuid;
  v_batch  uuid;
begin
  if not public.manages_department(p_department_id) then
    raise exception 'Only the department''s coordinator or a super admin can create batches' using errcode = '42501';
  end if;
  select * into v_dept from public.departments where id = p_department_id;
  if not found then
    raise exception 'Department not found' using errcode = 'P0002';
  end if;
  if p_number is null or p_number < 1 or p_number > 999 then
    raise exception 'The batch number must be between 1 and 999' using errcode = '22023';
  end if;
  v_name := v_dept.name || ' Batch ' || p_number;
  if exists (select 1 from public.batches where department_id = p_department_id and number = p_number) then
    raise exception '% already exists', v_name using errcode = '23505';
  end if;

  select * into v_parent from public.spaces
  where type = 'department' and department_id = p_department_id
  order by created_at limit 1;

  insert into public.spaces (slug, name, description, type, department_id, icon, join_policy, parent_id, created_by)
  values (
    coalesce(v_parent.slug, lower(v_dept.code)) || '-batch-' || p_number,
    v_name,
    'Private space for ' || v_name || '. Only the batch, its lecturers and the coordinator can see it.',
    'batch', p_department_id, 'GraduationCap', 'approval', v_parent.id, auth.uid()
  )
  returning id into v_space;

  insert into public.batches (department_id, number, name, space_id)
  values (p_department_id, p_number, v_name, v_space)
  returning id into v_batch;
  return v_batch;
end;
$$;

create or replace function public.set_batch_lecturer(p_batch_id uuid, p_lecturer_id uuid, p_assign boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch public.batches%rowtype;
begin
  select * into v_batch from public.batches where id = p_batch_id;
  if not found then
    raise exception 'Batch not found' using errcode = 'P0002';
  end if;
  if not public.manages_department(v_batch.department_id) then
    raise exception 'Only the department''s coordinator or a super admin can assign lecturers' using errcode = '42501';
  end if;

  if p_assign then
    if not exists (select 1 from public.profiles
                   where id = p_lecturer_id and status = 'approved' and role in ('lecturer', 'coordinator')) then
      raise exception 'Only approved lecturers can be assigned to a batch' using errcode = '22023';
    end if;
    insert into public.batch_lecturers (batch_id, lecturer_id) values (p_batch_id, p_lecturer_id)
    on conflict do nothing;
    if not found then
      return;
    end if;
  else
    delete from public.batch_lecturers where batch_id = p_batch_id and lecturer_id = p_lecturer_id;
    if not found then
      return;
    end if;
  end if;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), case when p_assign then 'assign_lecturer' else 'remove_lecturer' end::public.moderation_action_type,
          'user', p_lecturer_id, jsonb_build_object('batch_id', p_batch_id, 'batch', v_batch.name));
end;
$$;

create or replace function public.set_batch_rep(p_batch_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch public.batches%rowtype;
begin
  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then
    raise exception 'Batch not found' using errcode = 'P0002';
  end if;
  if not public.manages_department(v_batch.department_id) then
    raise exception 'Only the department''s coordinator or a super admin can choose the class rep' using errcode = '42501';
  end if;
  if p_user_id is not null and not exists (
    select 1 from public.profiles
    where id = p_user_id and batch_id = p_batch_id and role = 'student' and status = 'approved'
  ) then
    raise exception 'The class rep must be an approved student in this batch' using errcode = '22023';
  end if;
  if v_batch.rep_id is not distinct from p_user_id then
    return;
  end if;

  update public.batches set rep_id = p_user_id where id = p_batch_id;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'set_class_rep', 'user', coalesce(p_user_id, v_batch.rep_id),
          jsonb_build_object('batch_id', p_batch_id, 'batch', v_batch.name,
                             'previous', v_batch.rep_id, 'rep', p_user_id));
end;
$$;

-- Put an approved student in a batch (or take them out with null). Super admins may move a student to
-- another department's batch; coordinators only within their department.
create or replace function public.assign_student_batch(p_user_id uuid, p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user  public.profiles%rowtype;
  v_batch public.batches%rowtype;
begin
  select * into v_user from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if not public.manages_department(v_user.department_id) then
    raise exception 'You can only manage students in your department' using errcode = '42501';
  end if;
  if v_user.role <> 'student' then
    raise exception 'Only students belong to a batch' using errcode = '22023';
  end if;
  if p_batch_id is not null then
    select * into v_batch from public.batches where id = p_batch_id;
    if not found then
      raise exception 'Batch not found' using errcode = 'P0002';
    end if;
    if not public.manages_department(v_batch.department_id) then
      raise exception 'You can only use batches in your department' using errcode = '42501';
    end if;
  end if;
  if v_user.batch_id is not distinct from p_batch_id then
    return;
  end if;

  update public.profiles
  set batch_id = p_batch_id,
      department_id = coalesce(v_batch.department_id, department_id)
  where id = p_user_id;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'assign_batch', 'user', p_user_id,
          jsonb_build_object('from', v_user.batch_id, 'to', p_batch_id, 'batch', v_batch.name));
end;
$$;

-- Club captains and space moderators.
create or replace function public.set_space_role(p_space_id uuid, p_user_id uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_space public.spaces%rowtype;
begin
  select * into v_space from public.spaces where id = p_space_id;
  if not found then
    raise exception 'Space not found' using errcode = 'P0002';
  end if;
  if not (public.has_role('super_admin') or public.manages_department(v_space.department_id)) then
    raise exception 'Only a super admin or the department''s coordinator can change space roles' using errcode = '42501';
  end if;
  if p_role = 'captain' and v_space.type <> 'club' then
    raise exception 'Only clubs have captains' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and status = 'approved') then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;

  insert into public.space_members (space_id, user_id, role, status)
  values (p_space_id, p_user_id, p_role, 'active')
  on conflict (space_id, user_id) do update set role = p_role, status = 'active';

  insert into public.moderation_actions (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'set_space_role', 'user', p_user_id,
          jsonb_build_object('space_id', p_space_id, 'space', v_space.name, 'space_role', p_role));
end;
$$;

-- Accounts: coordinators review and manage their own department ------------------------------------

drop function public.admin_set_user_status(uuid, public.account_status, text, public.user_role, timestamptz);
create function public.admin_set_user_status(
  p_user_id  uuid,
  p_status   public.account_status,
  p_reason   text default null,
  p_role     public.user_role default null,
  p_until    timestamptz default null,
  p_batch_id uuid default null
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
  v_super  boolean := public.has_role('super_admin');
  v_role   public.user_role;
  v_batch  public.batches%rowtype;
begin
  if not (v_super or public.has_role('coordinator')) then
    raise exception 'Only coordinators and super admins can review accounts' using errcode = '42501';
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

  if not v_super then
    if not public.manages_department(v_old.department_id) then
      raise exception 'You can only review accounts in your department' using errcode = '42501';
    end if;
    if p_status = 'suspended' or v_old.status = 'suspended' then
      raise exception 'Only super admins can suspend or reinstate accounts' using errcode = '42501';
    end if;
    if v_old.role >= 'coordinator' or (p_role is not null and p_role >= 'coordinator') then
      raise exception 'Only super admins can approve coordinators' using errcode = '42501';
    end if;
  end if;

  v_role := coalesce(case when p_status = 'approved' then p_role end, v_old.role);
  if p_batch_id is not null then
    if p_status <> 'approved' or v_role <> 'student' then
      raise exception 'Only approved students belong to a batch' using errcode = '22023';
    end if;
    select * into v_batch from public.batches where id = p_batch_id;
    if not found then
      raise exception 'Batch not found' using errcode = 'P0002';
    end if;
    if not public.manages_department(v_batch.department_id) then
      raise exception 'You can only use batches in your department' using errcode = '42501';
    end if;
  end if;

  v_action := case
    when p_status = 'approved' and v_old.status = 'suspended' then 'unsuspend_user'
    when p_status = 'approved' then 'approve_account'
    when p_status = 'rejected' then 'reject_account'
    else 'suspend_user'
  end;

  update public.profiles
  set status          = p_status,
      role            = v_role,
      department_id   = coalesce(v_batch.department_id, department_id),
      batch_id        = coalesce(v_batch.id, batch_id),
      status_reason   = case when p_status = 'approved' then null else left(v_reason, 500) end,
      suspended_until = case when p_status = 'suspended' then p_until end,
      approved_by     = case when p_status = 'approved' and v_old.approved_at is null then auth.uid() else approved_by end,
      approved_at     = case when p_status = 'approved' and v_old.approved_at is null then now() else approved_at end
  where id = p_user_id;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason, metadata)
  values (
    auth.uid(), v_action, 'user', p_user_id, v_reason,
    jsonb_build_object('from_status', v_old.status, 'to_status', p_status)
      || case when p_status = 'approved' and v_role <> v_old.role
              then jsonb_build_object('role', v_role) else '{}'::jsonb end
      || case when v_batch.id is not null then jsonb_build_object('batch', v_batch.name) else '{}'::jsonb end
      || case when p_until is not null then jsonb_build_object('until', p_until) else '{}'::jsonb end
  );
end;
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.profiles%rowtype;
begin
  if not (public.has_role('super_admin') or public.has_role('coordinator')) then
    raise exception 'Only coordinators and super admins can change roles' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;

  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if not public.has_role('super_admin') then
    if not public.manages_department(v_old.department_id) then
      raise exception 'You can only change roles in your department' using errcode = '42501';
    end if;
    if v_old.role >= 'coordinator' or p_role >= 'coordinator' then
      raise exception 'Coordinators can only make someone a student or a lecturer' using errcode = '42501';
    end if;
  end if;
  if v_old.role = p_role then
    return;
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'change_role', 'user', p_user_id, jsonb_build_object('from', v_old.role, 'to', p_role));
end;
$$;

drop function public.admin_list_accounts(public.account_status, integer);
create function public.admin_list_accounts(p_status public.account_status, p_limit integer default 100)
returns table (
  id uuid, full_name text, username text, email text, requested_role public.requested_role,
  role public.user_role, status public.account_status, department_id uuid, department_name text,
  year_of_study smallint, id_number text, application_note text, status_reason text,
  batch_id uuid, batch_name text, created_at timestamptz, approved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_super boolean := public.has_role('super_admin');
  v_dept  uuid := (select cp.department_id from public.current_profile() cp);
begin
  if not (v_super or public.has_role('coordinator')) then
    raise exception 'Only coordinators and super admins can review accounts' using errcode = '42501';
  end if;

  return query
    select p.id, p.full_name, p.username::text, u.email::text, p.requested_role, p.role, p.status,
           p.department_id, d.name, p.year_of_study, pp.id_number, pp.application_note, p.status_reason,
           p.batch_id, b.name, p.created_at, p.approved_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.departments d on d.id = p.department_id
    left join public.batches b on b.id = p.batch_id
    left join public.profile_private pp on pp.user_id = p.id
    where p.status = p_status
      and (v_super or (p.department_id = v_dept and p.role < 'coordinator'))
    order by case when p_status = 'pending' then p.created_at end asc,
             p.updated_at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

drop function public.admin_search_users(text, public.user_role, public.account_status, uuid, integer, integer);
create function public.admin_search_users(
  p_query      text default null,
  p_role       public.user_role default null,
  p_status     public.account_status default null,
  p_department uuid default null,
  p_limit      integer default 50,
  p_offset     integer default 0
)
returns table (
  id uuid, full_name text, username text, email text, avatar_url text, role public.user_role,
  status public.account_status, department_name text, batch_name text, year_of_study smallint,
  suspended_until timestamptz, created_at timestamptz, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_pattern text := '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_super   boolean := public.has_role('super_admin');
  v_dept    uuid := (select cp.department_id from public.current_profile() cp);
begin
  if not (v_super or public.has_role('coordinator')) then
    raise exception 'Only coordinators and super admins can manage users' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.username::text, u.email::text, p.avatar_url, p.role, p.status, d.name, b.name,
           p.year_of_study, p.suspended_until, p.created_at, count(*) over ()
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.departments d on d.id = p.department_id
    left join public.batches b on b.id = p.batch_id
    where (nullif(btrim(coalesce(p_query, '')), '') is null
           or p.full_name ilike v_pattern or p.username::text ilike v_pattern or u.email::text ilike v_pattern)
      and (p_role is null or p.role = p_role)
      and (p_status is null or p.status = p_status)
      and (p_department is null or p.department_id = p_department)
      and (v_super or p.department_id = v_dept)
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;

drop function public.admin_user_detail(uuid);
create function public.admin_user_detail(p_user_id uuid)
returns table (
  id uuid, full_name text, username text, email text, avatar_url text, role public.user_role,
  requested_role public.requested_role, status public.account_status, status_reason text,
  suspended_until timestamptz, department_id uuid, department_name text, batch_id uuid, batch_name text,
  is_class_rep boolean, year_of_study smallint, id_number text, application_note text,
  created_at timestamptz, approved_at timestamptz, last_sign_in_at timestamptz,
  post_count integer, reply_count integer, resource_count integer, reports_against integer,
  open_reports_against integer, reports_made integer,
  deletion_request_id uuid, deletion_reason text, deletion_requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.has_role('super_admin')
          or (public.has_role('coordinator')
              and public.manages_department((select x.department_id from public.profiles x where x.id = p_user_id)))) then
    raise exception 'Only coordinators (for their department) and super admins can manage users' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.username::text, u.email::text, p.avatar_url, p.role, p.requested_role, p.status,
           p.status_reason, p.suspended_until, p.department_id, d.name, p.batch_id, b.name,
           exists (select 1 from public.batches rb where rb.rep_id = p.id),
           p.year_of_study, pp.id_number, pp.application_note,
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
    left join public.batches b on b.id = p.batch_id
    left join public.profile_private pp on pp.user_id = p.id
    left join lateral (
      select r.id, r.reason, r.created_at from public.account_deletion_requests r
      where r.user_id = p.id and r.status = 'pending' order by r.created_at desc limit 1
    ) dr on true
    where p.id = p_user_id;
end;
$$;

-- Coordinators see their department's applicants, so they're told about them too.
create or replace function public.notify_account_events()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pending  int;
  v_reviewer uuid;
  v_title    text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      return null;
    end if;
    -- Keep one unread reminder per reviewer up to date instead of one per sign-up.
    for v_reviewer in
      select id from public.profiles
      where status = 'approved'
        and (role = 'super_admin' or (role = 'coordinator' and department_id = new.department_id))
    loop
      select count(*) into v_pending from public.profiles x
      where x.status = 'pending'
        and (exists (select 1 from public.profiles r where r.id = v_reviewer and r.role = 'super_admin')
             or x.department_id = new.department_id);
      v_title := case when v_pending = 1 then '1 account is waiting for approval'
                      else v_pending || ' accounts are waiting for approval' end;
      update public.notifications
      set title = v_title, body = 'Latest: ' || new.full_name, created_at = now(), entity_id = new.id
      where user_id = v_reviewer and type = 'new_account_pending' and read_at is null;
      if not found then
        perform public.notify(array[v_reviewer], 'new_account_pending', v_title, 'Latest: ' || new.full_name,
                              '/admin/approvals', null, 'user', new.id);
      end if;
    end loop;
    return null;
  end if;

  if old.status = new.status then
    return null;
  end if;
  if old.status = 'pending' and new.status = 'approved' then
    perform public.notify(array[new.id], 'account_approved', 'Welcome to UniConnect!',
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

-- Profile cards show the batch and whether the person is its class rep.
create or replace view public.profile_cards with (security_invoker = true) as
  select p.id,
         p.full_name,
         p.username::text as username,
         p.avatar_url,
         p.role,
         p.department_id,
         d.name as department_name,
         x.year_of_study,
         x.bio,
         x.interests,
         x.expertise,
         p.profile_visibility,
         p.created_at,
         p.batch_id,
         b.name as batch_name,
         exists (select 1 from public.batches rb where rb.rep_id = p.id) as is_class_rep
  from public.profiles p
  left join public.departments d on d.id = p.department_id
  left join public.batches b on b.id = p.batch_id
  left join lateral public.profile_visible_details(p.id) x(year_of_study, bio, interests, expertise) on true;

-- Function privileges: callable by signed-in users only; internal helpers by nobody.
revoke all on function public.my_batch_id() from public, anon;
revoke all on function public.manages_department(uuid) from public, anon;
revoke all on function public.teaches_batch(uuid) from public, anon;
revoke all on function public.create_batch(uuid, integer) from public, anon;
revoke all on function public.set_batch_lecturer(uuid, uuid, boolean) from public, anon;
revoke all on function public.set_batch_rep(uuid, uuid) from public, anon;
revoke all on function public.assign_student_batch(uuid, uuid) from public, anon;
revoke all on function public.set_space_role(uuid, uuid, public.member_role) from public, anon;
revoke all on function public.admin_set_user_status(uuid, public.account_status, text, public.user_role, timestamptz, uuid) from public, anon;
revoke all on function public.admin_list_accounts(public.account_status, integer) from public, anon;
revoke all on function public.admin_search_users(text, public.user_role, public.account_status, uuid, integer, integer) from public, anon;
revoke all on function public.admin_user_detail(uuid) from public, anon;
grant execute on function
  public.my_batch_id(),
  public.manages_department(uuid),
  public.teaches_batch(uuid),
  public.create_batch(uuid, integer),
  public.set_batch_lecturer(uuid, uuid, boolean),
  public.set_batch_rep(uuid, uuid),
  public.assign_student_batch(uuid, uuid),
  public.set_space_role(uuid, uuid, public.member_role),
  public.admin_set_user_status(uuid, public.account_status, text, public.user_role, timestamptz, uuid),
  public.admin_list_accounts(public.account_status, integer),
  public.admin_search_users(text, public.user_role, public.account_status, uuid, integer, integer),
  public.admin_user_detail(uuid)
  to authenticated;

revoke all on function public.sync_auto_memberships(uuid) from public, anon, authenticated;
revoke all on function public.sync_profile_memberships() from public, anon, authenticated;
revoke all on function public.sync_lecturer_memberships() from public, anon, authenticated;
revoke all on function public.check_profile_batch() from public, anon, authenticated;
revoke all on function public.normalize_post_audience() from public, anon, authenticated;

-- Bring existing memberships in line: everyone belongs to their own department's space only.
select public.sync_auto_memberships(id) from public.profiles;
