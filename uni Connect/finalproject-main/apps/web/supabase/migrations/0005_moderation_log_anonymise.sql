-- 0005: let the append-only moderation log survive account deletion
-- Deleting an account sets moderation_actions.actor_id to null (ON DELETE SET NULL). The
-- append-only trigger blocked that update too, so moderators/admins could never be deleted.
-- Allow exactly that one change (actor_id -> null, nothing else); everything else still fails.

create or replace function public.prevent_moderation_log_changes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and old.actor_id is not null
     and new.actor_id is null
     and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
    return new;
  end if;
  raise exception 'moderation_actions is append-only';
end;
$$;
