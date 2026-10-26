-- 0020: deleting an account sets sender_id to null on its messages; the edit guard from
-- 0018 must let that through (users can't change sender_id: it has no column grant).

create or replace function public.prepare_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.messages
        where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
      raise exception 'You''re sending messages too quickly. Wait a moment and try again.' using errcode = '22023';
    end if;
    new.body := btrim(new.body);
    new.created_at := now();
    new.edited_at := null;
    new.deleted_at := null;
    return new;
  end if;

  -- A deleted account's messages lose their sender (on delete set null).
  if new.sender_id is null and old.sender_id is not null then
    return new;
  end if;
  if old.deleted_at is not null then
    raise exception 'This message was deleted' using errcode = '22023';
  end if;
  new.id := old.id;
  new.conversation_id := old.conversation_id;
  new.sender_id := old.sender_id;
  new.created_at := old.created_at;
  if new.deleted_at is not null then
    new.deleted_at := now();
    new.body := '';
    new.edited_at := old.edited_at;
  elsif new.body is distinct from old.body then
    if old.created_at < now() - interval '15 minutes' then
      raise exception 'Messages can only be edited for 15 minutes after sending' using errcode = '22023';
    end if;
    new.body := btrim(new.body);
    new.edited_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.prepare_message() from public, anon, authenticated;
