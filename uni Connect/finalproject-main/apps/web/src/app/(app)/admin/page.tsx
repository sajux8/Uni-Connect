import {
  CalendarDays,
  Flag,
  FolderCheck,
  Handshake,
  MessageSquare,
  Reply,
  UserMinus,
  UserPlus,
  Users,
  UserCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ActivityChart } from "@/components/admin/activity-chart";
import { StatCard } from "@/components/admin/stat-card";
import { RelativeTime } from "@/components/community/relative-time";
import { CategoryChip } from "@/components/shared/badges";
import { Eyebrow, PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requireRole } from "@/lib/auth/session";
import { reasonLabel, REPORT_TARGET_LABELS } from "@/lib/moderation";
import { ROUTES } from "@/lib/routes";
import { getAdminStats, getWeeklyActivity, listReports } from "@/server/queries/admin";

export const metadata: Metadata = { title: ROUTES["/admin"].title };

export default async function Page() {
  const user = await requireRole("lecturer");
  // Organizers only manage announcements here.
  if (user.role === "lecturer") redirect("/admin/announcements");
  const admin = user.role === "super_admin";

  const [stats, weeks, reports] = await Promise.all([
    getAdminStats(),
    getWeeklyActivity(8),
    listReports({ status: "open", limit: 5 }),
  ]);
  if (!stats) throw new Error("Couldn't load the dashboard.");

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          admin
            ? "Queues that need you, and how the community is doing."
            : "Reports and resources waiting for a moderator."
        }
      />

      <section aria-labelledby="queues-title" className="space-y-3">
        <h2 id="queues-title" className="sr-only">
          Queues
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {admin && (
            <StatCard
              icon={UserCheck}
              label="Accounts to approve"
              value={stats.pendingApprovals}
              href="/admin/approvals"
              attention
            />
          )}
          <StatCard
            icon={Flag}
            label="Open reports"
            value={stats.openReports}
            href="/admin/reports"
            attention
          />
          <StatCard
            icon={FolderCheck}
            label="Resources to review"
            value={stats.pendingResources}
            href="/admin/resources"
            attention
          />
          {admin && (
            <StatCard
              icon={UserMinus}
              label="Deletion requests"
              value={stats.pendingDeletions}
              href="/admin/users?deletion=1"
              attention
            />
          )}
        </div>
      </section>

      <section aria-labelledby="community-title" className="mt-8 space-y-3">
        <Eyebrow>Community</Eyebrow>
        <h2 id="community-title" className="sr-only">
          Community
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={Users}
            label="Members"
            value={stats.members}
            hint={`${stats.newUsers7d} joined this week`}
            href={admin ? "/admin/users?status=approved" : undefined}
          />
          <StatCard icon={MessageSquare} label="Posts this week" value={stats.posts7d} />
          <StatCard icon={Reply} label="Replies this week" value={stats.replies7d} />
          <StatCard
            icon={CalendarDays}
            label="Upcoming events"
            value={stats.upcomingEvents}
            href="/events"
          />
          <StatCard icon={Handshake} label="Active mentorships" value={stats.activeMentorships} />
          <StatCard icon={UserPlus} label="New members this week" value={stats.newUsers7d} />
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="activity-title"
          className="space-y-4 rounded-[22px] border bg-card p-5 shadow-soft sm:p-6"
        >
          <h2 id="activity-title" className="text-[17px] font-extrabold tracking-tight">
            Weekly activity
          </h2>
          <ActivityChart weeks={weeks} />
        </section>

        <section
          aria-labelledby="latest-reports-title"
          className="space-y-3 rounded-[22px] border bg-card p-5 shadow-soft sm:p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="latest-reports-title" className="text-[17px] font-extrabold tracking-tight">
              Latest reports
            </h2>
            <Link
              href="/admin/reports"
              className="text-sm font-bold text-primary hover:underline dark:text-accent-foreground"
            >
              See all
            </Link>
          </div>
          {reports.length === 0 ? (
            <EmptyState
              icon={Flag}
              title="No open reports"
              description="Nice and quiet."
              className="py-8"
            />
          ) : (
            <ul className="divide-y">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/reports/${r.id}`}
                    className="flex min-h-14 flex-col gap-1 py-3 outline-none hover:text-primary focus-visible:underline"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <CategoryChip tint="amber">{reasonLabel(r.reason)}</CategoryChip>
                      <span className="text-xs text-muted-foreground">
                        {REPORT_TARGET_LABELS[r.targetType]} · <RelativeTime date={r.createdAt} />
                      </span>
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {r.snapshot.title ?? "Untitled"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
