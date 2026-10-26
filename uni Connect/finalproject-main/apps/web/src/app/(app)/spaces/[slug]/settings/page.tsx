import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SpaceForm } from "@/components/admin/space-form";
import { ClubCaptain } from "@/components/admin/club-captain";
import { ArchiveSpaceButton, SpaceModerators } from "@/components/admin/space-moderators";
import { PageHeader } from "@/components/shared/page-header";
import { NoAccessState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { listDepartments } from "@/server/queries/departments";
import { getSpace, listMembers } from "@/server/queries/spaces";

export const metadata: Metadata = { title: ROUTES["/spaces/[slug]/settings"].title };

export default async function Page({ params }: PageProps<"/spaces/[slug]/settings">) {
  const user = await requireApproved();
  const { slug } = await params;
  const space = await getSpace(slug, user.id);
  if (!space) notFound();
  const admin = user.role === "super_admin";
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("spaces")
    .select(
      "id, slug, name, description, type, department_id, year_of_study, module_code, icon, join_policy, rules, is_archived",
    )
    .eq("id", space.id)
    .single();
  if (!row) notFound();

  const header = (
    <PageHeader
      breadcrumbs={[
        { label: "Spaces", href: "/spaces" },
        { label: space.name, href: `/spaces/${space.slug}` },
        { label: "Settings" },
      ]}
      title={`${space.name} settings`}
      description={ROUTES["/spaces/[slug]/settings"].description}
      actions={
        admin ? <ArchiveSpaceButton spaceId={space.id} archived={row.is_archived} /> : undefined
      }
    />
  );
  if (!space.isModerator) {
    return (
      <>
        {header}
        <NoAccessState
          description="Only this space's coordinators and super admins can change its settings."
          action={
            <Link href={`/spaces/${space.slug}`} className={buttonVariants({ variant: "outline" })}>
              Back to the space
            </Link>
          }
        />
      </>
    );
  }

  const [departments, members] = await Promise.all([
    admin ? listDepartments() : Promise.resolve([]),
    admin || (row.type === "club" && user.role === "coordinator")
      ? listMembers(space.id, "active")
      : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-3xl">
      {header}
      {row.is_archived && (
        <p className="mb-6 rounded-xl border border-warning/30 bg-warning/8 px-4 py-3 text-sm">
          This space is archived: members can&apos;t see it. Restore it to open it again.
        </p>
      )}
      <div className="space-y-6">
        <SpaceForm
          detailsOnly={!admin}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          initial={{
            id: row.id,
            name: row.name,
            slug: row.slug,
            description: row.description ?? "",
            type: row.type,
            departmentId: row.department_id ?? "",
            yearOfStudy: row.year_of_study === null ? "" : String(row.year_of_study),
            moduleCode: row.module_code ?? "",
            icon: row.icon ?? "Hash",
            joinPolicy: row.join_policy,
            rules: row.rules ?? "",
          }}
        />
        {row.type === "club" &&
          (admin || (user.role === "coordinator" && row.department_id === user.departmentId)) && (
            <ClubCaptain
              spaceId={space.id}
              captainId={members.find((m) => m.role === "captain")?.userId ?? null}
              members={members.map((m) => ({ id: m.userId, name: m.fullName }))}
            />
          )}
        {admin && (
          <SpaceModerators
            spaceId={space.id}
            moderators={members
              .filter((m) => m.role === "moderator")
              .map((m) => ({
                id: m.userId,
                name: m.fullName,
                username: m.username,
                avatarUrl: m.avatarUrl,
              }))}
          />
        )}
      </div>
    </div>
  );
}
