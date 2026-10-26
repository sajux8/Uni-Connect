-- 0028: enum values for departments and batches (Phase B). New enum values can't be used in the
-- transaction that adds them, so they get their own migration before 0029 uses them.

alter type public.space_type add value if not exists 'batch';
alter type public.member_role add value if not exists 'captain';

alter type public.moderation_action_type add value if not exists 'assign_batch';
alter type public.moderation_action_type add value if not exists 'assign_lecturer';
alter type public.moderation_action_type add value if not exists 'remove_lecturer';
alter type public.moderation_action_type add value if not exists 'set_class_rep';
alter type public.moderation_action_type add value if not exists 'set_space_role';
