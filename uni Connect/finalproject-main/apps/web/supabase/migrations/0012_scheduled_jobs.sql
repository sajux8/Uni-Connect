-- 0012: scheduled jobs
-- Vercel Hobby only runs cron once a day, so jobs run in Postgres with pg_cron. Jobs that
-- need the app (sending email) call it over HTTP with pg_net; the app URL and the shared
-- CRON_SECRET live in Supabase Vault, written by `npm run setup:cron` (never in this file).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Store the app URL and cron secret in Vault. Service role only (called by scripts/setup-cron.mjs).
create or replace function public.set_cron_config(p_app_url text, p_cron_secret text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_app_url !~ '^https?://[^ ]+$' or char_length(coalesce(p_cron_secret, '')) < 32 then
    raise exception 'Give the app URL and a cron secret of at least 32 characters' using errcode = '22023';
  end if;

  select id into v_id from vault.secrets where name = 'app_url';
  if v_id is null then
    perform vault.create_secret(rtrim(p_app_url, '/'), 'app_url', 'ICBT Connect base URL for scheduled jobs');
  else
    perform vault.update_secret(v_id, rtrim(p_app_url, '/'));
  end if;

  v_id := null;
  select id into v_id from vault.secrets where name = 'cron_secret';
  if v_id is null then
    perform vault.create_secret(p_cron_secret, 'cron_secret', 'Bearer token for /api/cron/* (CRON_SECRET)');
  else
    perform vault.update_secret(v_id, p_cron_secret);
  end if;
end;
$$;
revoke execute on function public.set_cron_config(text, text) from public, anon, authenticated;
grant execute on function public.set_cron_config(text, text) to service_role;

-- Ask the app to send queued email (only when there is some, so idle projects stay quiet).
create or replace function public.request_outbox_run()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (select 1 from public.email_outbox where status = 'queued' and send_after <= now()) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url || '/api/cron/outbox',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
revoke execute on function public.request_outbox_run() from public, anon, authenticated;

select cron.schedule('publish-scheduled-announcements', '*/5 * * * *', 'select public.publish_scheduled_announcements()');
select cron.schedule('unpin-expired-announcements', '7 * * * *', 'select public.unpin_expired_announcements()');
select cron.schedule('send-queued-email', '*/5 * * * *', 'select public.request_outbox_run()');
select cron.schedule('cleanup-notifications', '30 21 * * *', 'select public.cleanup_notifications()'); -- 03:00 Colombo
