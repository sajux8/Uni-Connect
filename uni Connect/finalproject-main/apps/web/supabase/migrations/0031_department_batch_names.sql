-- 0031: members can see the names of their own department's batch spaces (not their posts), so a
-- department feed can label posts a batch shared with the whole department, and the department page
-- can list its batches. Content inside a batch space still needs can_view_space (0029).

drop policy spaces_select on public.spaces;
create policy spaces_select on public.spaces for select to authenticated
  using (
    (select public.is_approved())
    and (not is_archived or (select public.has_role('super_admin')))
    and (
      type not in ('department', 'batch')
      or (select public.has_role('super_admin'))
      or department_id = (select cp.department_id from public.current_profile() cp)
      or (type = 'batch' and exists (
            select 1 from public.batches b
            where b.space_id = spaces.id and public.teaches_batch(b.id)))
    )
  );
