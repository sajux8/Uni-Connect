/**
 * Notification types. Delivery defaults live in the database
 * (`notification_types`, migration 0009); this file only describes them for people.
 */

import type { UserRole } from "@/lib/campus";

export type NotificationGroup =
  | "replies"
  | "community"
  | "announcements"
  | "events"
  | "classes"
  | "support"
  | "mentorship"
  | "account";

export interface NotificationTypeInfo {
  label: string;
  description: string;
  group: NotificationGroup;
  /** Shown in settings only from this role up (everyone when omitted). */
  minRole?: UserRole;
}

export const NOTIFICATION_TYPE_INFO: Record<string, NotificationTypeInfo> = {
  reply_to_post: {
    label: "Replies to your posts and followed threads",
    description: "Someone replies to a post you wrote or follow.",
    group: "replies",
  },
  reply_to_reply: {
    label: "Replies to your replies",
    description: "Someone answers one of your replies directly.",
    group: "replies",
  },
  answer_accepted: {
    label: "Accepted answers",
    description: "Your answer is accepted as the solution.",
    group: "replies",
  },
  new_post_in_space: {
    label: "New posts in spaces set to “All posts”",
    description: "Choose which spaces in the list below.",
    group: "community",
  },
  new_post_with_tag: {
    label: "New posts with tags you follow",
    description: "A new post uses one of your followed tags.",
    group: "community",
  },
  join_request: {
    label: "Requests to join spaces you moderate",
    description: "Someone asks to join a members-only space.",
    group: "community",
    minRole: "lecturer",
  },
  join_request_decided: {
    label: "Your requests to join spaces",
    description: "A moderator approves or declines your request.",
    group: "community",
  },
  report_submitted: {
    label: "New reports to review",
    description: "Someone reports content. Grouped into one reminder while reports are open.",
    group: "community",
    minRole: "coordinator",
  },
  report_resolved: {
    label: "Outcome of your reports",
    description: "A moderator reviews something you reported.",
    group: "community",
  },
  content_moderated: {
    label: "Moderator actions on your content",
    description: "A moderator hides something you posted, with the reason.",
    group: "community",
  },
  announcement: {
    label: "Official announcements for you",
    description:
      "Announcements aimed at your department and year. Email is only sent for important ones.",
    group: "announcements",
  },
  event_registered: {
    label: "Registration confirmations",
    description: "When you register for an event.",
    group: "events",
  },
  event_waitlisted: {
    label: "Waitlist confirmations",
    description: "When you join an event's waitlist, with your place.",
    group: "events",
  },
  waitlist_promoted: {
    label: "A seat opens up for you",
    description: "You move from the waitlist to registered.",
    group: "events",
  },
  event_reminder_24h: {
    label: "Event reminders: the day before",
    description: "24 hours before an event you're registered for.",
    group: "events",
  },
  event_reminder_1h: {
    label: "Event reminders: an hour before",
    description: "1 hour before an event you're registered for.",
    group: "events",
  },
  event_updated: {
    label: "Changes to your events",
    description: "The time, place or registration deadline changes.",
    group: "events",
  },
  event_submitted: {
    label: "Events waiting for your approval",
    description: "Someone submits an event for your club, batch or department.",
    group: "events",
  },
  event_reviewed: {
    label: "Decisions on events you submitted",
    description: "Your event is approved and published, or not approved with a reason.",
    group: "events",
  },
  event_cancelled: {
    label: "Cancelled events",
    description: "An event you registered for is cancelled, with the reason.",
    group: "events",
  },
  class_changed: {
    label: "Changes to your classes",
    description: "A class is cancelled, moved or back on, with the reason.",
    group: "classes",
  },
  attendance_corrected: {
    label: "Corrections to your attendance",
    description: "Your lecturer or coordinator changes your record for a class, with the reason.",
    group: "classes",
  },
  attendance_alert: {
    label: "Students missing classes",
    description: "A student in your department misses 3 classes in a row.",
    group: "classes",
    minRole: "coordinator",
  },
  form_open: {
    label: "Feedback forms for you",
    description: "A lecturer or coordinator asks your batch for anonymous feedback.",
    group: "classes",
  },
  opportunity_new: {
    label: "New internships and jobs for you",
    description: "Your coordinator shares an opportunity with your department or batch.",
    group: "announcements",
  },
  ticket_new: {
    label: "New support requests and complaints",
    description: "Someone in your department (or on campus, for management) sends one.",
    group: "support",
    minRole: "coordinator",
  },
  ticket_reply: {
    label: "Replies on your tickets",
    description: "A reply on a support request or complaint.",
    group: "support",
  },
  ticket_status: {
    label: "Updates on your tickets",
    description: "Your request or complaint is in progress, resolved or reopened, with any note.",
    group: "support",
  },
  mentorship_request: {
    label: "Mentorship requests",
    description: "Someone asks you to be their mentor.",
    group: "mentorship",
  },
  mentorship_accepted: {
    label: "Your requests are accepted",
    description: "A mentor accepts your request and your conversation opens.",
    group: "mentorship",
  },
  mentorship_declined: {
    label: "Your requests are declined",
    description: "A mentor can't take you on, with their note.",
    group: "mentorship",
  },
  mentorship_ended: {
    label: "Mentorships ending",
    description: "Your mentor or mentee ends the mentorship.",
    group: "mentorship",
  },
  new_message: {
    label: "New private messages",
    description: "Grouped per conversation, and skipped while you're reading it.",
    group: "mentorship",
  },
  new_account_pending: {
    label: "Accounts waiting for approval",
    description: "New sign-ups to review.",
    group: "account",
    minRole: "coordinator",
  },
  account_approved: {
    label: "Account approved",
    description: "Always sent.",
    group: "account",
  },
  account_rejected: {
    label: "Account not approved",
    description: "Always sent.",
    group: "account",
  },
  moderation_warning: {
    label: "Warnings from moderators",
    description: "Always sent, in the app and by email.",
    group: "account",
  },
};

