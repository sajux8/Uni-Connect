-- 0043: opportunities (Phase G, 0044) can be bookmarked. Enum values need their own migration.
alter type public.bookmark_target add value if not exists 'opportunity';
