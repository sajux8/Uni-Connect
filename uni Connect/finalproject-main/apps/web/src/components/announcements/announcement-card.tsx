import { AlertTriangle, Pin, Users } from "lucide-react";
import Link from "next/link";

import { RelativeTime } from "@/components/community/relative-time";
import { CategoryChip, OfficialBadge } from "@/components/shared/badges";
import { audienceLabel, categoryInfo } from "@/lib/announcements";
import { cn } from "@/lib/utils";
import type { AnnouncementListItem } from "@/server/queries/announcements";

/** One announcement in a list. Server-safe. */
export function AnnouncementCard({
  announcement: a,
  departments,
}: {
  announcement: AnnouncementListItem;
  departments: { id: string; name: string }[];
}) {
  const category = categoryInfo(a.category);
  const unread = a.forMe && !a.isRead;

  return (
    <article
      aria-labelledby={`announcement-${a.id}`}
      className={cn(
        "relative space-y-3 rounded-[22px] border bg-card p-5 shadow-soft transition-shadow hover:shadow-lift sm:p-6",
        a.isImportant && "border-destructive/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <OfficialBadge />
        <CategoryChip tint={category.tint}>{category.label}</CategoryChip>
        {a.isImportant && (
          <CategoryChip tint="red">
            <AlertTriangle aria-hidden /> Important
          </CategoryChip>
        )}
        {a.isPinned && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary dark:text-accent-foreground">
            <Pin className="size-3.5" aria-hidden /> Pinned
          </span>
        )}
        {unread && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-primary dark:text-accent-foreground">
            <span className="size-2 rounded-full bg-primary" aria-hidden /> New
          </span>
        )}
      </div>

      <h2 id={`announcement-${a.id}`} className="text-[18px] leading-snug font-extrabold">
        <Link
          href={`/announcements/${a.id}`}
          className="outline-none after:absolute after:inset-0 after:rounded-[22px] hover:text-primary focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
        >
          {a.title}
        </Link>
      </h2>

      <p className="line-clamp-2 text-[15px] text-muted-foreground">{a.excerpt}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
        <span className="font-semibold text-foreground">{a.publishingUnit}</span>
        {a.publisher.name && <span>by {a.publisher.name}</span>}
        <RelativeTime date={a.publishedAt} />
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" aria-hidden />
          <span className="sr-only">For:</span>
          {audienceLabel(a.audience, departments)}
        </span>
      </div>
    </article>
  );
}
