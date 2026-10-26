import { AlertTriangle, Archive, CalendarClock, FileText, Pin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";

import {
  AnnouncementActions,
  MarkAnnouncementRead,
} from "@/components/announcements/announcement-actions";
import { RelativeTime } from "@/components/community/relative-time";
import { RichTextContent } from "@/components/community/rich-text-content";
import { CategoryChip, OfficialBadge, RoleBadge } from "@/components/shared/badges";
import { BookmarkButton } from "@/components/shared/bookmark-button";
import { ReportButton } from "@/components/shared/report-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import { audienceLabel, categoryInfo } from "@/lib/announcements";
import { toCampusInput } from "@/lib/campus-time";
import { requireApproved } from "@/lib/auth/session";
import { getAnnouncement } from "@/server/queries/announcements";
import { isBookmarked } from "@/server/queries/bookmarks";
import { listDepartments } from "@/server/queries/departments";
import { roleAtLeast } from "@/lib/campus";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return getAnnouncement(id);
}

export async function generateMetadata({
  params,
}: PageProps<"/announcements/[id]">): Promise<Metadata> {
  await requireApproved();
  const announcement = await load((await params).id);
  return { title: announcement?.title ?? "Announcement" };
}

function campusDateTime(iso: string) {
  return toCampusInput(iso, "datetime").replace("T", " at ");
}

export default async function Page({ params }: PageProps<"/announcements/[id]">) {
  const user = await requireApproved();
  const { id } = await params;
  const [a, departments, saved] = await Promise.all([
    load(id),
    listDepartments(),
    isBookmarked(user.id, "announcement", id),
  ]);
  if (!a) notFound();

  const canManage =
    (a.publisher.id === user.id && roleAtLeast(user.role, "lecturer")) ||
    user.role === "super_admin";
  const category = categoryInfo(a.category);
  const publisherRole = a.publisher.role === "student" ? null : a.publisher.role;

  return (
    <div className="mx-auto max-w-3xl">
      {a.status === "published" && <MarkAnnouncementRead id={a.id} />}
      <PageHeader
        breadcrumbs={[{ label: "Announcements", href: "/announcements" }, { label: a.title }]}
        title={a.title}
        actions={
          <>
            {a.status === "published" && (
              <BookmarkButton type="announcement" id={a.id} initial={saved} />
            )}
            {!canManage && a.publisher.id !== user.id && a.status === "published" && (
              <ReportButton targetType="announcement" targetId={a.id} />
            )}
            {canManage && (
              <AnnouncementActions
                id={a.id}
                status={a.status}
                isPinned={a.isPinned}
                canDelete={user.role === "super_admin" || !a.publishedAt}
              />
            )}
          </>
        }
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
              {a.pinnedUntil && ` until ${toCampusInput(a.pinnedUntil, "date")}`}
            </span>
          )}
        </div>
      </PageHeader>

      {a.status !== "published" && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          {a.status === "draft" ? (
            <FileText className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          ) : a.status === "scheduled" ? (
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          ) : (
            <Archive className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          )}
          <p>
            {a.status === "draft" && "This is a draft. Only you and super admins can see it."}
            {a.status === "scheduled" &&
              a.publishAt &&
              `Scheduled to publish on ${campusDateTime(a.publishAt)} (Sri Lanka time). Only you and super admins can see it until then.`}
            {a.status === "archived" && "Archived. Members can no longer see it."}
          </p>
        </div>
      )}

      <article className="space-y-6 rounded-[22px] border bg-card p-4 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-center gap-3 border-b pb-5">
          <UserAvatar
            name={a.publisher.name ?? a.publishingUnit}
            src={a.publisher.avatarUrl}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{a.publishingUnit}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
              {a.publisher.name &&
                (a.publisher.username ? (
                  <Link href={`/u/${a.publisher.username}`} className="hover:text-primary">
                    {a.publisher.name}
                  </Link>
                ) : (
                  <span>{a.publisher.name}</span>
                ))}
              {publisherRole && <RoleBadge role={publisherRole} />}
              {a.publishedAt && <RelativeTime date={a.publishedAt} />}
              {a.editedAt && <span>(edited)</span>}
            </p>
          </div>
        </div>

        <RichTextContent html={a.bodyHtml} />

        <p className="flex items-center gap-2 rounded-xl bg-surface-tint px-3.5 py-2.5 text-[13px] text-muted-foreground">
          <Users className="size-4 shrink-0" aria-hidden />
          <span>
            For:{" "}
            <strong className="text-foreground">{audienceLabel(a.audience, departments)}</strong>
          </span>
        </p>
      </article>
    </div>
  );
}
