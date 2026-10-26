import { ChevronLeft, ChevronRight, Megaphone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { PinnedStrip } from "@/components/announcements/pinned-strip";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { FilterSelect } from "@/components/shared/filter-select";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { ANNOUNCEMENT_CATEGORIES, parseCategory } from "@/lib/announcements";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { parseAnnouncementScope } from "@/lib/validation/announcements";
import {
  ANNOUNCEMENTS_PAGE_SIZE,
  listAnnouncements,
  listPinnedAnnouncements,
} from "@/server/queries/announcements";
import { listDepartments } from "@/server/queries/departments";
import { roleAtLeast } from "@/lib/campus";

export const metadata: Metadata = { title: ROUTES["/announcements"].title };

const SCOPES = [
  { key: "all", label: "All" },
  { key: "for_me", label: "For me" },
  { key: "unread", label: "Unread" },
] as const;

export default async function Page({ searchParams }: PageProps<"/announcements">) {
  const user = await requireApproved();
  const params = await searchParams;
  const scope = parseAnnouncementScope(params.scope);
  const category = parseCategory(params.category);
  const page = Math.max(1, Math.min(100, Number(params.page) || 1));
  const current = {
    scope: scope === "all" ? undefined : scope,
    category,
  };
  const canPublish = roleAtLeast(user.role, "lecturer");
  const filtered = scope !== "all" || Boolean(category);

  const [{ items, hasMore }, pinned, departments] = await Promise.all([
    listAnnouncements({
      scope,
      category,
      offset: (page - 1) * ANNOUNCEMENTS_PAGE_SIZE,
    }),
    filtered || page > 1 ? Promise.resolve([]) : listPinnedAnnouncements(false),
    listDepartments(),
  ]);

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Official updates from the university. Ones for your department and year are marked “For me”."
        actions={
          <>
            <MarkAllReadButton target="announcements" />
            {canPublish && (
              <Link href="/announcements/new" className={buttonVariants()}>
                <Plus data-icon="inline-start" /> New announcement
              </Link>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <FilterTabs
            label="Show"
            items={SCOPES.map((s) => ({
              href: withParams("/announcements", current, {
                scope: s.key === "all" ? undefined : s.key,
              }),
              label: s.label,
              active: scope === s.key,
            }))}
          />
          <FilterSelect
            label="Category"
            options={[
              {
                href: withParams("/announcements", current, { category: undefined }),
                label: "Any category",
                selected: !category,
              },
              ...ANNOUNCEMENT_CATEGORIES.map((c) => ({
                href: withParams("/announcements", current, { category: c.value }),
                label: c.label,
                selected: category === c.value,
              })),
            ]}
          />
        </div>
      </PageHeader>

      <div className="max-w-3xl">
        <PinnedStrip announcements={pinned} />

        {items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={
              scope === "unread"
                ? "You're all caught up"
                : filtered
                  ? "No announcements match"
                  : "No announcements yet"
            }
            description={
              scope === "unread"
                ? "You've read every announcement meant for you."
                : filtered
                  ? "Try another category or show all announcements."
                  : "Official updates from the university will appear here."
            }
            action={
              filtered ? (
                <Link href="/announcements" className={buttonVariants({ variant: "outline" })}>
                  Show all announcements
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {items.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} departments={departments} />
            ))}
          </div>
        )}

        {(page > 1 || hasMore) && (
          <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-2">
            {page > 1 ? (
              <Link
                href={withParams("/announcements", current, {
                  page: page > 2 ? String(page - 1) : undefined,
                })}
                className={buttonVariants({ variant: "outline" })}
              >
                <ChevronLeft data-icon="inline-start" /> Newer
              </Link>
            ) : (
              <span />
            )}
            {hasMore && (
              <Link
                href={withParams("/announcements", current, { page: String(page + 1) })}
                className={buttonVariants({ variant: "outline" })}
              >
                Older <ChevronRight data-icon="inline-end" />
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  );
}
