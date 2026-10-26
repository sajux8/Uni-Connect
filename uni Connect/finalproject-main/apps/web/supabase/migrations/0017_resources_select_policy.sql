-- 0017: the resources select policy checked can_view_resource(id), which looks the row up
-- again. During INSERT … RETURNING that lookup can't see the new row yet, so a student's own
-- upload was refused. Check the row's own columns instead (same rule).
drop policy resources_select on public.resources;
create policy resources_select on public.resources for select to authenticated
  using (
    (select public.is_approved())
    and (
      uploader_id = (select auth.uid())
      or (select public.has_role('moderator', 'admin'))
      or (status = 'approved' and (space_id is null or public.can_view_space(space_id)))
    )
  );
