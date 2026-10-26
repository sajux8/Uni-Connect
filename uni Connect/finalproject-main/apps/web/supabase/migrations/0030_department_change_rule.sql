-- 0030: applicants can still correct their department while their account is pending, but once
-- approved a member's department only changes through their coordinator or a super admin
-- (assign_student_batch, admin_set_user_status). 0029 revoked the column grant outright, which also
-- blocked editing a pending application, so the rule moves into a trigger.

grant update (department_id) on public.profiles to authenticated;

create or replace function public.guard_department_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.department_id is distinct from old.department_id
     and new.id = auth.uid()
     and old.status <> 'pending' then
    raise exception 'Your department can only be changed by your coordinator' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_department
  before update of department_id on public.profiles
  for each row execute function public.guard_department_change();

revoke all on function public.guard_department_change() from public, anon, authenticated;
