import type { UserRole } from "@/lib/campus";
import type { Enums } from "@/types/database";

/**
 * Reports and moderation (Feature 12). The database enforces the same rules
 * (moderate_report in migration 0021); these copies drive the UI.
 */

export type ReportTarget = Enums<"report_target">;
export type ReportReason = Enums<"report_reason">;
export type ReportStatus = Enums<"report_status">;
export type ModerationActionType = Enums<"moderation_action_type">;

export const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  {
    value: "spam",
    label: "Spam or advertising",
    description: "Repeated, irrelevant or promotional.",
  },
  {
    value: "harassment",
    label: "Harassment or bullying",
    description: "Targets or intimidates someone.",
  },
  {
    value: "hate",
    label: "Hate or discrimination",
    description: "Attacks people for who they are.",
  },
  {
    value: "misinformation",
    label: "False or misleading",
    description: "Wrong dates, fake announcements, dangerous advice.",
  },
  {
    value: "impersonation",
    label: "Impersonation",
    description: "Pretends to be someone else or an official unit.",
  },
  {
    value: "inappropriate",
    label: "Inappropriate content",
    description: "Explicit, violent or offensive.",
  },
  {
    value: "privacy",
    label: "Shares private information",
    description: "Phone numbers, addresses, IDs, photos.",
  },
  { value: "other", label: "Something else", description: "Tell the moderators what's wrong." },
];

export function reasonLabel(reason: ReportReason): string {
  return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  post: "Post",
  reply: "Reply",
  resource: "Resource",
  message: "Private message",
  event: "Event",
  announcement: "Announcement",
  user: "Member",
  space: "Space",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Open",
  resolved: "Action taken",
  dismissed: "Dismissed",
};

export type ReportDecision = "dismiss" | "hide" | "remove" | "warn" | "suspend" | "ban_from_space";

export const DECISION_INFO: Record<
  ReportDecision,
  { label: string; description: string; destructive: boolean }
> = {
  dismiss: {
    label: "Dismiss",
    description: "Nothing breaks the rules. Reporters are told no action was needed.",
    destructive: false,
  },
  hide: {
    label: "Hide content",
    description: "Only the author and moderators can still see it. The author is told why.",
    destructive: true,
  },
  remove: {
    label: "Remove content",
    description: "Taken down for good. The author is told why.",
    destructive: true,
  },
  warn: {
    label: "Warn the author",
    description: "The author gets a warning with your note, in the app and by email.",
    destructive: false,
  },
  suspend: {
    label: "Suspend the author",
    description:
      "Super admins only. They can't use UniConnect until the end date (or until reinstated).",
    destructive: true,
  },
  ban_from_space: {
    label: "Ban from the space",
    description: "They can no longer read or post in the space this was posted in.",
    destructive: true,
  },
};

/** What a moderator can do with a report about this kind of thing. */
export function decisionsFor(
  target: ReportTarget,
  role: UserRole,
  options: { hasAuthor: boolean; inSpace: boolean },
): ReportDecision[] {
  const list: ReportDecision[] = ["dismiss"];
  if (target === "space") {
    if (role === "super_admin") list.push("hide");
  } else if (target !== "user") {
    list.push("hide");
    if (target === "post" || target === "reply") list.push("remove");
  }
  if (options.hasAuthor) list.push("warn");
  if (options.hasAuthor && role === "super_admin") list.push("suspend");
  if (options.hasAuthor && options.inSpace) list.push("ban_from_space");
  return list;
}

/** "Hide" means different things for different content. */
export function hideLabel(target: ReportTarget): string {
  switch (target) {
    case "resource":
      return "Unpublish resource";
    case "event":
      return "Cancel event";
    case "announcement":
      return "Archive announcement";
    case "message":
      return "Delete message";
    case "space":
      return "Archive space";
    default:
      return "Hide content";
  }
}

export const MODERATION_ACTION_LABELS: Record<ModerationActionType, string> = {
  approve_account: "Approved account",
  assign_batch: "Changed batch",
  assign_lecturer: "Assigned lecturer",
  remove_lecturer: "Removed lecturer",
  set_class_rep: "Changed class rep",
  set_space_role: "Changed space role",
  approve_event: "Approved event",
  reject_event: "Declined event",
  reject_account: "Rejected account",
  change_role: "Changed role",
  suspend_user: "Suspended account",
  unsuspend_user: "Reinstated account",
  warn_user: "Warned member",
  hide_content: "Hid content",
  remove_content: "Removed content",
  restore_content: "Restored content",
  lock_post: "Locked thread",
  unlock_post: "Unlocked thread",
  pin_post: "Pinned thread",
  unpin_post: "Unpinned thread",
  move_post: "Moved thread",
  ban_from_space: "Banned from space",
  approve_member: "Approved join request",
  reject_member: "Declined join request",
  approve_resource: "Approved resource",
  reject_resource: "Rejected resource",
  dismiss_report: "Dismissed report",
  delete_account: "Deleted account",
};

/** Where a logged target lives in the app (null when there's no page for it). */
export function targetLink(type: string, id: string): string | null {
  switch (type) {
    case "post":
      return `/posts/${id}`;
    case "resource":
      return `/resources/${id}`;
    case "event":
      return `/events/${id}`;
    case "announcement":
      return `/announcements/${id}`;
    case "user":
      return `/admin/users/${id}`;
    default:
      return null;
  }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Filters for the moderation log, from the URL (shared by the page and the CSV export). */
export function parseLogFilters(params: Record<string, string | string[] | undefined>) {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const action =
    one("action") in MODERATION_ACTION_LABELS ? (one("action") as ModerationActionType) : undefined;
  const actor = /^[0-9a-f-]{36}$/i.test(one("actor")) ? one("actor") : undefined;
  const from = DAY.test(one("from")) ? one("from") : undefined;
  const to = DAY.test(one("to")) ? one("to") : undefined;
  return { action, actor, from, to };
}

export const ACCOUNT_STATUS_LABELS = {
  pending: "Waiting for approval",
  approved: "Active",
  rejected: "Rejected",
  suspended: "Suspended",
} as const;

export const ACCOUNT_STATUS_TINTS = {
  pending: "amber",
  approved: "emerald",
  rejected: "zinc",
  suspended: "red",
} as const;
