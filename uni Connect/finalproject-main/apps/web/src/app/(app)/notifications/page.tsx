import { BellOff, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NotificationRow } from "@/components/notifications/notification-row";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { NOTIFICATION_TABS, parseNotificationTab } from "@/lib/notifications";
import { ROUTES } from "@/lib/routes";
import {
  listNotifications,
  unreadNotificationCount,
  type NotificationItem,
} from "@/server/queries/notifications";

export const metadata: Metadata = { title: ROUTES["/notifications"].title };

const PAGE = 30;

/** Today / This week / Earlier, in campus time. */
function groupByAge(items: NotificationItem[]) {
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(d);
  const today = dayKey(new Date());
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const groups: { label: string; items: NotificationItem[] }[] = [
    { label: "Today", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const item of items) {
    const created = new Date(item.createdAt);
    const index = dayKey(created) === today ? 0 : created.getTime() > weekAgo ? 1 : 2;
    groups[index].items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
}

export default async function Page({ searchParams }: PageProps<"/notifications">) {
  const user = await requireApproved();
  const params = await searchParams;
  const tab = parseNotificationTab(params.tab);
  const limit = Math.min(300, Math.max(PAGE, Number(params.limit) || PAGE));
  const [{ items, hasMore }, unread] = await Promise.all([
    listNotifications(user.id, { tab, limit }),
    unreadNotificationCount(user.id),
  ]);
  const current = { tab: tab === "all" ? undefined : tab };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Replies, answers, announcements and updates about your account."
        actions={
          <>
            <MarkAllReadButton target="notifications" disabled={unread === 0} />
            <Link
              href="/settings/notifications"
              className={buttonVariants({ variant: "ghost", size: "icon" })}
              aria-label="Notification settings"
            >
              <Settings />
            </Link>
          </>
        }
      >
        <FilterTabs
          label="Show"
          items={NOTIFICATION_TABS.map((t) => ({
            href: withParams("/notifications", {}, { tab: t.key === "all" ? undefined : t.key }),
            label: t.label,
            active: tab === t.key,
            count: t.key === "unread" && unread > 0 ? unread : undefined,
          }))}
        />
      </PageHeader>

      <div className="max-w-3xl">
        {items.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={tab === "unread" ? "You're all caught up" : "No notifications yet"}
            description={
              tab === "unread"
                ? "Nothing new since you last looked."
                : "When someone replies to you, accepts your answer or an announcement is published for you, it shows up here."
            }
          />
        ) : (
          <div className="space-y-6">
            {groupByAge(items).map((group) => (
              <section key={group.label} aria-labelledby={`group-${group.label}`}>
                <h2
                  id={`group-${group.label}`}
                  className="mb-2 px-1 text-xs font-extrabold tracking-[0.14em] text-muted-foreground uppercase"
                >
                  {group.label}
                </h2>
                <ul className="space-y-1 rounded-[22px] border bg-card p-2 shadow-soft">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <NotificationRow item={item} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {hasMore && (
              <div className="text-center">
                <Link
                  href={withParams("/notifications", current, { limit: String(limit + PAGE) })}
                  scroll={false}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Show older
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
