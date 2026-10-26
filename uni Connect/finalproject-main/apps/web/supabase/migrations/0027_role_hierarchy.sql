-- 0027: Phase B roles. The four account roles become the college's real ones:
--   organizer -> lecturer, moderator -> coordinator, admin -> super_admin (student is unchanged).
-- Renaming keeps every stored row and every policy constant pointing at the right value, and the enum
-- order (student < lecturer < coordinator < super_admin) is now a hierarchy.
-- Class representative and club captain are positions held by students (0029), not account roles.

alter type public.user_role rename value 'organizer' to 'lecturer';
alter type public.user_role rename value 'moderator' to 'coordinator';
alter type public.user_role rename value 'admin' to 'super_admin';

-- has_role(...) now means "at least the lowest role listed": has_role('lecturer', 'super_admin') lets
-- lecturers, coordinators and super admins through. Every existing caller lists a contiguous range
-- ending at the top role, so this keeps their meaning while letting coordinators publish and
-- lecturers count as staff.
create or replace function public.has_role(variadic roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select status = 'approved' and role >= (select min(r) from unnest(roles) r)
     from public.current_profile()),
    false
  );
$$;

-- Function bodies are stored as text, so the old role names inside them are rewritten here.
-- Only account-role checks change; 'moderator' as a space-member role (member_role) is left alone.
do $$
declare
  r     record;
  v_def text;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname <> 'has_role'
      and p.prosrc ~ '''(admin|organizer)'''
  loop
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, $q$has_role('organizer', 'moderator', 'admin')$q$,
                            $q$has_role('lecturer', 'coordinator', 'super_admin')$q$);
    v_def := replace(v_def, $q$has_role('moderator', 'admin')$q$, $q$has_role('coordinator', 'super_admin')$q$);
    v_def := replace(v_def, $q$has_role('organizer', 'admin')$q$, $q$has_role('lecturer', 'super_admin')$q$);
    v_def := replace(v_def, $q$has_role('admin')$q$, $q$has_role('super_admin')$q$);
    v_def := replace(v_def, $q$role in ('moderator', 'admin')$q$, $q$role in ('coordinator', 'super_admin')$q$);
    v_def := replace(v_def, $q$role = 'admin'$q$, $q$role = 'super_admin'$q$);
    if v_def ~ '''(admin|organizer)''' then
      raise exception 'Unhandled role literal left in %', r.proname;
    end if;
    execute v_def;
  end loop;
end;
$$;
