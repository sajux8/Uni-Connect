import { Megaphone, Pin } from "lucide-react";
import Link from "next/link";

import { RelativeTime } from "@/components/community/relative-time";
import { categoryInfo } from "@/lib/announcements";
import { cn } from "@/lib/utils";
import type { AnnouncementListItem } from "@/server/queries/announcements";

/**
 * Pinned official notices at the top of Home and Announcements.
 * Unread ones come first. Server-safe.
 */
export function PinnedStrip({
  announcements,
  title = "Pinned announcements",
}: {
  announcements: AnnouncementListItem[];
  title?: string;
}) {
  if (announcements.length === 0) return null;
  const sorted = [...announcements].sort(
    (a, b) => Number(a.isRead || !a.forMe) - Number(b.isRead || !b.forMe),
  );

  return (
    <section aria-label={title} className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold">
        <Pin className="size-4 text-primary" aria-hidden /> {title}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sorted.map((a) => {
          const unread = a.forMe && !a.isRead;
          return (
            <li key={a.id}>
              <Link
                href={`/announcements/${a.id}`}
                className={cn(
                  "flex h-full gap-3 rounded-[18px] border bg-card p-4 shadow-soft transition-shadow outline-none hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/40",
                  a.isImportant ? "border-destructive/30" : "border-primary/20",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl",
                    a.isImportant
                      ? "bg-destructive/10 text-destructive"
                      : "bg-accent text-accent-foreground",
                  )}
                >
                  <Megaphone className="size-4.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-start gap-2">
                    <span className="line-clamp-2 flex-1 text-sm leading-snug font-bold">
                      {a.title}
                    </span>
                    {unread && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
                        <span className="sr-only">Unread</span>
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {a.publishingUnit} · {categoryInfo(a.category).label} ·{" "}
                    <RelativeTime date={a.publishedAt} />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
