-- 0001: extensions and enum types
-- Every later migration builds on these.
-- pg_cron / pg_net / vault are enabled in 0014 when the scheduled jobs are created.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext   with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists vector   with schema extensions;

-- People and access -----------------------------------------------------------
create type public.user_role           as enum ('student', 'organizer', 'moderator', 'admin');
create type public.account_status      as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.requested_role      as enum ('student', 'staff');
create type public.visibility_level    as enum ('everyone', 'department', 'only_me');
create type public.request_permission  as enum ('everyone', 'department', 'nobody');

-- Spaces, posts, Q&A -----------------------------------------------------------
create type public.space_type          as enum ('department', 'batch', 'module', 'club', 'general');
create type public.join_policy         as enum ('open', 'approval');
create type public.member_role         as enum ('member', 'moderator');
create type public.member_status       as enum ('active', 'pending', 'banned');
create type public.notify_level        as enum ('all', 'important', 'muted');
create type public.post_type           as enum ('discussion', 'question');
create type public.content_status      as enum ('visible', 'hidden', 'removed', 'deleted');

-- Announcements and events ------------------------------------------------------
create type public.announcement_category as enum ('academic', 'deadline', 'general', 'event', 'urgent');
create type public.publish_status        as enum ('draft', 'scheduled', 'published', 'archived');
create type public.event_category        as enum ('academic', 'career', 'workshop', 'social', 'cultural', 'sports', 'club', 'other');
create type public.event_format          as enum ('in_person', 'online', 'hybrid');
create type public.event_status          as enum ('draft', 'published', 'cancelled');
create type public.registration_status   as enum ('registered', 'waitlisted', 'cancelled');

-- Mentorship, resources ----------------------------------------------------------
create type public.mentorship_status   as enum ('pending', 'accepted', 'declined', 'cancelled', 'ended');
create type public.resource_kind       as enum ('file', 'link');
create type public.review_status       as enum ('pending', 'approved', 'rejected');

-- Moderation ---------------------------------------------------------------------
create type public.report_target       as enum ('post', 'reply', 'resource', 'message', 'event', 'announcement', 'user', 'space');
create type public.report_reason       as enum ('spam', 'harassment', 'hate', 'misinformation', 'impersonation', 'inappropriate', 'privacy', 'other');
create type public.report_status       as enum ('open', 'resolved', 'dismissed');
create type public.moderation_action_type as enum (
  'approve_account', 'reject_account', 'change_role', 'suspend_user', 'unsuspend_user', 'warn_user',
  'hide_content', 'remove_content', 'restore_content', 'lock_post', 'unlock_post', 'pin_post', 'unpin_post',
  'move_post', 'ban_from_space', 'approve_member', 'reject_member', 'approve_resource', 'reject_resource',
  'dismiss_report', 'delete_account'
);

-- Misc -----------------------------------------------------------------------------
create type public.bookmark_target     as enum ('post', 'event', 'announcement', 'resource');
create type public.chunk_source        as enum ('post', 'reply', 'resource', 'announcement', 'event');
create type public.email_status        as enum ('queued', 'sent', 'failed');

-- Shared trigger function: keeps updated_at current on every mutable table.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
