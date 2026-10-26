-- 0024: automated tests delete the throwaway accounts they create; their open reports
-- (never acted on, so not in the moderation log) can go too. Reports that were handled stay:
-- the log refers to them.
grant delete on public.reports to service_role;
