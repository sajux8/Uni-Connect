import { Hash } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NewSpacePanel } from "@/components/admin/new-space-panel";
import { SpaceIcon } from "@/components/community/space-icon";
import { CategoryChip } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, NoAccessState } from "@/components/shared/states";
import { requireRole } from "@/lib/auth/session";
import { spaceTypeInfo } from "@/lib/community";
import { ROUTES } from "@/lib/routes";
import { listAllSpaces } from "@/server/queries/admin";
import { listDepartments } from "@/server/queries/departments";

export const metadata: Metadata = { title: ROUTES["/admin/spaces"].title };

export default async function Page() {
  const user = await requireRole("lecturer");
  const header = (
    <PageHeader
      title="Spaces"
      description="Create spaces, change their settings, choose their moderators, or archive them."
    />
  );
  if (user.role !== "super_admin") {
    return (
      <>
        {header}
        <NoAccessState description="Only super admins manage spaces." />
      </>
    );
  }
  const [spaces, departments] = await Promise.all([listAllSpaces(), listDepartments()]);

  return (
    <>
      {header}
      <div className="mb-6">
        <NewSpacePanel departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
      </div>
      {spaces.length === 0 ? (
        <EmptyState icon={Hash} title="No spaces yet" description="Create the first one above." />
      ) : (
        <ul className="divide-y rounded-[22px] border bg-card shadow-soft">
          {spaces.map((s) => {
            const type = spaceTypeInfo(s.type);
            return (
              <li key={s.id}>
                <Link
                  href={`/spaces/${s.slug}/settings`}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none hover:bg-accent/50 focus-visible:bg-accent sm:px-5"
                >
                  <SpaceIcon icon={s.icon} type={s.type} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{s.name}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">
                      /spaces/{s.slug} · {s.member_count}{" "}
                      {s.member_count === 1 ? "member" : "members"}
                      {s.departments?.name ? ` · ${s.departments.name}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    <CategoryChip tint={type.tint}>{type.label}</CategoryChip>
                    {s.join_policy === "approval" && <CategoryChip>Approval</CategoryChip>}
                    {s.is_archived && <CategoryChip tint="red">Archived</CategoryChip>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
