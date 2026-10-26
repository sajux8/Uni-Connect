-- 0046: Ask AI indexes the newest queued content first, so someone who posts and then asks finds
-- their own post even when a backlog is waiting. The scheduled job keeps working oldest first.

drop function public.claim_ai_index_batch(integer);

create or replace function public.claim_ai_index_batch(p_limit integer default 50, p_newest_first boolean default false)
returns table (source_type text, source_id uuid)
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.ai_index_queue q
  where (q.source_type, q.source_id) in (
    select i.source_type, i.source_id from public.ai_index_queue i
    order by case when p_newest_first then i.queued_at end desc, i.queued_at
    limit least(greatest(p_limit, 1), 200)
    for update skip locked
  )
  returning q.source_type, q.source_id;
$$;
revoke execute on function public.claim_ai_index_batch(integer, boolean) from public, anon, authenticated;
grant execute on function public.claim_ai_index_batch(integer, boolean) to service_role;
