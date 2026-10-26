import type { Metadata } from "next";

import { AnnouncementComposer } from "@/components/announcements/announcement-composer";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { lastPublishingUnit } from "@/server/queries/announcements";
import { listDepartments } from "@/server/queries/departments";

export const metadata: Metadata = { title: ROUTES["/announcements/new"].title };

export default async function Page() {
  const user = await requireRole("lecturer");
  const [departments, unit] = await Promise.all([listDepartments(), lastPublishingUnit(user.id)]);

  return (
    <>
      <PageHeader
        title="New announcement"
        description="Publish an official update. It carries the Official badge and your name."
        breadcrumbs={[{ label: "Announcements", href: "/announcements" }, { label: "New" }]}
      />
      <div className="max-w-3xl rounded-[22px] border bg-card p-4 shadow-soft sm:p-8">
        <AnnouncementComposer
          departments={departments}
          initial={{
            title: "",
            bodyHtml: "",
            category: "general",
            publishingUnit: unit ?? user.departmentName ?? "",
            audienceAll: true,
            departmentIds: [],
            years: [],
            pinned: false,
            pinnedUntil: "",
            important: false,
            mode: "publish",
            publishAt: "",
          }}
        />
      </div>
    </>
  );
}
