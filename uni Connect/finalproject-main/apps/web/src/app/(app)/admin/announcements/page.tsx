import { AlertTriangle, Megaphone, Pin, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AnnouncementActions } from "@/components/announcements/announcement-actions";
import { RelativeTime } from "@/components/community/relative-time";
import { CategoryChip, type CategoryTint } from "@/components/shared/badges";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { categoryInfo, PUBLISH_STATUS_LABELS, type PublishStatus } from "@/lib/announcements";
import { toCampusInput } from "@/lib/campus-time";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { listManagedAnnouncements } from "@/server/queries/announcements";

export const metadata: Metadata = { title: ROUTES["/admin/announcements"].title };

const STATUS_TINT: Record<PublishStatus, CategoryTint> = {
  draft: "zinc",
  scheduled: "amber",
  published: "emerald",
  archived: "zinc",
};

const STATUSES = Object.keys(PUBLISH_STATUS_LABELS) as PublishStatus[];

export default async function Page({ searchParams }: PageProps<"/admin/announcements">) {
  const user = await requireRole("lecturer");
  const header = (
    <PageHeader
      title="All announcements"
      description={
        user.role === "super_admin"
          ? "Every announcement, including drafts and scheduled ones."
          : "Your announcements, including drafts and scheduled ones."
      }
      actions={
        <Link href="/announcements/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" /> New announcement
        </Link>
      }
    />
  );

  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status);
  const items = await listManagedAnnouncements({
    status,
    mineOnly: user.role === "super_admin" ? undefined : user.id,
  });

  return (
    <>
      {header}
      <FilterTabs
        label="Status"
        className="mb-5"
        items={[
          { href: "/admin/announcements", label: "All", active: !status },
          ...STATUSES.map((s) => ({
            href: withParams("/admin/announcements", {}, { status: s }),
            label: PUBLISH_STATUS_LABELS[s],
            active: status === s,
          })),
        ]}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={
            status
              ? `No ${PUBLISH_STATUS_LABELS[status].toLowerCase()} announcements`
              : "No announcements yet"
          }
          description="Announcements you write appear here, including drafts and scheduled ones."
          action={
            <Link href="/announcements/new" className={buttonVariants({ variant: "outline" })}>
              Write an announcement
            </Link>
          }
        />
      ) : (
        <ul className="divide-y rounded-[22px] border bg-card shadow-soft">
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryChip tint={STATUS_TINT[a.status]}>
                    {PUBLISH_STATUS_LABELS[a.status]}
                  </CategoryChip>
                  <CategoryChip tint={categoryInfo(a.category).tint}>
                    {categoryInfo(a.category).label}
                  </CategoryChip>
                  {a.isImportant && (
                    <CategoryChip tint="red">
                      <AlertTriangle aria-hidden /> Important
                    </CategoryChip>
                  )}
                  {a.isPinned && <Pin className="size-3.5 text-primary" aria-label="Pinned" />}
                </div>
                <Link
                  href={`/announcements/${a.id}`}
                  className="block truncate py-1 font-bold hover:text-primary"
                >
                  {a.title}
                </Link>
                <p className="text-[13px] text-muted-foreground">
                  {a.publishingUnit}
                  {a.publisherName && ` · ${a.publisherName}`}
                  {" · "}
                  {a.status === "scheduled" && a.publishAt ? (
                    <>Goes live {toCampusInput(a.publishAt, "datetime").replace("T", " at ")}</>
                  ) : a.publishedAt ? (
                    <>
                      Published <RelativeTime date={a.publishedAt} />
                    </>
                  ) : (
                    <>
                      Updated <RelativeTime date={a.updatedAt} />
                    </>
                  )}
                </p>
              </div>
              <AnnouncementActions
                id={a.id}
                status={a.status}
                isPinned={a.isPinned}
                canDelete={user.role === "super_admin" || !a.publishedAt}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
