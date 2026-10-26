"use client";

import {
  AtSign,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Clock,
  CircleCheck,
  EyeOff,
  Flag,
  ShieldAlert,
  ShieldCheck,
  FileCheck,
  FileUp,
  Handshake,
  Hash,
  Megaphone,
  MessageCircle,
  MessageSquare,
  UserCheck,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { RelativeTime } from "@/components/community/relative-time";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/server/queries/notifications";
import { markNotificationRead } from "@/server/actions/notifications";

const ICONS: Record<string, { icon: LucideIcon; className: string }> = {
  reply_to_post: { icon: MessageSquare, className: "bg-accent text-accent-foreground" },
  reply_to_reply: { icon: AtSign, className: "bg-accent text-accent-foreground" },
  answer_accepted: { icon: CircleCheck, className: "bg-success/12 text-success" },
  new_post_in_space: { icon: Hash, className: "bg-muted text-muted-foreground" },
  new_post_with_tag: { icon: Hash, className: "bg-muted text-muted-foreground" },
  join_request: { icon: UserPlus, className: "bg-accent text-accent-foreground" },
  join_request_decided: { icon: UserCheck, className: "bg-success/12 text-success" },
  content_moderated: { icon: EyeOff, className: "bg-warning/12 text-warning" },
  announcement: { icon: Megaphone, className: "bg-primary text-primary-foreground" },
  event_registered: { icon: CalendarCheck, className: "bg-success/12 text-success" },
  event_waitlisted: { icon: Clock, className: "bg-warning/12 text-warning" },
  waitlist_promoted: { icon: CalendarCheck, className: "bg-success/12 text-success" },
  event_reminder_24h: { icon: CalendarClock, className: "bg-accent text-accent-foreground" },
  event_reminder_1h: { icon: CalendarClock, className: "bg-primary text-primary-foreground" },
  event_updated: { icon: CalendarClock, className: "bg-warning/12 text-warning" },
  event_cancelled: { icon: CalendarX, className: "bg-destructive/10 text-destructive" },
  resource_submitted: { icon: FileUp, className: "bg-accent text-accent-foreground" },
  resource_reviewed: { icon: FileCheck, className: "bg-success/12 text-success" },
  mentorship_request: { icon: Handshake, className: "bg-accent text-accent-foreground" },
  mentorship_accepted: { icon: Handshake, className: "bg-success/12 text-success" },
  mentorship_declined: { icon: UserX, className: "bg-muted text-muted-foreground" },
  mentorship_ended: { icon: Handshake, className: "bg-muted text-muted-foreground" },
  new_message: { icon: MessageCircle, className: "bg-primary text-primary-foreground" },
  report_submitted: { icon: Flag, className: "bg-warning/12 text-warning" },
  report_resolved: { icon: ShieldCheck, className: "bg-success/12 text-success" },
  moderation_warning: { icon: ShieldAlert, className: "bg-destructive/10 text-destructive" },
  new_account_pending: { icon: UserPlus, className: "bg-accent text-accent-foreground" },
  account_approved: { icon: UserCheck, className: "bg-success/12 text-success" },
  account_rejected: { icon: UserX, className: "bg-destructive/10 text-destructive" },
};

/** One notification; opening it marks it read. Used by the bell and /notifications. */
export function NotificationRow({
  item,
  compact = false,
  onOpen,
}: {
  item: NotificationItem;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const style = ICONS[item.type] ?? { icon: Bell, className: "bg-muted text-muted-foreground" };
  const unread = !item.readAt;
  const content = (
    <>
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-xl",
          compact ? "size-9" : "size-10",
          style.className,
        )}
      >
        <style.icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span
          className={cn(
            "block text-sm leading-snug",
            unread ? "font-bold text-foreground" : "font-medium text-foreground/85",
            compact && "line-clamp-2",
          )}
        >
          {item.title}
        </span>
        {item.body && (
          <span
            className={cn(
              "block text-[13px] text-muted-foreground",
              compact ? "line-clamp-1" : "line-clamp-2",
            )}
          >
            {item.body}
          </span>
        )}
        <RelativeTime date={item.createdAt} className="block text-xs text-muted-foreground" />
      </span>
      {unread && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
          <span className="sr-only">Unread</span>
        </span>
      )}
    </>
  );

  const className = cn(
    "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
    unread && "bg-accent/35",
  );

  function open() {
    if (unread) void markNotificationRead(item.id);
    onOpen?.();
  }

  if (item.link) {
    return (
      <Link href={item.link} onClick={open} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={open} className={className}>
      {content}
    </button>
  );
}
