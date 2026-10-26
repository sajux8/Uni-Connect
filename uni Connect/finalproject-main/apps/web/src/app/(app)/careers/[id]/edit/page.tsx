import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as z from "zod";

import { OpportunityForm } from "@/components/careers/opportunity-form";
import { PageHeader } from "@/components/shared/page-header";
import { NoAccessState } from "@/components/shared/states";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { canPostOpportunity, getOpportunity, listPostingAudiences } from "@/server/queries/careers";

export const metadata: Metadata = { title: ROUTES["/careers/[id]/edit"].title };

export default async function Page({ params }: PageProps<"/careers/[id]/edit">) {
  const user = await requireRole("coordinator");
  const { id } = await params;
  const o = z.uuid().safeParse(id).success ? await getOpportunity(id) : null;
  if (!o) notFound();
  const crumbs = [
    { label: "Careers", href: "/careers" },
    { label: o.title, href: `/careers/${o.id}` },
    { label: "Edit" },
  ];
  if (!(await canPostOpportunity(o.departmentId))) {
    return (
      <>
        <PageHeader title="Edit opportunity" breadcrumbs={crumbs} />
        <NoAccessState description="Only the department's coordinator or a super admin can edit this." />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Edit opportunity" breadcrumbs={crumbs} />
      <OpportunityForm
        audiences={await listPostingAudiences(user)}
        campusWide={user.role === "super_admin"}
        initial={o}
      />
    </>
  );
}
