-- 0032: posts are inserted with column grants (0004), so the new audience column (0029) needs its own
-- insert grant; without it every post that sets "batch only" or "whole department" is refused.

grant insert (audience) on public.posts to authenticated;
