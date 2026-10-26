-- 0026: the product is renamed from "ICBT Connect" to "UniConnect".
-- Only the welcome notification names the product in SQL; the rest of the function is unchanged.

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

-- Notifications already delivered keep their meaning but use the new name.
update public.notifications
set title = replace(title, 'ICBT Connect', 'UniConnect')
where title like '%ICBT Connect%';
