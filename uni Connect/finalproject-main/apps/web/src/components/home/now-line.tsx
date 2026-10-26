import { Megaphone, Pin } from "lucide-react";
import Link from "next/link";

import { RelativeTime } from "@/components/community/relative-time";
import { NowClock } from "@/components/home/now-clock";
import { CategoryChip, OfficialBadge } from "@/components/shared/badges";
import { categoryInfo } from "@/lib/announcements";
import { formatCampus } from "@/lib/campus-time";
import { cn } from "@/lib/utils";
import type { AnnouncementListItem } from "@/server/queries/announcements";

/**
 * Home's Now line: the divider between what is coming up and what already happened, with the
 * campus clock. Pinned official notices are held here, and the ones the member hasn't opened stay
 * highlighted until they do. Server-safe (the clock is its own client component).
 */
export function NowLine({
  now,
  pinned,
  refreshAt,
}: {
  now: Date;
  pinned: AnnouncementListItem[];
  /** When the board next changes (a class starts or ends): the clock reloads Home then. */
  refreshAt?: string | null;
}) {
  const sorted = [...pinned].sort(
    (a, b) => Number(a.isRead || !a.forMe) - Number(b.isRead || !b.forMe),
  );
  return (
    <section aria-labelledby="now-line" className="space-y-4">
      <div className="flex items-center gap-3">
        <h2
          id="now-line"
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-primary px-3.5 text-[13.5px] font-extrabold text-primary-foreground dark:bg-accent-foreground dark:text-background"
        >
          <span
            className="size-1.5 animate-pulse rounded-full bg-brand-cyan dark:bg-primary"
            aria-hidden
          />
          Now
          <NowClock initial={formatCampus(now, "time")} refreshAt={refreshAt ?? null} />
        </h2>
        <span className="h-px flex-1 bg-primary/25" aria-hidden />
      </div>

      {sorted.length > 0 && (
        <div className="@container overflow-hidden rounded-[22px] border bg-card shadow-soft">
          <h3 className="flex items-center gap-2 px-5 pt-4 pb-3 text-[15px] font-extrabold">
            <Pin className="size-4 text-primary" aria-hidden /> Pinned for you
          </h3>
          <ul className="divide-y border-t">
            {sorted.map((a) => {
              const unread = a.forMe && !a.isRead;
              return (
                <li
                  key={a.id}
                  className={cn(
                    "relative flex flex-wrap gap-x-3 gap-y-2 px-5 py-3.5 transition-colors",
                    unread ? "bg-accent" : "hover:bg-surface-tint",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-xl",
                      a.isImportant
                        ? "bg-destructive/10 text-destructive"
                        : "bg-accent text-accent-foreground",
                      unread && !a.isImportant && "bg-card",
                    )}
                  >
                    <Megaphone className="size-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/announcements/${a.id}`}
                      className={cn(
                        "block text-[15px] leading-snug text-pretty outline-none after:absolute after:inset-0 hover:text-primary focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset dark:hover:text-accent-foreground",
                        unread ? "font-extrabold" : "font-bold",
                      )}
                    >
                      {a.title}
                    </Link>
                    <p
                      className={cn(
                        "flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]",
                        unread ? "text-foreground/75" : "text-muted-foreground",
                      )}
                    >
                      <OfficialBadge />
                      <span>
                        {a.publishingUnit} · {categoryInfo(a.category).label} ·{" "}
                        <RelativeTime date={a.publishedAt} />
                      </span>
                    </p>
                  </div>
                  {(a.isImportant || unread) && (
                    <div className="flex w-full items-center gap-1.5 pl-12 @lg:w-auto @lg:shrink-0 @lg:pl-0">
                      {a.isImportant && <CategoryChip tint="red">Important</CategoryChip>}
                      {unread && (
                        <span className="inline-flex h-5 items-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground dark:bg-accent-foreground dark:text-background">
                          Unread
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
