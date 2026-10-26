import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as z from "zod";

import { AnnouncementComposer } from "@/components/announcements/announcement-composer";
import { PageHeader } from "@/components/shared/page-header";
import { NoAccessState } from "@/components/shared/states";
import { toCampusInput } from "@/lib/campus-time";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { getAnnouncement } from "@/server/queries/announcements";
import { listDepartments } from "@/server/queries/departments";

export const metadata: Metadata = { title: ROUTES["/announcements/[id]/edit"].title };

export default async function Page({ params }: PageProps<"/announcements/[id]/edit">) {
  const user = await requireRole("lecturer");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [a, departments] = await Promise.all([getAnnouncement(id), listDepartments()]);
  if (!a) notFound();

  const header = (
    <PageHeader
      title="Edit announcement"
      breadcrumbs={[
        { label: "Announcements", href: "/announcements" },
        { label: a.title, href: `/announcements/${a.id}` },
        { label: "Edit" },
      ]}
    />
  );

  if (a.publisher.id !== user.id && user.role !== "super_admin") {
    return (
      <>
        {header}
        <NoAccessState
          title="You can't edit this announcement"
          description="Only the person who published it, or an admin, can change it."
        />
      </>
    );
  }

  const published = Boolean(a.publishedAt);
  return (
    <>
      {header}
      <div className="max-w-3xl rounded-[22px] border bg-card p-4 shadow-soft sm:p-8">
        <AnnouncementComposer
          announcementId={a.id}
          published={published}
          departments={departments}
          initial={{
            title: a.title,
            bodyHtml: a.bodyHtml,
            category: a.category,
            publishingUnit: a.publishingUnit,
            audienceAll: a.audience.all,
            departmentIds: a.audience.departmentIds,
            years: a.audience.years,
            pinned: a.isPinned,
            pinnedUntil: toCampusInput(a.pinnedUntil, "date"),
            important: a.isImportant,
            mode: published ? "publish" : a.status === "scheduled" ? "schedule" : "draft",
            publishAt: a.status === "scheduled" ? toCampusInput(a.publishAt, "datetime") : "",
          }}
        />
      </div>
    </>
  );
}
