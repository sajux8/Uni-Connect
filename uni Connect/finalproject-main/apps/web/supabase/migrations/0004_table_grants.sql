-- 0004: table privileges for the API roles
-- This project's default privileges give anon/authenticated/service_role nothing on new
-- tables, so each table needs explicit grants. Grants decide which *operations* a role
-- may attempt; the RLS policies in 0002/0003 still decide which *rows*. From now on every
-- migration that creates a table also grants its privileges.

-- departments: public read (registration form); writes are admin-only via RLS.
grant select on public.departments to anon, authenticated;
grant insert, update, delete on public.departments to authenticated;

-- profiles: read via RLS; updates limited to the columns granted in 0002.
grant select on public.profiles to authenticated;

-- profile_private: owner/admin read; owner edits id_number/application_note while pending (0002).
grant select on public.profile_private to authenticated;

-- user_blocks: manage your own blocks.
grant select, insert, delete on public.user_blocks to authenticated;

-- account_deletion_requests: users file their own (only these columns); admins update.
grant select on public.account_deletion_requests to authenticated;
grant insert (user_id, reason) on public.account_deletion_requests to authenticated;
grant update on public.account_deletion_requests to authenticated;

-- moderation_actions: read-only for the API (rows are written by SECURITY DEFINER RPCs).
grant select on public.moderation_actions to authenticated;

-- Trusted server code (service role) bypasses RLS but still needs table privileges.
grant select, insert, update, delete on
  public.departments, public.profiles, public.profile_private, public.user_blocks,
  public.account_deletion_requests
to service_role;
grant select, insert on public.moderation_actions to service_role;
grant select on public.profile_cards to service_role;