export const NOTIFICATION_GROUP_LABELS: Record<NotificationGroup, string> = {
  replies: "Replies and answers",
  community: "Spaces and community",
  announcements: "Announcements",
  events: "Events",
  classes: "Classes, attendance and feedback",
  support: "Support and complaints",
  mentorship: "Mentorship and messages",
  account: "Account",
};

export function notificationGroup(type: string): NotificationGroup {
  return NOTIFICATION_TYPE_INFO[type]?.group ?? "account";
}

/** Tabs on /notifications. */
export const NOTIFICATION_TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "replies", label: "Replies" },
  { key: "announcements", label: "Announcements" },
  { key: "events", label: "Events" },
  { key: "classes", label: "Classes" },
  { key: "support", label: "Support" },
  { key: "mentorship", label: "Mentorship" },
  { key: "community", label: "Spaces" },
  { key: "account", label: "Account" },
] as const;
export type NotificationTab = (typeof NOTIFICATION_TABS)[number]["key"];

export function parseNotificationTab(value: unknown): NotificationTab {
  return NOTIFICATION_TABS.some((t) => t.key === value) ? (value as NotificationTab) : "all";
}

/** Types in a tab's group (empty for "all" and "unread"). */
export function typesForTab(tab: NotificationTab): string[] {
  if (tab === "all" || tab === "unread") return [];
  return Object.entries(NOTIFICATION_TYPE_INFO)
    .filter(([, info]) => info.group === tab)
    .map(([type]) => type);
}

/** Onboarding presets. */
export const NOTIFICATION_PRESETS = [
  {
    value: "everything",
    label: "Everything",
    description: "Also tell me about every new post in the spaces I join.",
  },
  {
    value: "important",
    label: "Important only",
    description: "Replies and answers to you, threads you follow, and announcements for you.",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Replies to you and announcements in the app. No email except account news.",
  },
] as const;
export type NotificationPreset = (typeof NOTIFICATION_PRESETS)[number]["value"];

/**
 * The preference rows a preset writes ("important" and "everything" use the defaults;
 * "everything" also sets joined spaces to "All posts"). Locked types aren't listed.
 */
export function presetPreferences(
  preset: NotificationPreset,
): { type: string; in_app: boolean; email: boolean }[] {
  if (preset !== "minimal") return [];
  return [
    { type: "announcement", in_app: true, email: false },
    { type: "content_moderated", in_app: true, email: false },
    { type: "new_post_with_tag", in_app: false, email: false },
    { type: "new_post_in_space", in_app: false, email: false },
  ];
}
