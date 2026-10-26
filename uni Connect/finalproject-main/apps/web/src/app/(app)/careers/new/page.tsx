import type { Metadata } from "next";

import { OpportunityForm } from "@/components/careers/opportunity-form";
import { PageHeader } from "@/components/shared/page-header";
import { NoAccessState } from "@/components/shared/states";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { listPostingAudiences } from "@/server/queries/careers";

export const metadata: Metadata = { title: ROUTES["/careers/new"].title };

/** Post an opportunity (Phase G): coordinators for their department, super admins anywhere. */
export default async function Page() {
  const user = await requireRole("coordinator");
  const audiences = await listPostingAudiences(user);
  const crumbs = [{ label: "Careers", href: "/careers" }, { label: "New" }];
  if (audiences.length === 0 && user.role !== "super_admin") {
    return (
      <>
        <PageHeader title="Post an opportunity" breadcrumbs={crumbs} />
        <NoAccessState description="Ask a super admin to set your department first." />
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Post an opportunity"
        description="Share an internship, part-time job or graduate role. Students it's for are told."
        breadcrumbs={crumbs}
      />
      <OpportunityForm audiences={audiences} campusWide={user.role === "super_admin"} />
    </>
  );
}
