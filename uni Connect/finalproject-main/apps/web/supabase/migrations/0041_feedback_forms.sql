-- 0041: feedback forms (Phase E).
--
-- * Staff build forms (Google Forms style) for their department or some of its batches: super admins
--   anywhere, coordinators in their own department, lecturers for the batches they teach. A
--   coordinator's form can be about one lecturer, who then sees its results.
-- * Anonymous by design: `form_submissions` records only *that* a student answered (one answer each);
--   `form_answers` hold the answers with no user id, a random response id and only the day. Both are
--   written by `submit_form` in one transaction.
-- * Results (answers, response counts) are visible to the form's creator, the lecturer it's about,
--   the department's coordinator and super admins.
-- * All writes go through the RPCs below; the tables only grant select.

create table public.forms (
  id                uuid primary key default gen_random_uuid(),
  created_by        uuid references public.profiles (id) on delete set null,
  department_id     uuid not null references public.departments (id) on delete cascade,
  -- Empty = every student in the department.
  batch_ids         uuid[] not null default '{}',
  about_lecturer_id uuid references public.profiles (id) on delete set null,
  title             text not null check (char_length(title) between 3 and 150),
  description       text not null default '' check (char_length(description) <= 2000),
  status            text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  closes_at         timestamptz,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index forms_department_idx on public.forms (department_id, status);
create index forms_created_by_idx on public.forms (created_by);
create index forms_about_idx on public.forms (about_lecturer_id);
create index forms_batches_idx on public.forms using gin (batch_ids);

create table public.form_questions (
  id              uuid primary key default gen_random_uuid(),
  form_id         uuid not null references public.forms (id) on delete cascade,
  position        smallint not null,
  type            text not null check (type in
                    ('short', 'paragraph', 'choice', 'checkboxes', 'dropdown', 'scale', 'rating', 'section')),
  prompt          text not null check (char_length(prompt) between 1 and 300),
  help_text       text not null default '' check (char_length(help_text) <= 500),
  required        boolean not null default false,
  options         text[] not null default '{}' check (cardinality(options) <= 20),
  scale_max       smallint check (scale_max in (5, 10)),
  scale_min_label text check (char_length(scale_min_label) <= 40),
  scale_max_label text check (char_length(scale_max_label) <= 40),
  unique (form_id, position)
);

-- That a student answered (never what). The batch is kept for response rates per batch.
create table public.form_submissions (
  form_id      uuid not null references public.forms (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  batch_id     uuid references public.batches (id) on delete set null,
  submitted_on date not null,
  primary key (form_id, user_id)
);

-- What was answered (never by whom).
create table public.form_answers (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references public.forms (id) on delete cascade,
  question_id   uuid not null references public.form_questions (id) on delete cascade,
  response_id   uuid not null,
  value_text    text check (char_length(value_text) <= 2000),
  value_options text[],
  value_number  smallint,
  answered_on   date not null
);
create index form_answers_form_idx on public.form_answers (form_id);
create index form_answers_question_idx on public.form_answers (question_id);

-- Helpers --------------------------------------------------------------------------------------

-- Is the signed-in member a student this form is for?
create or replace function public.form_targets_me(p_department_id uuid, p_batch_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved' and p.role = 'student'
      and p.department_id = p_department_id
      and (cardinality(p_batch_ids) = 0 or p.batch_id = any (p_batch_ids))
  );
$$;

-- Results: the creator, the lecturer it's about (once published), the department's coordinator,
-- super admins.
create or replace function public.can_see_form_results(p_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and exists (
    select 1 from public.forms f
    where f.id = p_form_id
      and (f.created_by = auth.uid()
           or (f.about_lecturer_id = auth.uid() and f.status <> 'draft')
           or public.manages_department(f.department_id))
  );
$$;

-- Editing, publishing and deleting: the creator, the department's coordinator, super admins.
create or replace function public.can_manage_form(p_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and exists (
    select 1 from public.forms f
    where f.id = p_form_id and (f.created_by = auth.uid() or public.manages_department(f.department_id))
  );
$$;

-- Grants and RLS -------------------------------------------------------------------------------

alter table public.forms enable row level security;
alter table public.form_questions enable row level security;
alter table public.form_submissions enable row level security;
alter table public.form_answers enable row level security;

grant select on public.forms, public.form_questions, public.form_submissions, public.form_answers
  to authenticated;
grant select, insert, update, delete on public.forms, public.form_questions, public.form_submissions,
  public.form_answers to service_role;

create policy forms_select on public.forms for select to authenticated
  using (
    created_by = (select auth.uid())
    or public.manages_department(department_id)
    or (status <> 'draft'
        and (about_lecturer_id = (select auth.uid()) or public.form_targets_me(department_id, batch_ids)))
  );
create policy form_questions_select on public.form_questions for select to authenticated
  using (exists (select 1 from public.forms f where f.id = form_questions.form_id));
create policy form_submissions_select on public.form_submissions for select to authenticated
  using (user_id = (select auth.uid()));
create policy form_answers_select on public.form_answers for select to authenticated
  using (public.can_see_form_results(form_id));

-- RPCs -----------------------------------------------------------------------------------------

-- Creates or updates a form with its questions (a jsonb array, in order). Once anyone has answered,
-- only the title, description and closing time can change.
create or replace function public.save_form(
  p_form_id           uuid,
  p_department_id     uuid,
  p_batch_ids         uuid[],
  p_about_lecturer_id uuid,
  p_title             text,
  p_description       text,
  p_closes_at         timestamptz,
  p_questions         jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_form public.forms%rowtype;
  v_id uuid := p_form_id;
  v_batches uuid[] := coalesce(p_batch_ids, '{}');
  v_about uuid := p_about_lecturer_id;
  q jsonb;
  v_type text;
  v_options text[];
  v_answerable integer := 0;
begin
  if not public.has_role('lecturer') then
    raise exception 'Only staff can create feedback forms' using errcode = '42501';
  end if;

  if p_form_id is not null then
    select * into v_form from public.forms where id = p_form_id for update;
    if not found then
      raise exception 'Form not found' using errcode = 'P0002';
    end if;
    if not public.can_manage_form(p_form_id) then
      raise exception 'Only the form''s creator or the department''s coordinator can change it' using errcode = '42501';
    end if;
    if exists (select 1 from public.form_submissions where form_id = p_form_id) then
      update public.forms
      set title = trim(p_title), description = trim(coalesce(p_description, '')), closes_at = p_closes_at,
          updated_at = now()
      where id = p_form_id;
      return p_form_id;
    end if;
  end if;

  -- Audience: super admins anywhere; coordinators their department; lecturers the batches they teach.
  if exists (select 1 from unnest(v_batches) b
             where not exists (select 1 from public.batches x where x.id = b and x.department_id = p_department_id)) then
    raise exception 'Those batches aren''t in that department' using errcode = '22023';
  end if;
  if not public.manages_department(p_department_id) then
    if cardinality(v_batches) = 0 then
      raise exception 'Choose the batches you teach' using errcode = '22023';
    end if;
    if exists (select 1 from unnest(v_batches) b where not public.teaches_batch(b)) then
      raise exception 'You can only ask the batches you teach' using errcode = '42501';
    end if;
    v_about := null; -- only coordinators and super admins ask about a lecturer
  end if;
  if v_about is not null and not exists (
    select 1 from public.profiles l
    where l.id = v_about and l.status = 'approved' and l.role in ('lecturer', 'coordinator')
      and (exists (select 1 from public.batch_lecturers bl where bl.lecturer_id = l.id and bl.batch_id = any (v_batches))
           or (cardinality(v_batches) = 0 and l.department_id = p_department_id))
  ) then
    raise exception 'Pick a lecturer who teaches those batches' using errcode = '22023';
  end if;

  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 50 then
    raise exception 'A form needs between 1 and 50 questions' using errcode = '22023';
  end if;
  for q in select * from jsonb_array_elements(p_questions) loop
    v_type := q ->> 'type';
    if v_type in ('choice', 'checkboxes', 'dropdown') then
      v_options := array(select jsonb_array_elements_text(coalesce(q -> 'options', '[]')));
      if cardinality(v_options) < 2 or exists (select 1 from unnest(v_options) o where trim(o) = '') then
        raise exception 'Give “%” at least two options', left(q ->> 'prompt', 60) using errcode = '22023';
      end if;
    end if;
    if v_type <> 'section' then
      v_answerable := v_answerable + 1;
    end if;
  end loop;
  if v_answerable = 0 then
    raise exception 'Add at least one question to answer' using errcode = '22023';
  end if;

  if p_form_id is null then
    insert into public.forms (created_by, department_id, batch_ids, about_lecturer_id, title, description, closes_at)
    values (auth.uid(), p_department_id, v_batches, v_about, trim(p_title), trim(coalesce(p_description, '')),
            p_closes_at)
    returning id into v_id;
  else
    update public.forms
    set department_id = p_department_id, batch_ids = v_batches, about_lecturer_id = v_about,
        title = trim(p_title), description = trim(coalesce(p_description, '')), closes_at = p_closes_at,
        updated_at = now()
    where id = p_form_id;
    delete from public.form_questions where form_id = p_form_id;
  end if;

  insert into public.form_questions
    (form_id, position, type, prompt, help_text, required, options, scale_max, scale_min_label, scale_max_label)
  select v_id, e.ord, e.q ->> 'type', trim(e.q ->> 'prompt'), trim(coalesce(e.q ->> 'help', '')),
         coalesce((e.q ->> 'required')::boolean, false) and e.q ->> 'type' <> 'section',
         case when e.q ->> 'type' in ('choice', 'checkboxes', 'dropdown')
              then array(select trim(o) from jsonb_array_elements_text(e.q -> 'options') o)
              else '{}' end,
         case when e.q ->> 'type' = 'scale' then coalesce((e.q ->> 'scaleMax')::smallint, 5) end,
         case when e.q ->> 'type' = 'scale' then nullif(trim(e.q ->> 'minLabel'), '') end,
         case when e.q ->> 'type' = 'scale' then nullif(trim(e.q ->> 'maxLabel'), '') end
  from jsonb_array_elements(p_questions) with ordinality as e(q, ord);

  return v_id;
end;
$$;

-- Publishes (students are told), closes, reopens or takes a form back to draft.
create or replace function public.set_form_status(p_form_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f public.forms%rowtype;
  v_recipients uuid[];
begin
  select * into f from public.forms where id = p_form_id for update;
  if not found then
    raise exception 'Form not found' using errcode = 'P0002';
  end if;
  if not public.can_manage_form(p_form_id) then
    raise exception 'Only the form''s creator or the department''s coordinator can change it' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'open', 'closed') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  if p_status = f.status then
    return;
  end if;
  if p_status = 'draft' and exists (select 1 from public.form_submissions where form_id = p_form_id) then
    raise exception 'Students have already answered; close the form instead' using errcode = '22023';
  end if;
  if p_status = 'open' and f.closes_at is not null and f.closes_at <= now() then
    raise exception 'The closing time has passed; choose a new one first' using errcode = '22023';
  end if;

  update public.forms
  set status = p_status, published_at = case when p_status = 'open' then coalesce(published_at, now()) else published_at end,
      updated_at = now()
  where id = p_form_id;

  if p_status = 'open' and f.published_at is null then
    select coalesce(array_agg(p.id), '{}') into v_recipients
    from public.profiles p
    where p.status = 'approved' and p.role = 'student' and p.department_id = f.department_id
      and (cardinality(f.batch_ids) = 0 or p.batch_id = any (f.batch_ids));
    perform public.notify(v_recipients, 'form_open', 'Feedback wanted: ' || f.title,
      'Anonymous: nobody can see which answers are yours.'
        || coalesce(' Closes ' || public.campus_time_label(f.closes_at) || '.', ''),
      '/forms/' || f.id, auth.uid(), 'form', f.id);
  end if;
end;
$$;

create or replace function public.delete_form(p_form_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.forms where id = p_form_id) then
    return;
  end if;
  if not public.can_manage_form(p_form_id) then
    raise exception 'Only the form''s creator or the department''s coordinator can delete it' using errcode = '42501';
  end if;
  delete from public.forms where id = p_form_id;
end;
$$;

-- A student answers once. p_answers maps question id → text, number or array of options.
create or replace function public.submit_form(p_form_id uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f public.forms%rowtype;
  q public.form_questions%rowtype;
  v jsonb;
  v_response uuid := gen_random_uuid();
  v_today date := (now() at time zone 'Asia/Colombo')::date;
  v_text text;
  v_number integer;
  v_options text[];
  v_max integer;
begin
  select * into f from public.forms where id = p_form_id;
  if not found or not public.form_targets_me(f.department_id, f.batch_ids) or f.status = 'draft' then
    raise exception 'Form not found' using errcode = 'P0002';
  end if;
  if f.status <> 'open' or (f.closes_at is not null and f.closes_at <= now()) then
    raise exception 'This form is closed' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_answers, '{}')) <> 'object' then
    raise exception 'Those answers aren''t valid' using errcode = '22023';
  end if;

  insert into public.form_submissions (form_id, user_id, batch_id, submitted_on)
  values (p_form_id, auth.uid(), public.my_batch_id(), v_today)
  on conflict (form_id, user_id) do nothing;
  if not found then
    raise exception 'You''ve already answered this form' using errcode = '22023';
  end if;

  for q in select * from public.form_questions where form_id = p_form_id and type <> 'section' order by position loop
    v := p_answers -> q.id::text;
    v_text := null; v_number := null; v_options := null;
    if v is not null and jsonb_typeof(v) <> 'null' then
      if q.type in ('short', 'paragraph', 'choice', 'dropdown') then
        v_text := trim(v #>> '{}');
        if v_text = '' then
          v_text := null;
        elsif q.type = 'short' and char_length(v_text) > 300 or char_length(v_text) > 2000 then
          raise exception 'Your answer to “%” is too long', left(q.prompt, 60) using errcode = '22023';
        elsif q.type in ('choice', 'dropdown') and not v_text = any (q.options) then
          raise exception 'Pick one of the options for “%”', left(q.prompt, 60) using errcode = '22023';
        end if;
      elsif q.type = 'checkboxes' then
        if jsonb_typeof(v) <> 'array' then
          raise exception 'Those answers aren''t valid' using errcode = '22023';
        end if;
        v_options := array(select distinct x from jsonb_array_elements_text(v) x);
        if exists (select 1 from unnest(v_options) x where not x = any (q.options)) then
          raise exception 'Pick from the options for “%”', left(q.prompt, 60) using errcode = '22023';
        end if;
        if cardinality(v_options) = 0 then
          v_options := null;
        end if;
      else -- scale, rating
        if jsonb_typeof(v) <> 'number' then
          raise exception 'Those answers aren''t valid' using errcode = '22023';
        end if;
        v_number := (v #>> '{}')::numeric::integer;
        v_max := coalesce(q.scale_max, 5); -- star ratings are always out of 5
        if v_number < 1 or v_number > v_max then
          raise exception 'Pick a value on the scale for “%”', left(q.prompt, 60) using errcode = '22023';
        end if;
      end if;
    end if;

    if v_text is null and v_number is null and v_options is null then
      if q.required then
        raise exception 'Answer “%”', left(q.prompt, 60) using errcode = '22023';
      end if;
      continue;
    end if;
    insert into public.form_answers (form_id, question_id, response_id, value_text, value_options, value_number, answered_on)
    values (p_form_id, q.id, v_response, v_text, v_options, v_number, v_today);
  end loop;
end;
$$;

-- Who was asked and how many answered, per batch (no names). For results viewers only.
create or replace function public.form_response_counts(p_form_id uuid)
returns table (batch_id uuid, batch_name text, students integer, responded integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  f public.forms%rowtype;
begin
  if not public.can_see_form_results(p_form_id) then
    raise exception 'Only the form''s creator, the lecturer it''s about or the coordinator can see this' using errcode = '42501';
  end if;
  select * into f from public.forms where id = p_form_id;
  return query
  with asked as (
    select p.id, p.batch_id
    from public.profiles p
    where p.status = 'approved' and p.role = 'student' and p.department_id = f.department_id
      and (cardinality(f.batch_ids) = 0 or p.batch_id = any (f.batch_ids))
  ), groups as (
    select a.batch_id, count(*)::integer as students from asked a group by a.batch_id
    union
    select s.batch_id, 0 from public.form_submissions s
    where s.form_id = p_form_id and not exists (select 1 from asked a where a.batch_id is not distinct from s.batch_id)
  )
  select g.batch_id, coalesce(b.name, 'No batch'), max(g.students)::integer,
    (select count(*) from public.form_submissions s
     where s.form_id = p_form_id and s.batch_id is not distinct from g.batch_id)::integer
  from groups g
  left join public.batches b on b.id = g.batch_id
  group by g.batch_id, b.name, b.number
  order by b.number desc nulls last;
end;
$$;

-- Notification type (delivery defaults; label in lib/notifications.ts).
insert into public.notification_types (type, in_app_default, email_default, email_available, locked, sort_order)
values ('form_open', true, false, true, false, 81)
on conflict (type) do nothing;

-- Function grants ------------------------------------------------------------------------------

revoke execute on function public.form_targets_me(uuid, uuid[]) from public, anon;
revoke execute on function public.can_see_form_results(uuid) from public, anon;
revoke execute on function public.can_manage_form(uuid) from public, anon;
revoke execute on function public.save_form(uuid, uuid, uuid[], uuid, text, text, timestamptz, jsonb) from public, anon;
revoke execute on function public.set_form_status(uuid, text) from public, anon;
revoke execute on function public.delete_form(uuid) from public, anon;
revoke execute on function public.submit_form(uuid, jsonb) from public, anon;
revoke execute on function public.form_response_counts(uuid) from public, anon;

grant execute on function public.form_targets_me(uuid, uuid[]), public.can_see_form_results(uuid),
  public.can_manage_form(uuid), public.save_form(uuid, uuid, uuid[], uuid, text, text, timestamptz, jsonb),
  public.set_form_status(uuid, text), public.delete_form(uuid), public.submit_form(uuid, jsonb),
  public.form_response_counts(uuid)
  to authenticated;
