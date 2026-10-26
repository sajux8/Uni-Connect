import type { Metadata } from "next";

import { DepartmentManager } from "@/components/admin/catalog-managers";
import { PageHeader } from "@/components/shared/page-header";
import { NoAccessState } from "@/components/shared/states";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { listAllDepartments } from "@/server/queries/admin";

export const metadata: Metadata = { title: ROUTES["/admin/departments"].title };

export default async function Page() {
  const user = await requireRole("lecturer");
  const header = (
    <PageHeader
      title="Departments"
      description="The departments students choose when they sign up. Hidden departments stay on existing profiles."
    />
  );
  if (user.role !== "super_admin") {
    return (
      <>
        {header}
        <NoAccessState description="Only super admins manage departments." />
      </>
    );
  }
  const departments = await listAllDepartments();
  return (
    <>
      {header}
      <DepartmentManager departments={departments} />
    </>
  );
}
