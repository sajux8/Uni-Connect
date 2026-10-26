-- 0036: where the current member may place an event, and whether it needs approval there (Phase C).
-- The event form uses this for "Where should this appear?". A null space_id means campus-wide.

create or replace function public.my_event_placements()
returns table (space_id uuid, name text, type public.space_type, needs_review boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from (
    select null::uuid, 'Everyone on campus'::text, null::public.space_type, false
    where public.has_role('super_admin')
    union all
    select s.id, s.name, s.type, not public.can_review_event_space(s.id)
    from public.spaces s
    where s.type in ('department', 'batch', 'club') and not s.is_archived
      and public.can_place_event_in(s.id)
  ) p (space_id, name, type, needs_review)
  order by case p.type when 'batch' then 1 when 'department' then 2 when 'club' then 3 else 0 end, p.name;
$$;

revoke all on function public.my_event_placements() from public, anon;
grant execute on function public.my_event_placements() to authenticated;
