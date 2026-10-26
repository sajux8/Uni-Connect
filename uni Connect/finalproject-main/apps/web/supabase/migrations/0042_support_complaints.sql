-- 0042: support inbox and complaint box (Phase F).
--
-- * Any approved member opens a ticket: a support request or a complaint (with categories and an
--   optional photo). It goes to their department's coordinators, or to campus management (super
--   admins) if they choose; safety and harassment complaints also reach the super admins.
-- * Anonymous by design: who owns a ticket lives in `ticket_owners`, readable only by that member.
--   `tickets.author_id` is filled only when the member isn't hiding their name; anonymous complaints
--   also drop the batch, and staff notifications about them have no actor. Anonymous complaints get
--   status updates (with a note) but no replies, so nothing can identify the student.
-- * Handlers: super admins (everything) and the department's coordinators (tickets routed to the
--   department). Status: open → in progress → resolved; staff replies and status changes notify the
--   owner, owner replies notify the handlers.
-- * Photos go to the private `ticket-photos` bucket through the server; they're served through
--   /api/tickets/[id]/photo after an RLS check. All writes go through RPCs.

create table public.tickets (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('support', 'complaint')),
  category         text not null,
  subject          text not null check (char_length(subject) between 3 and 150),
  body             text not null check (char_length(body) between 10 and 4000),
  department_id    uuid references public.departments (id) on delete set null,
  batch_id         uuid references public.batches (id) on delete set null,
  -- Null for anonymous complaints: the owner is only in ticket_owners.
  author_id        uuid references public.profiles (id) on delete set null,
  is_anonymous     boolean not null default false,
  route_to         text not null default 'department' check (route_to in ('department', 'management')),
  status           text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  assigned_to      uuid references public.profiles (id) on delete set null,
  photo_path       text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  check (
    (kind = 'support' and category in ('account', 'app', 'academic', 'other') and not is_anonymous)
    or (kind = 'complaint' and category in (
      'facilities_ac', 'facilities_projector', 'facilities_wifi', 'facilities_washrooms',
      'facilities_furniture', 'facilities_cleanliness', 'teaching_absent', 'teaching_quality',
      'timetable_admin', 'safety', 'harassment', 'other'))
  ),
  check (not is_anonymous or (author_id is null and batch_id is null))
);
create index tickets_department_idx on public.tickets (department_id, status, updated_at desc);
create index tickets_route_idx on public.tickets (route_to, status);

