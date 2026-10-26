import {
  Bookmark,
  Briefcase,
  CalendarDays,
  Library,
  Megaphone,
  MessagesSquare,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RelativeTime } from "@/components/community/relative-time";
import { BookmarkButton } from "@/components/shared/bookmark-button";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { listBookmarks, type BookmarkTarget } from "@/server/queries/bookmarks";

export const metadata: Metadata = { title: ROUTES["/bookmarks"].title };

const TABS: { key: BookmarkTarget | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "post", label: "Posts" },
  { key: "event", label: "Events" },
  { key: "announcement", label: "Announcements" },
  { key: "resource", label: "Resources" },
  { key: "opportunity", label: "Careers" },
];

const ICONS = {
  post: MessagesSquare,
  event: CalendarDays,
  announcement: Megaphone,
  resource: Library,
  opportunity: Briefcase,
} as const;

export default async function Page({ searchParams }: PageProps<"/bookmarks">) {
  const user = await requireApproved();
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.type)?.key ?? "all";
  const items = await listBookmarks(user.id, tab === "all" ? undefined : tab);

  return (
    <>
      <PageHeader title="Bookmarks" description={ROUTES["/bookmarks"].description}>
        <FilterTabs
          label="Type"
          items={TABS.map((t) => ({
            href: t.key === "all" ? "/bookmarks" : `/bookmarks?type=${t.key}`,
            label: t.label,
            active: tab === t.key,
          }))}
        />
      </PageHeader>
      <div className="max-w-3xl">
        {items.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="Nothing saved yet"
            description="Tap the bookmark icon on a post, event, announcement, resource or opportunity to keep it here."
          />
        ) : (
          <ul className="space-y-1 rounded-[22px] border bg-card p-2 shadow-soft">
            {items.map((item) => {
              const Icon = ICONS[item.type];
              return (
                <li
                  key={`${item.type}-${item.id}`}
                  className="flex items-center gap-1 rounded-2xl hover:bg-accent/40"
                >
                  <Link
                    href={item.url}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <Icon className="size-4.5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail} · saved <RelativeTime date={item.savedAt} />
                      </span>
                    </span>
                  </Link>
                  <BookmarkButton type={item.type} id={item.id} initial className="mr-1 shrink-0" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
