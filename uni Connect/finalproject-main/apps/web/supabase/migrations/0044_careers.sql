-- 0044: careers (Phase G).
--
-- * Coordinators post internships, part-time jobs and graduate roles to their department or some of
--   its batches; super admins can also post campus-wide (department_id null).
-- * Members see open and closed opportunities meant for them; an opportunity past its deadline
--   counts as closed. A new opportunity tells its audience (students) in the app.
-- * Writes go through the RPCs below; the table only grants select.

create table public.opportunities (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 3 and 150),
  company       text not null check (char_length(company) between 2 and 120),
  type          text not null check (type in ('internship', 'part_time', 'graduate')),
  mode          text not null check (mode in ('on_site', 'remote', 'hybrid')),
  location      text check (char_length(location) <= 120),
  description   text not null check (char_length(description) between 20 and 5000),
  apply_url     text check (apply_url ~ '^https://' and char_length(apply_url) <= 500),
  apply_email   text check (apply_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(apply_email) <= 200),
  deadline      timestamptz,
  -- Null = campus-wide (super admins only). Empty batch_ids = the whole department.
  department_id uuid references public.departments (id) on delete cascade,
  batch_ids     uuid[] not null default '{}',
  posted_by     uuid references public.profiles (id) on delete set null,
  status        text not null default 'open' check (status in ('open', 'closed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (apply_url is not null or apply_email is not null),
  check (department_id is not null or cardinality(batch_ids) = 0)
);
create index opportunities_department_idx on public.opportunities (department_id, status, deadline);
create index opportunities_batches_idx on public.opportunities using gin (batch_ids);

-- Is this opportunity meant for the signed-in member?
create or replace function public.opportunity_for_me(p_department_id uuid, p_batch_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and (
    p_department_id is null
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.department_id = p_department_id
        and (cardinality(p_batch_ids) = 0
             or p.batch_id = any (p_batch_ids)
             or exists (select 1 from public.batch_lecturers bl
                        where bl.lecturer_id = p.id and bl.batch_id = any (p_batch_ids)))
    )
  );
$$;

-- Posting: super admins anywhere (also campus-wide), coordinators in their own department.
create or replace function public.can_post_opportunity(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and (
    public.has_role('super_admin')
    or (p_department_id is not null and public.has_role('coordinator') and public.manages_department(p_department_id))
  );
$$;

alter table public.opportunities enable row level security;
grant select on public.opportunities to authenticated;
grant select, insert, update, delete on public.opportunities to service_role;

create policy opportunities_select on public.opportunities for select to authenticated
  using (
    posted_by = (select auth.uid())
    or public.opportunity_for_me(department_id, batch_ids)
    or public.can_post_opportunity(department_id)
  );

-- Bookmarks of deleted opportunities go too (0016).
create trigger opportunities_delete_bookmarks after delete on public.opportunities
  for each row execute function public.delete_bookmarks_of('opportunity');

-- Creates or updates an opportunity. A new one tells the students it's meant for.
create or replace function public.save_opportunity(
  p_id            uuid,
  p_title         text,
  p_company       text,
  p_type          text,
  p_mode          text,
  p_location      text,
  p_description   text,
  p_apply_url     text,
  p_apply_email   text,
  p_deadline      timestamptz,
  p_department_id uuid,
  p_batch_ids     uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := p_id;
  v_existing public.opportunities%rowtype;
  v_batches uuid[] := coalesce(p_batch_ids, '{}');
  v_recipients uuid[];
begin
  if p_id is not null then
    select * into v_existing from public.opportunities where id = p_id for update;
    if not found then
      raise exception 'Opportunity not found' using errcode = 'P0002';
    end if;
    if not public.can_post_opportunity(v_existing.department_id) then
      raise exception 'Only the department''s coordinator or a super admin can change this' using errcode = '42501';
    end if;
  end if;
  if not public.can_post_opportunity(p_department_id) then
    raise exception 'Coordinators post to their own department; only super admins post campus-wide' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(v_batches) b
             where not exists (select 1 from public.batches x where x.id = b and x.department_id = p_department_id)) then
    raise exception 'Those batches aren''t in that department' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.opportunities
      (title, company, type, mode, location, description, apply_url, apply_email, deadline, department_id, batch_ids, posted_by)
    values (trim(p_title), trim(p_company), p_type, p_mode, nullif(trim(p_location), ''), trim(p_description),
            nullif(trim(p_apply_url), ''), nullif(trim(p_apply_email), ''), p_deadline, p_department_id, v_batches,
            auth.uid())
    returning id into v_id;

    select coalesce(array_agg(p.id), '{}') into v_recipients
    from public.profiles p
    where p.status = 'approved' and p.role = 'student'
      and (p_department_id is null
           or (p.department_id = p_department_id
               and (cardinality(v_batches) = 0 or p.batch_id = any (v_batches))));
    perform public.notify(v_recipients, 'opportunity_new',
      case p_type when 'internship' then 'Internship' when 'part_time' then 'Part-time job'
                  else 'Graduate role' end || ': ' || trim(p_title) || ' at ' || trim(p_company),
      case when p_deadline is not null then 'Apply by ' || public.campus_time_label(p_deadline) || '.' end,
      '/careers/' || v_id, auth.uid(), 'opportunity', v_id);
  else
    update public.opportunities
    set title = trim(p_title), company = trim(p_company), type = p_type, mode = p_mode,
        location = nullif(trim(p_location), ''), description = trim(p_description),
        apply_url = nullif(trim(p_apply_url), ''), apply_email = nullif(trim(p_apply_email), ''),
        deadline = p_deadline, department_id = p_department_id, batch_ids = v_batches, updated_at = now()
    where id = p_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.set_opportunity_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.opportunities%rowtype;
begin
  select * into o from public.opportunities where id = p_id for update;
  if not found or not public.can_post_opportunity(o.department_id) then
    raise exception 'Only the department''s coordinator or a super admin can change this' using errcode = '42501';
  end if;
  if p_status not in ('open', 'closed') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  update public.opportunities set status = p_status, updated_at = now() where id = p_id;
end;
$$;

create or replace function public.delete_opportunity(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.opportunities%rowtype;
begin
  select * into o from public.opportunities where id = p_id;
  if not found then
    return;
  end if;
  if not public.can_post_opportunity(o.department_id) then
    raise exception 'Only the department''s coordinator or a super admin can delete this' using errcode = '42501';
  end if;
  delete from public.opportunities where id = p_id;
end;
$$;

insert into public.notification_types (type, in_app_default, email_default, email_available, locked, sort_order)
values ('opportunity_new', true, false, true, false, 85)
on conflict (type) do nothing;

revoke execute on function public.opportunity_for_me(uuid, uuid[]) from public, anon;
revoke execute on function public.can_post_opportunity(uuid) from public, anon;
revoke execute on function public.save_opportunity(uuid, text, text, text, text, text, text, text, text, timestamptz, uuid, uuid[]) from public, anon;
revoke execute on function public.set_opportunity_status(uuid, text) from public, anon;
revoke execute on function public.delete_opportunity(uuid) from public, anon;
grant execute on function public.opportunity_for_me(uuid, uuid[]), public.can_post_opportunity(uuid),
  public.save_opportunity(uuid, text, text, text, text, text, text, text, text, timestamptz, uuid, uuid[]),
  public.set_opportunity_status(uuid, text), public.delete_opportunity(uuid)
  to authenticated;
