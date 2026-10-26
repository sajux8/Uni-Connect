import type { Metadata } from "next";

import { ResourceForm } from "@/components/resources/resource-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireApproved } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/campus";
import { ROUTES } from "@/lib/routes";
import { listDepartments } from "@/server/queries/departments";
import { listSpaces, listTags } from "@/server/queries/spaces";

export const metadata: Metadata = { title: ROUTES["/resources/new"].title };

export default async function Page({ searchParams }: PageProps<"/resources/new">) {
  const user = await requireApproved();
  const params = await searchParams;
  const [departments, spaces, tags] = await Promise.all([
    listDepartments(),
    listSpaces(user.id),
    listTags(),
  ]);
  // Spaces you can share into: joined ones, plus open ones (sharing joins them).
  const shareable = spaces.filter(
    (s) => s.membership?.status === "active" || (s.joinPolicy === "open" && !s.membership),
  );
  const preselected = shareable.find((s) => s.slug === params.space)?.id ?? "";

  return (
    <>
      <PageHeader
        title="Share a resource"
        description={ROUTES["/resources/new"].description}
        breadcrumbs={[{ label: "Resources", href: "/resources" }, { label: "Share" }]}
      />
      <div className="max-w-3xl rounded-[22px] border bg-card p-4 shadow-soft sm:p-8">
        <ResourceForm
          userId={user.id}
          isStaff={isStaffRole(user.role)}
          departments={departments}
          spaces={shareable.map((s) => ({ id: s.id, name: s.name }))}
          tags={tags}
          defaults={{ departmentId: user.departmentId ?? "", spaceId: preselected }}
        />
      </div>
    </>
  );
}
