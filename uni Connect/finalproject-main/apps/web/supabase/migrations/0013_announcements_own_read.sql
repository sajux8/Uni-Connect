-- 0013: your own announcements are never "unread" for you
-- (0010 counted them, so a publisher saw a badge for what they had just published.)

create or replace function public.list_announcements(
  p_scope    text default 'all',          -- all | for_me | unread
  p_category public.announcement_category default null,
  p_limit    int default 20,
  p_offset   int default 0
)
returns table (
  id uuid,
  title text,
  excerpt text,
  category public.announcement_category,
  publishing_unit text,
  audience_all boolean,
  audience_department_ids uuid[],
  audience_years smallint[],
  is_pinned boolean,
  is_important boolean,
  published_at timestamptz,
  edited_at timestamptz,
  publisher_id uuid,
  publisher_name text,
  publisher_role public.user_role,
  is_read boolean,
  for_me boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select a.id, a.title, left(a.body_text, 280), a.category, a.publishing_unit, a.audience_all,
         a.audience_department_ids, a.audience_years,
         a.is_pinned and (a.pinned_until is null or a.pinned_until > now()),
         a.is_important, a.published_at, a.edited_at, a.publisher_id, p.full_name, p.role,
         r.user_id is not null or a.publisher_id = (select auth.uid()),
         public.announcement_for_me(a)
  from public.announcements a
  left join public.profiles p on p.id = a.publisher_id
  left join public.announcement_reads r on r.announcement_id = a.id and r.user_id = (select auth.uid())
  where a.status = 'published'
    and (p_category is null or a.category = p_category)
    and (p_scope <> 'for_me' or public.announcement_for_me(a))
    and (p_scope <> 'unread' or (r.user_id is null
                                 and a.publisher_id is distinct from (select auth.uid())
                                 and public.announcement_for_me(a)))
  order by a.published_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

create or replace function public.unread_announcement_count()
returns int
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.announcements a
  where a.status = 'published'
    and a.publisher_id is distinct from (select auth.uid())
    and a.published_at > greatest(
      now() - interval '30 days',
      coalesce((select p.approved_at from public.profiles p where p.id = (select auth.uid())), now())
    )
    and public.announcement_for_me(a)
    and not exists (
      select 1 from public.announcement_reads r where r.announcement_id = a.id and r.user_id = (select auth.uid())
    );
$$;
