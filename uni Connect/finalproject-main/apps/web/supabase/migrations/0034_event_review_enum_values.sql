-- 0034: event approval (Phase C). New enum values get their own migration because
-- they can't be used in the transaction that adds them.

alter type public.event_status add value if not exists 'pending_review' after 'draft';
alter type public.event_status add value if not exists 'rejected' after 'pending_review';

alter type public.moderation_action_type add value if not exists 'approve_event';
alter type public.moderation_action_type add value if not exists 'reject_event';