create table public.ticket_owners (
  ticket_id uuid primary key references public.tickets (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade
);
create index ticket_owners_user_idx on public.ticket_owners (user_id);

create table public.ticket_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.tickets (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  from_staff boolean not null,
  kind       text not null default 'reply' check (kind in ('reply', 'status')),
  status     text check (status in ('open', 'in_progress', 'resolved')),
  body       text check (char_length(body) <= 4000),
  created_at timestamptz not null default now(),
  check (kind = 'status' or char_length(body) >= 1)
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

-- Helpers --------------------------------------------------------------------------------------

create or replace function public.owns_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.ticket_owners o where o.ticket_id = p_ticket_id and o.user_id = auth.uid());
$$;

-- Super admins handle every ticket; coordinators the ones routed to their department.
create or replace function public.handles_ticket_scope(p_department_id uuid, p_route_to text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_approved() and (
    public.has_role('super_admin')
    or (p_route_to = 'department' and public.has_role('coordinator') and public.manages_department(p_department_id))
  );
$$;

create or replace function public.can_handle_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id and public.handles_ticket_scope(t.department_id, t.route_to)
  );
$$;

-- Everyone who handles a ticket (for notifications).
create or replace function public.ticket_handlers(p_ticket_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(p.id), '{}')
  from public.tickets t
  join public.profiles p on p.status = 'approved'
    and (p.role = 'super_admin'
         or (t.route_to = 'department' and p.role = 'coordinator' and p.department_id = t.department_id))
  where t.id = p_ticket_id;
$$;

-- Grants and RLS -------------------------------------------------------------------------------

alter table public.tickets enable row level security;
alter table public.ticket_owners enable row level security;
alter table public.ticket_messages enable row level security;

grant select on public.tickets, public.ticket_owners, public.ticket_messages to authenticated;
grant select, insert, update, delete on public.tickets, public.ticket_owners, public.ticket_messages
  to service_role;

create policy tickets_select on public.tickets for select to authenticated
  using (public.owns_ticket(id) or public.handles_ticket_scope(department_id, route_to));
create policy ticket_owners_select on public.ticket_owners for select to authenticated
  using (user_id = (select auth.uid()));
create policy ticket_messages_select on public.ticket_messages for select to authenticated
  using (public.owns_ticket(ticket_id) or public.can_handle_ticket(ticket_id));

-- Private bucket for complaint photos; only the server (service role) reads and writes it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-photos', 'ticket-photos', false, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- RPCs -----------------------------------------------------------------------------------------

create or replace function public.create_ticket(
  p_kind      text,
  p_category  text,
  p_subject   text,
  p_body      text,
  p_anonymous boolean,
  p_route_to  text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me public.profiles%rowtype;
  v_id uuid;
  v_anonymous boolean := coalesce(p_anonymous, false) and p_kind = 'complaint';
  v_route text := coalesce(p_route_to, 'department');
  v_recipients uuid[];
begin
  select * into me from public.profiles where id = auth.uid();
  if not found or me.status <> 'approved' then
    raise exception 'Only approved members can contact support' using errcode = '42501';
  end if;
  if (select count(*) from public.ticket_owners o join public.tickets t on t.id = o.ticket_id
      where o.user_id = me.id and t.created_at > now() - interval '1 day') >= 10 then
    raise exception 'You''ve sent 10 tickets today. Please wait before sending more' using errcode = '22023';
  end if;
  if me.department_id is null then
    v_route := 'management';
  end if;

  insert into public.tickets (kind, category, subject, body, department_id, batch_id, author_id, is_anonymous, route_to)
  values (p_kind, p_category, trim(p_subject), trim(p_body), me.department_id,
          case when v_anonymous then null else me.batch_id end,
          case when v_anonymous then null else me.id end,
          v_anonymous, v_route)
  returning id into v_id;
  insert into public.ticket_owners (ticket_id, user_id) values (v_id, me.id);

  v_recipients := public.ticket_handlers(v_id);
  if p_category not in ('safety', 'harassment') then
    -- Super admins see everything, but are only told about their own queue and urgent complaints.
    v_recipients := array(
      select r from unnest(v_recipients) r
      where v_route = 'management'
         or not exists (select 1 from public.profiles p where p.id = r and p.role = 'super_admin')
         or not exists (select 1 from public.profiles p
                        where p.role = 'coordinator' and p.status = 'approved' and p.department_id = me.department_id)
    );
  end if;
  perform public.notify(v_recipients, 'ticket_new',
    case when p_kind = 'complaint' then 'New complaint: ' else 'New support request: ' end || trim(p_subject),
    case when v_anonymous then 'Anonymous' else public.display_name(me.id) end,
    '/support/' || v_id, case when v_anonymous then null else me.id end, 'ticket', v_id);
  return v_id;
end;
$$;

-- The owner (not on anonymous complaints) or a handler replies.
create or replace function public.reply_ticket(p_ticket_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t public.tickets%rowtype;
  v_staff boolean;
  v_owner uuid;
  v_body text := trim(coalesce(p_body, ''));
begin
  select * into t from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;
  v_staff := public.can_handle_ticket(p_ticket_id);
  if not v_staff and not public.owns_ticket(p_ticket_id) then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;
  if t.is_anonymous then
    raise exception 'Anonymous complaints get status updates, not replies' using errcode = '22023';
  end if;
  if char_length(v_body) not between 1 and 4000 then
    raise exception 'Write a reply (up to 4,000 characters)' using errcode = '22023';
  end if;

  insert into public.ticket_messages (ticket_id, author_id, from_staff, kind, body)
  values (p_ticket_id, auth.uid(), v_staff, 'reply', v_body);
  update public.tickets
  set updated_at = now(),
      status = case when v_staff and status = 'open' then 'in_progress'
                    when not v_staff and status = 'resolved' then 'open'
                    else status end,
      resolved_at = case when not v_staff and status = 'resolved' then null else resolved_at end,
      assigned_to = case when v_staff then coalesce(assigned_to, auth.uid()) else assigned_to end
  where id = p_ticket_id;

  select user_id into v_owner from public.ticket_owners where ticket_id = p_ticket_id;
  perform public.notify(
    case when v_staff then array[v_owner]
         when t.assigned_to is not null then array[t.assigned_to]
         else public.ticket_handlers(p_ticket_id) end,
    'ticket_reply', 'New reply: ' || t.subject, left(v_body, 300), '/support/' || p_ticket_id,
    auth.uid(), 'ticket', p_ticket_id, true);
end;
$$;

-- Handlers move a ticket along, with an optional note the owner sees (also on anonymous complaints).
create or replace function public.set_ticket_status(p_ticket_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t public.tickets%rowtype;
  v_owner uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into t from public.tickets where id = p_ticket_id for update;
  if not found or not public.can_handle_ticket(p_ticket_id) then
    raise exception 'Only the coordinator or campus management can change a ticket' using errcode = '42501';
  end if;
  if p_status not in ('open', 'in_progress', 'resolved') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  if p_status = t.status and v_note is null then
    return;
  end if;
  if char_length(v_note) > 4000 then
    raise exception 'Keep the note under 4,000 characters' using errcode = '22023';
  end if;

  insert into public.ticket_messages (ticket_id, author_id, from_staff, kind, status, body)
  values (p_ticket_id, auth.uid(), true, 'status', p_status, v_note);
  update public.tickets
  set status = p_status, updated_at = now(),
      resolved_at = case when p_status = 'resolved' then now() else null end,
      assigned_to = coalesce(assigned_to, auth.uid())
  where id = p_ticket_id;

  select user_id into v_owner from public.ticket_owners where ticket_id = p_ticket_id;
  perform public.notify(array[v_owner], 'ticket_status',
    t.subject || ': ' || case p_status when 'open' then 'reopened' when 'in_progress' then 'in progress'
                                       else 'resolved' end,
    v_note, '/support/' || p_ticket_id, auth.uid(), 'ticket', p_ticket_id, true);
end;
$$;

-- Tickets waiting in the signed-in handler's inbox (for the sidebar badge).
create or replace function public.open_ticket_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer from public.tickets t
  where t.status = 'open' and public.handles_ticket_scope(t.department_id, t.route_to);
$$;

-- Notification types (delivery defaults; labels in lib/notifications.ts).
insert into public.notification_types (type, in_app_default, email_default, email_available, locked, sort_order)
values ('ticket_new', true, false, true, false, 82),
       ('ticket_reply', true, true, true, false, 83),
       ('ticket_status', true, true, true, false, 84)
on conflict (type) do nothing;

-- Function grants ------------------------------------------------------------------------------

revoke execute on function public.ticket_handlers(uuid) from public, anon, authenticated;
revoke execute on function public.owns_ticket(uuid) from public, anon;
revoke execute on function public.handles_ticket_scope(uuid, text) from public, anon;
revoke execute on function public.can_handle_ticket(uuid) from public, anon;
revoke execute on function public.create_ticket(text, text, text, text, boolean, text) from public, anon;
revoke execute on function public.reply_ticket(uuid, text) from public, anon;
revoke execute on function public.set_ticket_status(uuid, text, text) from public, anon;
revoke execute on function public.open_ticket_count() from public, anon;

grant execute on function public.owns_ticket(uuid), public.handles_ticket_scope(uuid, text),
  public.can_handle_ticket(uuid), public.create_ticket(text, text, text, text, boolean, text),
  public.reply_ticket(uuid, text), public.set_ticket_status(uuid, text, text), public.open_ticket_count()
  to authenticated;
